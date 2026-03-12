// ─── Flinch — Entry Point ─────────────────────────────────────────────────────

import { state } from './state.js';
import { loadSessions, loadProbes, loadPatternTags, loadModels, loadVariantGroups, checkOllamaStatus } from './api.js';
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
}

function handleCoachBackendChange(value) {
  const localSection = document.getElementById('modal-coach-local-section');
  if (localSection) localSection.style.display = value === 'local' ? 'block' : 'none';
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('new-session-modal')) {
    closeNewSessionModal();
  }
}

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
  try {
    await createSession(name, model, coach, systemPrompt, coachBackend, coachModel);
    closeNewSessionModal();
  } catch (e) {
    showError('Failed to create session: ' + e.message);
  }
}

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
  await loadSessions();
  await loadProbes();
  await loadPatternTags();
  await loadModels();
  await loadVariantGroups();
  render();
  initKeyboardShortcuts();
  // Check Ollama in background — non-blocking
  checkOllamaStatus();
}

init();
