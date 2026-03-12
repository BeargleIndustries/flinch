// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

import { state } from './state.js';

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Always handle Escape
    if (e.key === 'Escape') {
      const help = document.getElementById('shortcut-help');
      if (help) {
        help.remove();
        return;
      }
      const modal = document.getElementById('new-session-modal');
      if (modal && modal.style.display !== 'none') {
        window.closeNewSessionModal?.();
        return;
      }
      const form = document.getElementById('add-probe-form');
      if (form && form.style.display !== 'none') {
        window.toggleAddProbeForm?.();
        return;
      }
    }

    // Enter to submit session modal
    if (e.key === 'Enter') {
      const modal = document.getElementById('new-session-modal');
      if (modal && modal.style.display !== 'none') {
        const active = document.activeElement;
        if (active && active.tagName !== 'TEXTAREA') {
          window.submitNewSession?.();
          return;
        }
      }
    }

    // Skip if focused on input/textarea/select (except for arrow keys, ? and Escape which are handled above)
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // ? — show help
    if (e.key === '?') {
      e.preventDefault();
      toggleShortcutHelp();
      return;
    }

    // Phase-specific shortcuts
    const phase = state.phase;

    if (e.key === 's' && phase === 'probe_selected') {
      e.preventDefault();
      window.sendProbe?.();
    }
    if (e.key === 'p' && phase === 'pushback_decision') {
      e.preventDefault();
      window.sendPushback?.('coach');
    }
    if (e.key === 'k' && phase === 'pushback_decision') {
      e.preventDefault();
      window.skipPushback?.();
    }
    if (e.key === 'n' && (phase === 'response' || phase === 'pushback_sent')) {
      e.preventDefault();
      window.nextProbe?.();
    }
    if (e.key === 'r' && (phase === 'response' || phase === 'pushback_sent')) {
      e.preventDefault();
      window.resetToProbe?.();
    }

    // Arrow keys for probe navigation
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && state.probes.length > 0) {
      e.preventDefault();
      navigateProbes(e.key === 'ArrowUp' ? -1 : 1);
    }
  });
}

function navigateProbes(direction) {
  const currentIdx = state.currentProbe
    ? state.probes.findIndex(p => p.id === state.currentProbe.id)
    : -1;
  let newIdx = currentIdx + direction;
  if (newIdx < 0) newIdx = state.probes.length - 1;
  if (newIdx >= state.probes.length) newIdx = 0;
  window.selectProbe?.(state.probes[newIdx].id);
}

function toggleShortcutHelp() {
  const existing = document.getElementById('shortcut-help');
  if (existing) {
    existing.remove();
    return;
  }

  const shortcuts = [
    ['S', 'Send probe'],
    ['P', 'Send pushback (coach)'],
    ['K', 'Skip pushback'],
    ['N', 'Next probe'],
    ['R', 'Re-run probe'],
    ['↑ / ↓', 'Navigate probes'],
    ['Esc', 'Close modal / overlay'],
    ['Enter', 'Submit modal'],
    ['?', 'Toggle this help'],
  ];

  const overlay = document.createElement('div');
  overlay.id = 'shortcut-help';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:50;';
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  const card = document.createElement('div');
  card.style.cssText = 'background:#161922; border:1px solid #252a35; border-radius:8px; padding:24px; width:360px; max-width:95vw;';

  let html = '<div style="font-weight:600; font-size:15px; margin-bottom:16px; color:#f1f5f9;">Keyboard Shortcuts</div>';
  html += '<div style="display:flex; flex-direction:column; gap:8px;">';
  for (const [key, desc] of shortcuts) {
    html += `<div style="display:flex; align-items:center; gap:12px;">
      <span style="min-width:60px; text-align:center; padding:3px 8px; background:#0d0f16; border:1px solid #374151; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:12px; color:#e2e8f0; font-weight:500;">${key}</span>
      <span style="font-size:13px; color:#94a3b8;">${desc}</span>
    </div>`;
  }
  html += '</div>';
  html += '<div style="margin-top:16px; font-size:11px; color:#4b5563; font-family:\'JetBrains Mono\',monospace;">Press ? or Esc to close</div>';

  card.innerHTML = html;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
