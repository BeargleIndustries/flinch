// ─── API ──────────────────────────────────────────────────────────────────────

import { state, setPhase } from './state.js';
import { render, renderSessionSelect, renderStats } from './render.js';
import { showError } from './components.js';
import { normalizeClassification, extractSuggestionText } from './components.js';

export async function api(path, options = {}) {
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };
  const config = { ...defaults, ...options };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(path, config);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function apiStream(path, body, onEvent) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    let currentEvent = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          onEvent(currentEvent, data);
        } catch (e) {
          console.error('SSE parse error:', e);
        }
        currentEvent = null;
      }
    }
  }
  return reader;
}

export async function startBatch(sessionId, probeIds, delayMs) {
  state.batchRunning = true;
  state.batchComplete = false;
  state.batchProgress = {
    completed: 0,
    total: probeIds ? probeIds.length : state.probes.length,
    failed: 0,
    results: [],
  };
  render();

  try {
    await apiStream(
      `/api/sessions/${sessionId}/batch`,
      { probe_ids: probeIds || null, delay_ms: delayMs || 2000 },
      (event, data) => {
        if (event === 'progress') {
          state.batchProgress.completed = data.completed;
          state.batchProgress.total = data.total;
          state.batchProgress.results.push(data);
          loadStats();
          render();
        } else if (event === 'error') {
          state.batchProgress.completed = data.completed;
          state.batchProgress.failed = (state.batchProgress.failed || 0) + 1;
          render();
        } else if (event === 'complete') {
          state.batchRunning = false;
          state.batchComplete = true;
          loadStats();
          render();
        }
      }
    );
  } catch (e) {
    state.batchRunning = false;
    showError('Batch failed: ' + e.message);
    render();
  }
}

export function cancelBatch() {
  state.batchRunning = false;
  render();
}

export async function startBatchConditions(sessionId, probeIds, conditions, delayMs) {
  const total = probeIds.length * conditions.length;
  state.batchRunning = true;
  state.batchComplete = false;
  state.batchProgress = {
    completed: 0,
    total,
    failed: 0,
    results: [],
  };
  render();

  try {
    await apiStream(
      `/api/sessions/${sessionId}/batch-conditions`,
      { probe_ids: probeIds, conditions, delay_ms: delayMs || 2000 },
      (event, data) => {
        if (event === 'progress') {
          state.batchProgress.completed = data.completed;
          state.batchProgress.total = data.total;
          state.batchProgress.results.push(data);
          loadStats();
          render();
        } else if (event === 'error') {
          state.batchProgress.completed = data.completed;
          state.batchProgress.failed = (state.batchProgress.failed || 0) + 1;
          render();
        } else if (event === 'complete') {
          state.batchRunning = false;
          state.batchComplete = true;
          if (data && data.experiment_id) {
            state.conditionExperimentId = data.experiment_id;
            state.conditionComparisonData = null; // invalidate cache
          }
          loadStats();
          render();
        }
      }
    );
  } catch (e) {
    state.batchRunning = false;
    showError('Conditions batch failed: ' + e.message);
    render();
  }
}

// ─── Data loading ─────────────────────────────────────────────────────────────

export async function loadSessions() {
  try {
    state.sessions = await api('/api/sessions');
    renderSessionSelect();
  } catch (e) {
    console.error('Failed to load sessions:', e);
    state.sessions = [];
  }
}

export async function loadProbes() {
  try {
    state.probes = await api('/api/probes');
  } catch (e) {
    console.error('Failed to load probes:', e);
    state.probes = [];
  }
}

export async function loadStats() {
  if (!state.currentSession) return;
  try {
    state.stats = await api(`/api/sessions/${state.currentSession.id}/stats`);
    renderStats();
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

export async function loadTurns(runId) {
  try {
    state.currentTurns = await api(`/api/runs/${runId}/turns`);
  } catch (e) {
    console.error('Failed to load turns:', e);
    state.currentTurns = [];
  }
}

// ─── Session actions ──────────────────────────────────────────────────────────

export async function createSession(name, targetModel, coachProfile, systemPrompt, coachBackend, coachModel, probeIds) {
  const body = { name, target_model: targetModel, coach_profile: coachProfile || 'standard', system_prompt: systemPrompt || '' };
  if (coachBackend) body.coach_backend = coachBackend;
  if (coachModel) body.coach_model = coachModel;
  if (probeIds && probeIds.length > 0) body.probe_ids = probeIds;
  const session = await api('/api/sessions', {
    method: 'POST',
    body,
  });
  state.sessions.push(session);
  state.currentSession = session;
  state.currentProbe = null;
  state.currentRun = null;
  state.phase = 'idle';
  state.stats = null;
  renderSessionSelect();
  await loadProbes();
  await loadStats();
  render();
}

export async function handleSessionChange(sessionId) {
  if (!sessionId) {
    state.currentSession = null;
    state.currentProbe = null;
    state.currentRun = null;
    state.phase = 'idle';
    state.stats = null;
    render();
    renderStats();
    return;
  }
  const session = state.sessions.find(s => String(s.id) === String(sessionId));
  if (!session) return;
  state.currentSession = session;
  state.currentProbe = null;
  state.currentRun = null;
  state.phase = 'idle';
  state.snapshots = [];
  state.snapshotDiff = null;
  state.snapshotView = false;
  await loadStats();
  await loadSnapshots(session.id);
  render();
}

// ─── Probe actions ────────────────────────────────────────────────────────────

export async function selectProbe(probeId) {
  const probe = state.probes.find(p => String(p.id) === String(probeId));
  if (!probe) return;
  state.currentProbe = probe;
  state.currentRun = null;
  state.phase = 'probe_selected';
  render();
}

export async function sendProbe() {
  if (!state.currentProbe || !state.currentSession) return;
  if (state.isLoading) return;
  state.isLoading = true;
  setPhase('awaiting');
  render();
  try {
    const run = await api(`/api/sessions/${state.currentSession.id}/run`, {
      method: 'POST',
      body: { probe_id: state.currentProbe.id },
    });
    state.currentRun = run;
    await loadTurns(run.id);
    await loadAnnotation(run.id);
    const cls = normalizeClassification(run.initial_classification);
    if (cls === 'complied') {
      setPhase('response');
    } else {
      const suggestionText = extractSuggestionText(run.coach_suggestion);
      if (suggestionText) {
        state.pushbackText = suggestionText;
        setPhase('pushback_decision');
      } else {
        setPhase('response');
      }
    }
    await loadStats();
    render();
  } catch (e) {
    console.error('sendProbe failed:', e);
    setPhase('probe_selected');
    showError('Failed to send probe: ' + e.message);
    render();
  } finally {
    state.isLoading = false;
  }
}

export function selectCustomProbe() {
  state.currentProbe = { id: 'custom', name: 'Custom Prompt', domain: 'custom', prompt_text: '' };
  state.currentRun = null;
  state.phase = 'probe_selected';
  render();
}

export async function sendCustomProbe() {
  const textarea = document.getElementById('custom-probe-text');
  const text = textarea?.value?.trim();
  if (!text) { showError('Enter some prompt text first.'); return; }
  if (!state.currentSession) return;
  if (state.isLoading) return;
  state.customProbeText = text;
  state.isLoading = true;
  setPhase('awaiting');
  render();
  try {
    const run = await api(`/api/sessions/${state.currentSession.id}/run`, {
      method: 'POST',
      body: { custom_text: text },
    });
    // Update currentProbe to the newly created probe
    state.currentProbe = state.probes.find(p => p.id === run.probe_id) || state.currentProbe;
    state.currentRun = run;
    await loadProbes(); // refresh to include the new custom probe
    await loadTurns(run.id);
    await loadAnnotation(run.id);
    const cls = normalizeClassification(run.initial_classification);
    if (cls === 'complied') {
      setPhase('response');
    } else {
      const suggestionText = extractSuggestionText(run.coach_suggestion);
      if (suggestionText) {
        state.pushbackText = suggestionText;
        setPhase('pushback_decision');
      } else {
        setPhase('response');
      }
    }
    await loadStats();
    state.customProbeText = ''; // clear after successful send
    render();
  } catch (e) {
    console.error('sendCustomProbe failed:', e);
    setPhase('probe_selected');
    showError('Failed to send custom probe: ' + e.message);
    render();
  } finally {
    state.isLoading = false;
  }
}

export async function sendPushback(source) {
  if (!state.currentRun) return;
  if (state.isLoading) return;
  state.isLoading = true;
  const text = state.pushbackText;
  setPhase('awaiting');
  render();
  try {
    const run = await api(`/api/runs/${state.currentRun.id}/pushback`, {
      method: 'POST',
      body: { text, source },
    });
    state.currentRun = run;
    await loadTurns(run.id);
    setPhase('pushback_sent');
    await loadStats();
    render();
  } catch (e) {
    console.error('sendPushback failed:', e);
    setPhase('pushback_decision');
    showError('Failed to send pushback: ' + e.message);
    render();
  } finally {
    state.isLoading = false;
  }
}

export async function skipPushback() {
  if (!state.currentRun) return;
  try {
    const run = await api(`/api/runs/${state.currentRun.id}/skip`, { method: 'POST' });
    state.currentRun = run;
    setPhase('pushback_sent');
    await loadStats();
    render();
  } catch (e) {
    console.error('skipPushback failed:', e);
    showError('Failed to skip: ' + e.message);
  }
}

export async function promoteToExample(runId) {
  try {
    await api(`/api/runs/${runId}/promote`, {
      method: 'POST',
      body: { promoted: true },
    });
    if (state.currentRun && state.currentRun.id === runId) {
      state.currentRun.promoted = true;
    }
    render();
  } catch (e) {
    console.error('promote failed:', e);
    showError('Failed to promote: ' + e.message);
  }
}

export async function continuePushback() {
  const text = document.getElementById('continue-text').value.trim();
  if (!text) return;
  if (state.isLoading) return;
  state.isLoading = true;
  setPhase('awaiting');
  render();
  try {
    const run = await api(`/api/runs/${state.currentRun.id}/continue`, {
      method: 'POST',
      body: { text, source: 'override' },
    });
    state.currentRun = run;
    await loadTurns(run.id);
    setPhase('pushback_sent');
    await loadStats();
    render();
  } catch (e) {
    showError('Failed to continue pushback: ' + e.message);
    setPhase('pushback_sent');
    render();
  } finally {
    state.isLoading = false;
  }
}

export async function nextProbe() {
  state.currentRun = null;
  state.phase = 'idle';
  if (state.currentProbe) {
    const idx = state.probes.findIndex(p => p.id === state.currentProbe.id);
    const next = state.probes[idx + 1];
    if (next) {
      state.currentProbe = next;
      state.phase = 'probe_selected';
    } else {
      state.currentProbe = null;
    }
  }
  render();
}

export async function deleteProbe(probeId, probeName) {
  if (!confirm(`Delete probe "${probeName}"?`)) return;
  try {
    await api(`/api/probes/${probeId}`, { method: 'DELETE' });
    state.probes = state.probes.filter(p => p.id !== probeId);
    if (state.currentProbe && state.currentProbe.id === probeId) {
      state.currentProbe = null;
      state.currentRun = null;
      state.phase = 'idle';
    }
    render();
  } catch (e) {
    showError('Failed to delete probe: ' + e.message);
  }
}

export async function bulkDeleteProbes(probeIds) {
  return api('/api/probes/bulk-delete', {
    method: 'POST',
    body: { probe_ids: probeIds },
  });
}

export async function loadDefaultProbes() {
  try {
    const result = await api('/api/probes/load-defaults', { method: 'POST' });
    await loadProbes();
    render();
    const panel = document.getElementById('load-defaults-panel');
    if (panel) panel.style.display = 'none';
  } catch (e) {
    showError('Failed to load defaults: ' + e.message);
  }
}

export async function listProbeFiles() {
  const result = await api('/api/probes/files');
  return result.files || [];
}

export async function importProbeFile(filename) {
  try {
    const result = await api('/api/probes/import-file', {
      method: 'POST',
      body: { filename },
    });
    await loadProbes();
    render();
    return result;
  } catch (e) {
    showError('Failed to import file: ' + e.message);
    throw e;
  }
}

export async function createProbe(data) {
  const probe = await api('/api/probes', {
    method: 'POST',
    body: data,
  });
  state.probes.push(probe);
  return probe;
}

export async function deleteCurrentSession() {
  if (!state.currentSession) return;
  if (!confirm(`Delete session "${state.currentSession.name}" and all its runs?`)) return;
  try {
    await api(`/api/sessions/${state.currentSession.id}`, { method: 'DELETE' });
    state.sessions = state.sessions.filter(s => s.id !== state.currentSession.id);
    state.currentSession = null;
    state.currentRun = null;
    state.currentTurns = [];
    state.phase = 'idle';
    state.stats = null;
    renderSessionSelect();
    render();
    renderStats();
  } catch (e) {
    showError('Failed to delete session: ' + e.message);
  }
}

export async function deleteRun(runId) {
  if (!confirm('Delete this run and its conversation history?')) return;
  try {
    await api(`/api/runs/${runId}`, { method: 'DELETE' });
    if (state.currentRun && state.currentRun.id === runId) {
      state.currentRun = null;
      state.currentTurns = [];
      state.phase = 'idle';
    }
    await loadStats();
    render();
  } catch (e) {
    showError('Failed to delete run: ' + e.message);
  }
}

export async function deleteCoachExample(exampleId) {
  if (!confirm('Delete this coach example?')) return;
  try {
    await api(`/api/coach-examples/${exampleId}`, { method: 'DELETE' });
    // showCoachExamples is in render.js — import dynamically to avoid circular
    const { showCoachExamples } = await import('./render.js');
    showCoachExamples();
  } catch (e) {
    showError('Failed to delete example: ' + e.message);
  }
}

export async function editCoachExample(exampleId) {
  const newText = prompt('Edit pushback text:');
  if (newText === null) return;
  try {
    await api(`/api/coach-examples/${exampleId}`, {
      method: 'PATCH',
      body: { pushback_text: newText },
    });
    const { showCoachExamples } = await import('./render.js');
    showCoachExamples();
  } catch (e) {
    showError('Failed to update example: ' + e.message);
  }
}

export async function viewRun(runId) {
  try {
    const run = await api(`/api/runs/${runId}`);
    state.currentRun = run;
    state.currentProbe = state.probes.find(p => p.id === run.probe_id) || state.currentProbe;
    await loadTurns(runId);
    await loadAnnotation(runId);
    state.phase = run.final_response ? 'pushback_sent' : (run.initial_classification ? 'response' : 'idle');
    render();
  } catch (e) {
    showError('Failed to load run: ' + e.message);
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function triggerDownload(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.text();
      showError(`Export failed: ${err}`);
      return;
    }
    const blob = await resp.blob();
    // Extract filename from Content-Disposition header or URL
    const disposition = resp.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = match ? match[1] : url.split('/').pop().split('?')[0] || 'export.json';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (e) {
    showError(`Export failed: ${e.message}`);
  }
}

export function exportSession(format, includeTurns) {
  if (!state.currentSession) return;
  triggerDownload(`/api/sessions/${state.currentSession.id}/export?format=${format}&include_turns=${includeTurns}`);
  const menu = document.getElementById('export-menu');
  if (menu) menu.style.display = 'none';
}

export function exportEnhanced(format, includeTurns, includeAnnotations, includePolicy, includeVariants) {
  if (!state.currentSession) return;
  const params = new URLSearchParams({
    format,
    include_turns: includeTurns,
    include_annotations: includeAnnotations,
    include_policy: includePolicy,
    include_variants: includeVariants,
  });
  triggerDownload(`/api/sessions/${state.currentSession.id}/export?${params}`);
}

export function exportFindings() {
  if (!state.currentSession) return;
  triggerDownload(`/api/sessions/${state.currentSession.id}/export?format=findings`);
}

export function exportAgent() {
  if (!state.currentSession) return;
  triggerDownload(`/api/sessions/${state.currentSession.id}/export?format=agent`);
}

export function exportReport() {
  if (!state.currentSession) return;
  triggerDownload(`/api/sessions/${state.currentSession.id}/export?format=report`);
}

export function exportComparison(sessionIds, format = 'json') {
  if (!sessionIds || sessionIds.length < 2) return;
  triggerDownload(`/api/export/compare?session_ids=${sessionIds.join(',')}&format=${format}`);
}

export function toggleExportMenu() {
  const menu = document.getElementById('export-menu');
  if (!menu) return;
  const visible = menu.style.display !== 'none';
  menu.style.display = visible ? 'none' : 'block';
  if (!visible) {
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target) && !e.target.closest('[onclick*="toggleExportMenu"]')) {
          menu.style.display = 'none';
          document.removeEventListener('click', handler);
        }
      });
    }, 10);
  }
}

// ─── Annotation functions ─────────────────────────────────────────────────────

export async function loadAnnotation(runId) {
  try {
    state.currentAnnotation = await api(`/api/runs/${runId}/annotations`);
  } catch (e) {
    console.error('Failed to load annotation:', e);
    state.currentAnnotation = { run_id: runId, note_text: '', pattern_tags: [], finding: '' };
  }
}

export async function saveAnnotation(runId, data) {
  try {
    state.currentAnnotation = await api(`/api/runs/${runId}/annotations`, {
      method: 'PUT',
      body: data,
    });
  } catch (e) {
    showError('Failed to save annotation: ' + e.message);
  }
}

export async function loadPatternTags() {
  try {
    state.allPatternTags = await api('/api/annotations/tags');
  } catch (e) {
    state.allPatternTags = [];
  }
}

// ─── Models ───────────────────────────────────────────────────────────────────

export async function loadModels() {
  try {
    const providers = await api('/api/models');
    // Cache for use by compare view and other components
    state._modelProviders = providers;
    const select = document.getElementById('modal-session-model');
    if (!select) return;
    select.innerHTML = '';
    for (const provider of providers) {
      const group = document.createElement('optgroup');
      const isOllama = provider.provider === 'ollama';
      const label = provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1);
      const groupLabel = isOllama
        ? `${label} [LOCAL]`
        : (provider.available ? label : `${label} (${provider.hint || 'unavailable'})`);
      group.label = groupLabel;
      for (const m of provider.models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = isOllama ? `${m.name} [LOCAL]` : m.name;
        opt.disabled = !provider.available;
        if (isOllama) opt.dataset.local = 'true';
        group.appendChild(opt);
      }
      select.appendChild(group);
    }
    // Also populate the coach model picker for local backend if it exists
    populateOllamaCoachPicker(providers);
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

function populateOllamaCoachPicker(providers) {
  const picker = document.getElementById('modal-coach-model');
  if (!picker) return;
  picker.innerHTML = '<option value="">— select local model —</option>';
  const ollamaProvider = (providers || []).find(p => p.provider === 'ollama');
  if (ollamaProvider && ollamaProvider.models.length) {
    for (const m of ollamaProvider.models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      picker.appendChild(opt);
    }
  }
}

export async function checkOllamaStatus() {
  try {
    const resp = await fetch('/api/ollama/status');
    const data = await resp.json();
    const badge = document.getElementById('ollama-status-badge');
    if (badge) {
      if (data.available) {
        badge.textContent = `connected (${data.models.length} models)`;
        badge.style.background = 'rgba(34, 197, 94, 0.15)';
        badge.style.color = '#22c55e';
      } else {
        badge.textContent = 'offline';
        badge.style.background = 'rgba(239, 68, 68, 0.15)';
        badge.style.color = '#ef4444';
      }
    }
    const modelsList = document.getElementById('ollama-models-list');
    if (modelsList && data.available && data.models.length > 0) {
      modelsList.innerHTML = data.models.map(m =>
        `<div style="padding: 2px 0;">${m.name}</div>`
      ).join('');
    } else if (modelsList) {
      modelsList.innerHTML = data.available
        ? '<div style="color: #888;">No models pulled. Run: ollama pull llama3.2</div>'
        : '<div style="color: #666;">Start Ollama to use local models</div>';
    }
    // ANTHROPIC_API_KEY warning
    if (!data.anthropic_key_set && data.anthropic_key_warning) {
      if (!document.getElementById('anthropic-key-warning')) {
        const warning = document.createElement('div');
        warning.id = 'anthropic-key-warning';
        warning.style.cssText = 'background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 8px 12px; margin: 8px 16px; font-size: 0.75rem; color: #ef4444;';
        warning.textContent = data.anthropic_key_warning;
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.prepend(warning);
      }
    }
    return data;
  } catch (e) {
    console.error('Failed to check Ollama status:', e);
    return { available: false, models: [] };
  }
}

export async function testOllamaConnection() {
  const urlInput = document.getElementById('ollama-base-url');
  const url = urlInput?.value || 'http://localhost:11434';
  try {
    const resp = await fetch('/api/settings/ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: url }),
    });
    const data = await resp.json();
    await checkOllamaStatus();
    // Refresh model list so local models appear
    await loadModels();
    if (data.available) {
      alert(`Connected! Found ${data.models.length} model(s).`);
    } else {
      alert('Could not connect to Ollama at ' + url);
    }
  } catch (e) {
    alert('Connection test failed: ' + e.message);
  }
}

// ─── Coach Default Settings ───────────────────────────────────────────────────

export async function loadCoachDefault() {
  try {
    const resp = await fetch('/api/settings/coach-default');
    return await resp.json();
  } catch (e) {
    return { backend: 'anthropic', model: '' };
  }
}

export async function saveCoachDefault() {
  const backendSel = document.getElementById('settings-coach-backend');
  const modelSel = document.getElementById('settings-coach-model');
  const backend = backendSel?.value || 'anthropic';
  const model = backend === 'local' ? (modelSel?.value || '') : '';

  // Toggle model section visibility
  const modelSection = document.getElementById('settings-coach-model-section');
  if (modelSection) modelSection.style.display = backend === 'local' ? 'block' : 'none';

  try {
    await fetch('/api/settings/coach-default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend, model }),
    });
  } catch (e) {
    console.error('Failed to save coach default:', e);
  }
}
window.saveCoachDefault = saveCoachDefault;

export async function populateCoachDefaultSettings() {
  const defaults = await loadCoachDefault();
  const backendSel = document.getElementById('settings-coach-backend');
  const modelSel = document.getElementById('settings-coach-model');
  const modelSection = document.getElementById('settings-coach-model-section');

  if (backendSel) backendSel.value = defaults.backend || 'anthropic';
  if (modelSection) modelSection.style.display = defaults.backend === 'local' ? 'block' : 'none';

  // Populate model picker from Ollama status
  if (modelSel) {
    try {
      const status = await fetch('/api/ollama/status').then(r => r.json());
      modelSel.innerHTML = '<option value="">— select model —</option>';
      if (status.available && status.models.length) {
        for (const m of status.models) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          modelSel.appendChild(opt);
        }
      }
      if (defaults.model) modelSel.value = defaults.model;
    } catch (_) {}
  }
}
window.populateCoachDefaultSettings = populateCoachDefaultSettings;

export async function loadComparison(sessionIds) {
  try {
    return await api(`/api/compare?session_ids=${sessionIds.join(',')}`);
  } catch (e) {
    showError('Failed to load comparison: ' + e.message);
    return null;
  }
}

export async function loadComparisons() {
  try {
    state.comparisons = await api('/api/comparisons');
  } catch (e) {
    console.error('Failed to load comparisons:', e);
    state.comparisons = [];
  }
}

export async function getComparison(id) {
  return api(`/api/comparisons/${id}`);
}

export async function deleteComparison(id) {
  if (!confirm('Delete this comparison?')) return;
  try {
    await api(`/api/comparisons/${id}`, { method: 'DELETE' });
    state.comparisons = state.comparisons.filter(c => c.id !== id);
    render();
  } catch (e) {
    showError('Failed to delete comparison: ' + e.message);
  }
}

export function exportComparisonById(comparisonId, format = 'json') {
  triggerDownload(`/api/comparisons/${comparisonId}/export?format=${format}`);
}

// ─── TOU Mapper / Policies ────────────────────────────────────────────────────

export async function loadPolicies(provider) {
  try {
    const url = provider ? `/api/policies/${provider}` : '/api/policies';
    state.policyClaims = await api(url);
  } catch (e) {
    console.error('Failed to load policies:', e);
    state.policyClaims = {};
  }
}

export async function linkProbeClaims(probeId, claimIds) {
  return api(`/api/probes/${probeId}/claims`, {
    method: 'POST',
    body: { claim_ids: claimIds },
  });
}

export async function unlinkProbeClaim(probeId, claimId) {
  return api(`/api/probes/${probeId}/claims/${claimId}`, { method: 'DELETE' });
}

export async function loadCompliance(sessionId) {
  try {
    state.complianceData = await api(`/api/sessions/${sessionId}/compliance`);
  } catch (e) {
    console.error('Failed to load compliance:', e);
    state.complianceData = null;
  }
}

export async function showPolicyBrowser() {
  await loadPolicies(state.policyFilter || null);
  state.policyView = true;
  render();
}

export function hidePolicyView() {
  state.policyView = false;
  render();
}

export async function showComplianceView() {
  if (!state.currentSession) return;
  await loadCompliance(state.currentSession.id);
  render();
}

export function filterPoliciesByProvider(provider) {
  state.policyFilter = provider;
  // Always re-render with current data — filtering happens in renderPolicyBrowser
  render();
}

// ─── Variant Groups ────────────────────────────────────────────────────────────

export async function loadVariantGroups() {
  try {
    state.variantGroups = await api('/api/probe-groups');
  } catch (e) {
    console.error('Failed to load variant groups:', e);
    state.variantGroups = [];
  }
}

export async function createVariantGroup(groupId, probeIds, labels) {
  try {
    const group = await api('/api/probe-groups', {
      method: 'POST',
      body: { group_id: groupId, probe_ids: probeIds, labels },
    });
    await loadVariantGroups();
    return group;
  } catch (e) {
    showError('Failed to create variant group: ' + e.message);
    return null;
  }
}

export async function deleteVariantGroup(groupId) {
  if (!confirm(`Delete variant group "${groupId}"?`)) return;
  try {
    await api(`/api/probe-groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
    await loadVariantGroups();
    render();
  } catch (e) {
    showError('Failed to delete variant group: ' + e.message);
  }
}

export async function loadConsistency(sessionId) {
  try {
    state.consistencyData = await api(`/api/sessions/${sessionId}/consistency`);
  } catch (e) {
    showError('Failed to load consistency: ' + e.message);
    state.consistencyData = null;
  }
}

export async function showConsistencyView() {
  if (!state.currentSession) return;
  await loadConsistency(state.currentSession.id);
  state.consistencyView = true;
  render();
}

export function hideConsistencyView() {
  state.consistencyView = false;
  render();
}

// ─── Variant Files ─────────────────────────────────────────────────────────────

export async function loadVariantFiles() {
  try {
    state.variantFiles = await api('/api/variants/files');
  } catch (e) {
    console.error('Failed to load variant files:', e);
    state.variantFiles = [];
  }
}

export async function getVariantFile(groupId) {
  try {
    return await api(`/api/variants/files/${encodeURIComponent(groupId)}`);
  } catch (e) {
    showError('Failed to load variant file: ' + e.message);
    return null;
  }
}

export async function saveVariantFile(groupId, title, description, baseProbe, domain, variants) {
  try {
    const result = await api('/api/variants/files', {
      method: 'POST',
      body: { group_id: groupId, title, description, base_probe: baseProbe, domain, variants },
    });
    await loadVariantFiles();
    await loadVariantGroups();
    await loadProbes();
    return result;
  } catch (e) {
    showError('Failed to save variant file: ' + e.message);
    return null;
  }
}

export async function deleteVariantFile(groupId) {
  if (!confirm(`Delete variant group "${groupId}" and its probes?`)) return false;
  try {
    await api(`/api/variants/files/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
    await loadVariantFiles();
    await loadVariantGroups();
    await loadProbes();
    render();
    return true;
  } catch (e) {
    showError('Failed to delete variant file: ' + e.message);
    return false;
  }
}

export async function generateVariants(probeId, strategies) {
  try {
    state.variantGenerating = true;
    render();
    const result = await api('/api/variants/generate', {
      method: 'POST',
      body: { probe_id: probeId, strategies },
    });
    state.variantGenerating = false;
    return result;
  } catch (e) {
    state.variantGenerating = false;
    showError('Failed to generate variants: ' + e.message);
    return null;
  }
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export async function saveSnapshot(sessionId, name, description) {
  try {
    const snap = await api(`/api/sessions/${sessionId}/snapshots`, {
      method: 'POST',
      body: { name, description: description || '' },
    });
    state.snapshots.unshift(snap);
    return snap;
  } catch (e) {
    showError('Failed to save snapshot: ' + e.message);
    return null;
  }
}

export async function loadSnapshots(sessionId) {
  try {
    state.snapshots = await api(`/api/sessions/${sessionId}/snapshots`);
  } catch (e) {
    console.error('Failed to load snapshots:', e);
    state.snapshots = [];
  }
}

export async function loadSnapshotDiff(snapshotId, sessionId) {
  try {
    state.snapshotDiff = await api(`/api/snapshots/${snapshotId}/diff?session_id=${sessionId}`);
    state.snapshotView = true;
    render();
  } catch (e) {
    showError('Failed to load diff: ' + e.message);
  }
}

export async function deleteSnapshot(snapshotId) {
  if (!confirm('Delete this snapshot?')) return;
  try {
    await api(`/api/snapshots/${snapshotId}`, { method: 'DELETE' });
    state.snapshots = state.snapshots.filter(s => s.id !== snapshotId);
    if (state.snapshotDiff && state.snapshotDiff.snapshot_id === snapshotId) {
      state.snapshotDiff = null;
      state.snapshotView = false;
    }
    render();
  } catch (e) {
    showError('Failed to delete snapshot: ' + e.message);
  }
}

export function hideSnapshotView() {
  state.snapshotView = false;
  state.snapshotDiff = null;
  render();
}

export async function showSaveSnapshotDialog() {
  if (!state.currentSession) return;
  const name = prompt('Snapshot name (e.g. "before-prompt-change"):');
  if (!name || !name.trim()) return;
  const description = prompt('Description (optional):') || '';
  const snap = await saveSnapshot(state.currentSession.id, name.trim(), description);
  if (snap) {
    render();
  }
}

export async function showSnapshotBrowser() {
  if (!state.currentSession) return;
  await loadSnapshots(state.currentSession.id);
  state.snapshotView = true;
  state.snapshotDiff = null;
  render();
}

// ── Narrative Momentum API ────────────────────────────────────

export async function fetchStrategies() {
  const res = await fetch('/api/strategies');
  if (!res.ok) throw new Error('Failed to fetch strategies');
  return res.json();
}

export async function createSequence(sessionId, body) {
  const res = await fetch(`/api/sessions/${sessionId}/sequences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to create sequence');
  return res.json();
}

export async function fetchSequences(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/sequences`);
  if (!res.ok) throw new Error('Failed to fetch sequences');
  return res.json();
}

export async function fetchSequence(id) {
  const res = await fetch(`/api/sequences/${id}`);
  if (!res.ok) throw new Error('Failed to fetch sequence');
  return res.json();
}

export async function deleteSequence(id) {
  const res = await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete sequence');
  return res.json();
}

export async function runSequenceAuto(id, onProgress) {
  const res = await fetch(`/api/sequences/${id}/run-auto`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run sequence');

  // SSE streaming response — parse turn-by-turn progress
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastData = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = 'message';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          data._event = eventType;
          lastData = data;
          if (onProgress) onProgress(data);
        } catch {}
        eventType = 'message';
      }
    }
  }

  return lastData;
}

export async function runSequenceTurn(id) {
  const res = await fetch(`/api/sequences/${id}/run-turn`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to run turn');
  }
  return res.json();
}

export async function dropSequenceProbe(id) {
  const res = await fetch(`/api/sequences/${id}/drop-probe`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to drop probe');
  return res.json();
}

export async function runWhittle(id) {
  const res = await fetch(`/api/sequences/${id}/whittle`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run whittling');
  return res.json();
}

export async function fetchWhittlingResults(id) {
  const res = await fetch(`/api/sequences/${id}/whittling`);
  if (!res.ok) throw new Error('Failed to fetch whittling results');
  return res.json();
}

export async function fetchTurnClassifications(id) {
  const res = await fetch(`/api/sequences/${id}/turn-classifications`);
  if (!res.ok) throw new Error('Failed to fetch turn classifications');
  return res.json();
}

export async function createSequenceBatch(sessionId, body) {
  const res = await fetch(`/api/sessions/${sessionId}/sequence-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to create batch');
  return res.json();
}

export async function fetchSequenceBatch(id) {
  const res = await fetch(`/api/sequence-batches/${id}`);
  if (!res.ok) throw new Error('Failed to fetch batch');
  return res.json();
}

export async function estimateSequenceBatch(id) {
  const res = await fetch(`/api/sequence-batches/${id}/estimate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to estimate batch');
  return res.json();
}

export async function startSequenceBatch(id, onProgress, onComplete, onError) {
  try {
    await apiStream(
      `/api/sequence-batches/${id}/start`,
      {},
      (event, data) => {
        if (event === 'progress' && onProgress) onProgress(data);
        else if (event === 'complete' && onComplete) onComplete(data);
        else if (event === 'error' && onError) onError(data);
      },
    );
  } catch (e) {
    if (onError) onError({ error: e.message });
  }
}

export async function fetchThresholds(sessionId, strategyId) {
  let url = `/api/sessions/${sessionId}/thresholds`;
  if (strategyId) url += `?strategy_id=${strategyId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch thresholds');
  return res.json();
}

export async function fetchStrategyEffectiveness(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/strategy-effectiveness`);
  if (!res.ok) throw new Error('Failed to fetch strategy effectiveness');
  return res.json();
}

// ── Settings API ──────────────────────────────────────────────

export async function fetchApiKeys() {
  const res = await fetch('/api/settings/keys');
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json();
}

export async function updateApiKeys(keys) {
  const res = await fetch('/api/settings/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keys),
  });
  if (!res.ok) throw new Error('Failed to update API keys');
  return res.json();
}

export async function testApiKey(provider) {
  const res = await fetch('/api/settings/test-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) throw new Error('Failed to test API key');
  return res.json();
}

// ─── Dashboard API ───────────────────────────────────────────────

export async function loadDashboardStats() {
  try {
    state.dashboardStats = await api('/api/dashboard/stats');
  } catch (e) {
    console.error('Failed to load dashboard stats:', e);
    state.dashboardStats = null;
  }
}

export async function loadDashboardSessions() {
  try {
    state.dashboardSessions = await api('/api/dashboard/sessions');
  } catch (e) {
    console.error('Failed to load dashboard sessions:', e);
    state.dashboardSessions = [];
  }
}

export async function loadDashboardComparisons() {
  try {
    state.dashboardComparisons = await api('/api/dashboard/comparisons');
  } catch (e) {
    console.error('Failed to load dashboard comparisons:', e);
    state.dashboardComparisons = [];
  }
}

export async function loadDashboardSequences() {
  try {
    state.dashboardSequences = await api('/api/dashboard/sequences');
  } catch (e) {
    console.error('Failed to load dashboard sequences:', e);
    state.dashboardSequences = [];
  }
}

export async function loadDashboardData() {
  await Promise.all([
    loadDashboardStats(),
    loadDashboardSessions(),
    loadDashboardComparisons(),
    loadDashboardSequences(),
  ]);
  render();
}

export function exportAllData() {
  triggerDownload('/api/dashboard/export-all');
}

export async function clearAllData() {
  try {
    const result = await api('/api/dashboard/clear-all', {
      method: 'DELETE',
      body: { confirm: 'DELETE_ALL_DATA' },
    });
    // Refresh everything
    await loadDashboardData();
    // Also refresh sidebar data
    const { loadSessions, loadStats } = await import('./api.js');
    await loadSessions();
    return result;
  } catch (e) {
    showError('Failed to clear data: ' + e.message);
    return null;
  }
}

export function exportSequenceById(sequenceId, format = 'json') {
  triggerDownload(`/api/sequences/${sequenceId}/export?format=${format}`);
}

// ─── Window bindings for onclick handlers in HTML strings ─────────────────────

window.loadPolicies = loadPolicies;
window.linkProbeClaims = linkProbeClaims;
window.unlinkProbeClaim = unlinkProbeClaim;
window.loadCompliance = loadCompliance;
window.showPolicyBrowser = showPolicyBrowser;
window.hidePolicyView = hidePolicyView;
window.showComplianceView = showComplianceView;
window.filterPoliciesByProvider = filterPoliciesByProvider;
window.loadModels = loadModels;
window.checkOllamaStatus = checkOllamaStatus;
window.testOllamaConnection = testOllamaConnection;
window.loadComparison = loadComparison;
window.loadComparisons = loadComparisons;
window.getComparison = getComparison;
window.deleteComparison = deleteComparison;
window.exportComparisonById = exportComparisonById;
window.loadVariantGroups = loadVariantGroups;
window.createVariantGroup = createVariantGroup;
window.deleteVariantGroup = deleteVariantGroup;
window.loadVariantFiles = loadVariantFiles;
window.getVariantFile = getVariantFile;
window.saveVariantFile = saveVariantFile;
window.deleteVariantFile = deleteVariantFile;
window.generateVariants = generateVariants;
window.loadConsistency = loadConsistency;
window.showConsistencyView = showConsistencyView;
window.hideConsistencyView = hideConsistencyView;
window.exportSession = exportSession;
window.exportEnhanced = exportEnhanced;
window.exportFindings = exportFindings;
window.exportAgent = exportAgent;
window.exportReport = exportReport;
window.exportComparison = exportComparison;
window.saveAnnotation = saveAnnotation;
window.toggleExportMenu = toggleExportMenu;
window.startBatch = startBatch;
window.cancelBatch = cancelBatch;
window.handleSessionChange = handleSessionChange;
window.selectProbe = selectProbe;
window.selectCustomProbe = selectCustomProbe;
window.sendProbe = sendProbe;
window.sendCustomProbe = sendCustomProbe;
window.sendPushback = sendPushback;
window.skipPushback = skipPushback;
window.promoteToExample = promoteToExample;
window.continuePushback = continuePushback;
window.nextProbe = nextProbe;
window.deleteProbe = deleteProbe;
window.bulkDeleteProbes = bulkDeleteProbes;
window.loadDefaultProbes = loadDefaultProbes;
window.showImportFileModal = async function() {
  const files = await listProbeFiles();
  let modal = document.getElementById('import-file-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'import-file-modal'; document.body.appendChild(modal); }
  const fileList = files.length === 0
    ? '<div style="color:#6b7280; padding:12px;">No probe files found in flinch/probes/</div>'
    : files.map(f => `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #1a1a1a; cursor:pointer;" onmouseover="this.style.background='#1a1a1a'" onmouseout="this.style.background='none'" onclick="window.doImportFile('${f.name}')"><span style="color:#e5e7eb; font-size:13px;">${f.name}</span><button style="font-size:11px; color:#34d399; background:none; border:1px solid #065f46; border-radius:3px; padding:2px 8px; cursor:pointer;">Import</button></div>`).join('');
  modal.innerHTML = `<div style="position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000;" onclick="if(event.target===this){document.getElementById('import-file-modal').style.display='none'}"><div style="background:#0f0f0f; border:1px solid #1a1a1a; border-radius:8px; width:400px; max-height:500px; overflow:hidden; display:flex; flex-direction:column;"><div style="padding:16px; border-bottom:1px solid #1a1a1a; display:flex; justify-content:space-between; align-items:center;"><span style="color:#e5e7eb; font-weight:600;">Import Probes from File</span><button onclick="document.getElementById('import-file-modal').style.display='none'" style="color:#6b7280; background:none; border:none; cursor:pointer; font-size:16px;">x</button></div><div style="overflow-y:auto; max-height:400px;">${fileList}</div></div></div>`;
  modal.style.display = 'block';
};
window.doImportFile = async function(filename) {
  const result = await importProbeFile(filename);
  const modal = document.getElementById('import-file-modal');
  if (modal) modal.style.display = 'none';
};
window.deleteCurrentSession = deleteCurrentSession;
window.deleteRun = deleteRun;
window.deleteCoachExample = deleteCoachExample;
window.editCoachExample = editCoachExample;
window.viewRun = viewRun;
window.saveSnapshot = saveSnapshot;
window.loadSnapshots = loadSnapshots;
window.loadSnapshotDiff = loadSnapshotDiff;
window.deleteSnapshot = deleteSnapshot;
window.hideSnapshotView = hideSnapshotView;
window.showSaveSnapshotDialog = showSaveSnapshotDialog;
window.showSnapshotBrowser = showSnapshotBrowser;
// Settings
window.fetchApiKeys = fetchApiKeys;
window.updateApiKeys = updateApiKeys;
window.testApiKey = testApiKey;
// Narrative Momentum
window.fetchStrategies = fetchStrategies;
window.createSequence = createSequence;
window.fetchSequences = fetchSequences;
window.fetchSequence = fetchSequence;
window.deleteSequence = deleteSequence;
window.runSequenceAuto = runSequenceAuto;
window.runSequenceTurn = runSequenceTurn;
window.dropSequenceProbe = dropSequenceProbe;
window.runWhittle = runWhittle;
window.fetchWhittlingResults = fetchWhittlingResults;
window.fetchTurnClassifications = fetchTurnClassifications;
window.createSequenceBatch = createSequenceBatch;
window.fetchSequenceBatch = fetchSequenceBatch;
window.estimateSequenceBatch = estimateSequenceBatch;
window.startSequenceBatch = startSequenceBatch;
window.fetchThresholds = fetchThresholds;
window.fetchStrategyEffectiveness = fetchStrategyEffectiveness;
// Dashboard
window.loadDashboardStats = loadDashboardStats;
window.loadDashboardData = loadDashboardData;
window.exportAllData = exportAllData;
window.clearAllData = clearAllData;
window.exportSequenceById = exportSequenceById;

// ── Dashboard Detail Loaders ──────────────────────────────────────────────────

export async function loadSessionDetail(sessionId) {
  state.dashboardDetail = { type: 'session', id: sessionId };
  state.dashboardDetailData = null;
  window.renderDashboard();
  try {
    const session = await api(`/api/sessions/${sessionId}`);
    // Load turns for each run
    const runs = session.runs || [];
    for (const run of runs) {
      try {
        run.turns = await api(`/api/runs/${run.id}/turns`);
      } catch (e) {
        run.turns = [];
      }
    }
    state.dashboardDetailData = session;
  } catch (e) {
    state.dashboardDetailData = { error: e.message };
  }
  window.renderDashboard();
}

export async function loadComparisonDetail(comparisonId) {
  state.dashboardDetail = { type: 'comparison', id: comparisonId };
  state.dashboardDetailData = null;
  window.renderDashboard();
  try {
    const comparison = await api(`/api/comparisons/${comparisonId}`);
    state.dashboardDetailData = comparison;
  } catch (e) {
    state.dashboardDetailData = { error: e.message };
  }
  window.renderDashboard();
}

export async function loadSequenceDetail(sequenceId) {
  state.dashboardDetail = { type: 'sequence', id: sequenceId };
  state.dashboardDetailData = null;
  window.renderDashboard();
  try {
    const sequence = await api(`/api/sequences/${sequenceId}`);
    state.dashboardDetailData = sequence;
  } catch (e) {
    state.dashboardDetailData = { error: e.message };
  }
  window.renderDashboard();
}

window.loadSessionDetail = loadSessionDetail;
window.loadComparisonDetail = loadComparisonDetail;
window.loadSequenceDetail = loadSequenceDetail;

// ─── Statistical Runs ────────────────────────────────────────────────────────

export async function startStatRun(sessionId, probeIds, repeatCount, onProgress) {
  state.statRunResults = { running: true, completed: 0, total: probeIds.length * repeatCount, failed: 0, results: [] };
  render();

  try {
    const res = await fetch(`/api/sessions/${sessionId}/stat-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe_ids: probeIds, repeat_count: repeatCount }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      let currentEvent = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === 'start') {
              state.statRunResults.running = true;
            } else if (currentEvent === 'iteration') {
              state.statRunResults.completed = (state.statRunResults.completed || 0) + 1;
              if (onProgress) onProgress(data);
            } else if (currentEvent === 'iteration_error') {
              state.statRunResults.failed = (state.statRunResults.failed || 0) + 1;
              if (onProgress) onProgress(data);
            } else if (currentEvent === 'complete') {
              state.statRunResults.running = false;
              state.statRunResults.summary = data;
            } else if (currentEvent === 'batch_start') {
              state.statRunResults.batchRunning = true;
            } else if (currentEvent === 'batch_complete') {
              state.statRunResults.batchRunning = false;
              state.statRunResults.running = false;
            } else if (currentEvent === 'error') {
              state.statRunResults.running = false;
              showError('Stat run error: ' + (data.message || 'Unknown error'));
            }
            render();
          } catch (_) {}
          currentEvent = null;
        }
      }
    }

    state.statRunResults.running = false;
    render();
    return state.statRunResults;
  } catch (e) {
    state.statRunResults.running = false;
    showError('Stat run failed: ' + e.message);
    render();
    throw e;
  }
}

export async function getSessionStatRuns(sessionId) {
  try {
    return await api(`/api/sessions/${sessionId}/stat-runs`);
  } catch (e) {
    showError('Failed to load stat runs: ' + e.message);
    throw e;
  }
}

export async function getStatRunDetail(statRunId) {
  try {
    return await api(`/api/stat-runs/${statRunId}`);
  } catch (e) {
    showError('Failed to load stat run detail: ' + e.message);
    throw e;
  }
}

// ─── Policy Scorecard ────────────────────────────────────────────────────────

export async function generateScorecard(name, models, sessionIds, statRunIds) {
  try {
    const result = await api('/api/scorecard/generate', {
      method: 'POST',
      body: { name, models, session_ids: sessionIds, stat_run_ids: statRunIds },
    });
    state.scorecardData = result;
    render();
    return result;
  } catch (e) {
    showError('Failed to generate scorecard: ' + e.message);
    throw e;
  }
}

export async function listScorecards() {
  try {
    return await api('/api/scorecards');
  } catch (e) {
    showError('Failed to load scorecards: ' + e.message);
    throw e;
  }
}

// ─── Publication Export ──────────────────────────────────────────────────────

export async function generatePublicationExport(name, format, template, filters, theme) {
  try {
    const body = { name, format, template, filters };
    if (theme) body.theme = theme;
    const result = await api('/api/publication/export', {
      method: 'POST',
      body,
    });
    state.publicationExport = result;
    render();
    return result;
  } catch (e) {
    showError('Failed to generate export: ' + e.message);
    throw e;
  }
}

export async function downloadPublicationExport(exportId) {
  try {
    const res = await fetch(`/api/publication/exports/${exportId}/download`);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flinch-export-${exportId}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    showError('Download failed: ' + e.message);
    throw e;
  }
}

// ─── Theme API ────────────────────────────────────────────────────────────────

export async function fetchThemes() {
  const resp = await fetch('/api/themes');
  if (!resp.ok) throw new Error('Failed to fetch themes');
  return resp.json();
}

export async function fetchTheme(name) {
  const resp = await fetch(`/api/themes/${encodeURIComponent(name)}`);
  if (!resp.ok) throw new Error(`Failed to fetch theme: ${name}`);
  return resp.json();
}

// ─── Condition Comparison ─────────────────────────────────────────────────────

export async function getConditionComparison(experimentId) {
  return api(`/api/experiments/${experimentId}/condition-comparison`);
}

export async function triggerComputeMetrics(experimentId, onProgress) {
  const res = await fetch(`/api/experiments/${experimentId}/metrics`, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Metrics failed: ${text}`);
  }
  // metrics endpoint is SSE — drain it
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (onProgress) onProgress(data);
        } catch (_) {}
      }
    }
  }
}

export async function triggerRunAnalysis(experimentId) {
  return api(`/api/experiments/${experimentId}/analyze`, { method: 'POST' });
}

export function exportConditionCSV(experimentId) {
  triggerDownload(`/api/experiments/${experimentId}/condition-export`);
}

window.getConditionComparison = getConditionComparison;
window.triggerComputeMetrics = triggerComputeMetrics;
window.triggerRunAnalysis = triggerRunAnalysis;
window.exportConditionCSV = exportConditionCSV;
