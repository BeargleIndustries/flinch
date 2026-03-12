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

export async function createSession(name, targetModel, coachProfile, systemPrompt) {
  const session = await api('/api/sessions', {
    method: 'POST',
    body: { name, target_model: targetModel, coach_profile: coachProfile || 'standard', system_prompt: systemPrompt || '' },
  });
  state.sessions.push(session);
  state.currentSession = session;
  state.currentProbe = null;
  state.currentRun = null;
  state.phase = 'idle';
  state.stats = null;
  renderSessionSelect();
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

function triggerDownload(url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
      const label = provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1);
      group.label = provider.available ? label : `${label} (${provider.hint || 'unavailable'})`;
      for (const m of provider.models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        opt.disabled = !provider.available;
        group.appendChild(opt);
      }
      select.appendChild(group);
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

export async function loadComparison(sessionIds) {
  try {
    return await api(`/api/compare?session_ids=${sessionIds.join(',')}`);
  } catch (e) {
    showError('Failed to load comparison: ' + e.message);
    return null;
  }
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
  if (!res.ok) throw new Error('Failed to run turn');
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
window.loadComparison = loadComparison;
window.loadVariantGroups = loadVariantGroups;
window.createVariantGroup = createVariantGroup;
window.deleteVariantGroup = deleteVariantGroup;
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
window.loadDefaultProbes = loadDefaultProbes;
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
