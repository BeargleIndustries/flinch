// ─── Flinch — Entry Point ─────────────────────────────────────────────────────

import { state } from './state.js';
import { api, loadSessions, loadProbes, loadPatternTags, loadModels, loadVariantGroups, loadVariantFiles, checkOllamaStatus } from './api.js';
import { render } from './render.js';
import { initKeyboardShortcuts } from './shortcuts.js';
import { showError } from './components.js';

// ─── Modal / form helpers (need window binding for inline onclick) ────────────

async function showNewSessionModal() {
  document.getElementById('new-session-modal').style.display = 'flex';
  // Pre-fill coach backend from saved default
  try {
    const { loadCoachDefault } = await import('./api.js');
    const defaults = await loadCoachDefault();
    const backendSel = document.getElementById('modal-coach-backend');
    if (backendSel && defaults.backend) {
      backendSel.value = defaults.backend;
      handleCoachBackendChange(defaults.backend);
    }
    if (defaults.backend === 'local' && defaults.model) {
      const modelSel = document.getElementById('modal-coach-model');
      if (modelSel) modelSel.value = defaults.model;
    }
  } catch (_) {}
  // Populate probe picker with all probes, all selected by default
  _modalProbeSearch = '';
  _modalSelectedProbeIds = null; // null = all selected (default)
  renderModalProbeList();
  setTimeout(() => document.getElementById('modal-session-name').focus(), 50);
}

function closeNewSessionModal() {
  document.getElementById('new-session-modal').style.display = 'none';
  document.getElementById('modal-session-name').value = '';
  document.getElementById('modal-session-coach').value = '';
  document.getElementById('modal-session-system').value = '';
  const backendSel = document.getElementById('modal-coach-backend');
  if (backendSel) backendSel.value = 'anthropic';
  const localSection = document.getElementById('modal-coach-local-section');
  if (localSection) localSection.style.display = 'none';
  // Reset probe picker
  _modalProbeSearch = '';
  _modalSelectedProbeIds = null;
  const picker = document.getElementById('modal-probe-picker');
  if (picker) picker.style.display = 'none';
  const summary = document.getElementById('modal-probe-picker-summary');
  if (summary) summary.textContent = 'All probes';
  const searchEl = document.getElementById('modal-probe-search');
  if (searchEl) searchEl.value = '';
}

function handleCoachBackendChange(value) {
  const localSection = document.getElementById('modal-coach-local-section');
  if (localSection) localSection.style.display = value === 'local' ? 'block' : 'none';
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('new-session-modal')) {
    closeNewSessionModal();
  }
  if (e.target === document.getElementById('import-file-modal')) {
    closeImportFileModal();
  }
}

async function showImportFileModal() {
  const { listProbeFiles } = await import('./api.js');
  const files = await listProbeFiles();

  let modal = document.getElementById('import-file-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'import-file-modal';
    modal.onclick = closeModalOnOverlay;
    document.body.appendChild(modal);
  }

  const fileList = files.length === 0
    ? '<div style="color:#6b7280; padding:12px;">No probe files found in flinch/probes/</div>'
    : files.map(f => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #1a1a1a; cursor:pointer;"
             onmouseover="this.style.background='#1a1a1a'" onmouseout="this.style.background='none'"
             onclick="doImportFile('${f.name}')">
          <span style="color:#e5e7eb; font-size:13px;">${f.name}</span>
          <button style="font-size:11px; color:#34d399; background:none; border:1px solid #065f46; border-radius:3px; padding:2px 8px; cursor:pointer;">Import</button>
        </div>`).join('');

  modal.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000;">
      <div style="background:#0f0f0f; border:1px solid #1a1a1a; border-radius:8px; width:400px; max-height:500px; overflow:hidden; display:flex; flex-direction:column;">
        <div style="padding:16px; border-bottom:1px solid #1a1a1a; display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#e5e7eb; font-weight:600;">Import Probes from File</span>
          <button onclick="closeImportFileModal()" style="color:#6b7280; background:none; border:none; cursor:pointer; font-size:16px;">x</button>
        </div>
        <div style="overflow-y:auto; max-height:400px;">
          ${fileList}
        </div>
      </div>
    </div>`;
  modal.style.display = 'block';
}

function closeImportFileModal() {
  const modal = document.getElementById('import-file-modal');
  if (modal) modal.style.display = 'none';
}

async function doImportFile(filename) {
  const { importProbeFile } = await import('./api.js');
  const result = await importProbeFile(filename);
  closeImportFileModal();
  if (result) {
    const msg = `Imported ${result.loaded} probes from ${filename} (${result.total} total)`;
    const el = document.getElementById('status-message');
    if (el) { el.textContent = msg; el.style.color = '#34d399'; }
  }
}

window.showImportFileModal = showImportFileModal;
window.closeImportFileModal = closeImportFileModal;
window.doImportFile = doImportFile;

async function submitNewSession() {
  const { createSession } = await import('./api.js');
  const name = document.getElementById('modal-session-name').value.trim();
  const model = document.getElementById('modal-session-model').value.trim();
  const coach = document.getElementById('modal-session-coach').value.trim();
  const systemPrompt = document.getElementById('modal-session-system').value.trim();
  const coachBackend = document.getElementById('modal-coach-backend')?.value || 'anthropic';
  const coachModel = coachBackend === 'local' ? (document.getElementById('modal-coach-model')?.value || '') : '';
  if (!name || !model) {
    showError('Session name and target model are required.');
    return;
  }
  if (coachBackend === 'local' && !coachModel) {
    showError('Select a local model for the coach, or switch to Claude.');
    return;
  }
  // Collect probe_ids — null means "all", otherwise pass the selected set
  const probeIds = _modalSelectedProbeIds === null ? null : [..._modalSelectedProbeIds];
  try {
    await createSession(name, model, coach, systemPrompt, coachBackend, coachModel, probeIds);
    closeNewSessionModal();
  } catch (e) {
    showError('Failed to create session: ' + e.message);
  }
}

// ─── Probe picker state & helpers ────────────────────────────────────────────

let _modalProbeSearch = '';
let _modalSelectedProbeIds = null; // null = all probes; Set<int> = explicit selection

function _getModalFilteredProbes() {
  const q = _modalProbeSearch.toLowerCase();
  return state.probes.filter(p => {
    if (!q) return true;
    return (p.name || '').toLowerCase().includes(q) ||
           (p.prompt_text || '').toLowerCase().includes(q) ||
           (p.domain || '').toLowerCase().includes(q);
  });
}

function _updateModalProbeSummary() {
  const summary = document.getElementById('modal-probe-picker-summary');
  if (!summary) return;
  if (_modalSelectedProbeIds === null) {
    summary.textContent = 'All probes';
    summary.style.color = '#4b5563';
  } else {
    const count = _modalSelectedProbeIds.size;
    const total = state.probes.filter(p => p.id !== 'custom').length;
    if (count === 0) {
      summary.textContent = 'No probes selected';
      summary.style.color = '#f87171';
    } else if (count === total) {
      summary.textContent = 'All probes';
      summary.style.color = '#4b5563';
    } else {
      summary.textContent = `${count} / ${total} selected`;
      summary.style.color = '#3b82f6';
    }
  }
}

function renderModalProbeList() {
  const container = document.getElementById('modal-probe-list');
  if (!container) return;

  const probes = _getModalFilteredProbes().filter(p => p.id !== 'custom');
  if (!probes.length) {
    container.innerHTML = '<div style="padding:12px 10px; font-size:11px; color:#4b5563; font-family:\'JetBrains Mono\',monospace;">No probes match.</div>';
    _updateModalProbeSummary();
    return;
  }

  // Group by domain
  const groups = {};
  for (const p of probes) {
    const d = p.domain || 'uncategorized';
    if (!groups[d]) groups[d] = [];
    groups[d].push(p);
  }

  const allRealIds = state.probes.filter(p => p.id !== 'custom').map(p => p.id);

  let html = '';
  for (const domain of Object.keys(groups).sort()) {
    const domainProbes = groups[domain];
    const domainIds = domainProbes.map(p => p.id);
    const allChecked = _modalSelectedProbeIds === null
      ? true
      : domainIds.every(id => _modalSelectedProbeIds.has(id));

    html += `<div style="padding:4px 8px 2px 8px; font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#4b5563; font-family:'JetBrains Mono',monospace; display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;"
      onclick="modalProbeToggleDomain(${JSON.stringify(domainIds)})">
      <input type="checkbox" ${allChecked ? 'checked' : ''} onclick="event.stopPropagation(); modalProbeToggleDomain(${JSON.stringify(domainIds)})" style="cursor:pointer;" />
      ${domain}
    </div>`;

    for (const p of domainProbes) {
      const checked = _modalSelectedProbeIds === null || _modalSelectedProbeIds.has(p.id);
      html += `<label style="display:flex; align-items:flex-start; gap:7px; padding:3px 8px 3px 22px; cursor:pointer; font-size:12px; font-family:'JetBrains Mono',monospace; color:#9ca3af; line-height:1.4;"
        onmouseenter="this.style.background='#111'" onmouseleave="this.style.background=''"
        onclick="event.preventDefault(); modalProbeToggle(${p.id})">
        <input type="checkbox" ${checked ? 'checked' : ''} style="margin-top:2px; cursor:pointer; flex-shrink:0;" />
        <span>${p.name}</span>
      </label>`;
    }
  }

  container.innerHTML = html;
  _updateModalProbeSummary();
}

window.toggleProbePickerSection = function() {
  const picker = document.getElementById('modal-probe-picker');
  if (!picker) return;
  const open = picker.style.display !== 'none';
  picker.style.display = open ? 'none' : 'block';
  if (!open) renderModalProbeList();
};

window.filterModalProbes = function(value) {
  _modalProbeSearch = value;
  renderModalProbeList();
};

window.modalProbeToggle = function(probeId) {
  // Initialize from "all" if needed
  if (_modalSelectedProbeIds === null) {
    _modalSelectedProbeIds = new Set(state.probes.filter(p => p.id !== 'custom').map(p => p.id));
  }
  if (_modalSelectedProbeIds.has(probeId)) {
    _modalSelectedProbeIds.delete(probeId);
  } else {
    _modalSelectedProbeIds.add(probeId);
  }
  renderModalProbeList();
};

window.modalProbeToggleDomain = function(domainIds) {
  if (_modalSelectedProbeIds === null) {
    _modalSelectedProbeIds = new Set(state.probes.filter(p => p.id !== 'custom').map(p => p.id));
  }
  const allChecked = domainIds.every(id => _modalSelectedProbeIds.has(id));
  if (allChecked) {
    domainIds.forEach(id => _modalSelectedProbeIds.delete(id));
  } else {
    domainIds.forEach(id => _modalSelectedProbeIds.add(id));
  }
  renderModalProbeList();
};

window.modalProbeSelectAll = function() {
  _modalSelectedProbeIds = null; // null = all
  const searchEl = document.getElementById('modal-probe-search');
  if (searchEl) { searchEl.value = ''; _modalProbeSearch = ''; }
  renderModalProbeList();
};

window.modalProbeSelectNone = function() {
  _modalSelectedProbeIds = new Set();
  renderModalProbeList();
};

function toggleAddProbeForm() {
  const form = document.getElementById('add-probe-form');
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) {
    setTimeout(() => document.getElementById('new-probe-name').focus(), 50);
  }
}

async function submitAddProbe() {
  const { createProbe } = await import('./api.js');
  const name = document.getElementById('new-probe-name').value.trim();
  const domain = document.getElementById('new-probe-domain').value.trim();
  const promptText = document.getElementById('new-probe-prompt').value.trim();
  const tagsRaw = document.getElementById('new-probe-tags').value.trim();
  const isNarrative = document.getElementById('new-probe-narrative')?.checked;
  const narrativeOpening = document.getElementById('new-probe-narrative-opening')?.value.trim() || null;
  const narrativeTarget = document.getElementById('new-probe-narrative-target')?.value.trim() || null;

  if (!name || !domain || !promptText) {
    showError('Name, domain, and prompt text are required.');
    return;
  }
  if (isNarrative && (!narrativeOpening || !narrativeTarget)) {
    showError('Narrative probes require both an opening and a target.');
    return;
  }
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const body = { name, domain, prompt_text: promptText, tags };
  if (isNarrative) {
    body.narrative_opening = narrativeOpening;
    body.narrative_target = narrativeTarget;
  }
  try {
    await createProbe(body);
    document.getElementById('new-probe-name').value = '';
    document.getElementById('new-probe-domain').value = '';
    document.getElementById('new-probe-prompt').value = '';
    document.getElementById('new-probe-tags').value = '';
    if (document.getElementById('new-probe-narrative')) {
      document.getElementById('new-probe-narrative').checked = false;
      document.getElementById('new-probe-narrative-opening').value = '';
      document.getElementById('new-probe-narrative-target').value = '';
      document.getElementById('narrative-fields').style.display = 'none';
    }
    document.getElementById('add-probe-form').style.display = 'none';
    render();
  } catch (e) {
    showError('Failed to create probe: ' + e.message);
  }
}

// ─── Window bindings for inline onclick handlers in HTML ──────────────────────

window.showNewSessionModal = showNewSessionModal;
window.closeNewSessionModal = closeNewSessionModal;
window.closeModalOnOverlay = closeModalOnOverlay;
window.submitNewSession = submitNewSession;
window.handleCoachBackendChange = handleCoachBackendChange;
window.toggleAddProbeForm = toggleAddProbeForm;
window.submitAddProbeForm = submitAddProbe;
window.submitAddProbe = submitAddProbe;

// Expose state globally for inline oninput handlers (e.g. pushback textarea)
window.state = state;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  // Fetch version
  try {
    state.appVersion = (await api('/api/version')).version;
    const el = document.getElementById('app-version');
    if (el) el.textContent = `v${state.appVersion}`;
  } catch (_) {}
  await loadSessions();
  await loadProbes();
  await loadPatternTags();
  await loadModels();
  await loadVariantGroups();
  await loadVariantFiles();
  render();
  initKeyboardShortcuts();
  // Check Ollama in background — non-blocking
  checkOllamaStatus();
}

init();
