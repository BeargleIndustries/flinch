// ─── Flinch — Settings Modal ─────────────────────────────────────────────────
// Manages API key configuration UI.
// Never displays raw key values — boolean status only.

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai',    label: 'OpenAI' },
  { id: 'google',    label: 'Google' },
  { id: 'xai',       label: 'xAI' },
  { id: 'together',  label: 'Together' },
];

let _modalVisible = false;

// ─── Public API ───────────────────────────────────────────────────────────────

export function showSettingsModal() {
  const modal = _getOrCreateModal();
  modal.style.display = 'flex';
  _modalVisible = true;
  _refreshKeys();
}

export function hideSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.style.display = 'none';
  _modalVisible = false;
}

/** Call on page load: if ALL providers unconfigured, auto-show. */
export async function checkAndShowIfNoKeys() {
  try {
    const status = await _fetchKeyStatus(); // {provider: bool}
    const allFalse = Object.values(status).every(v => !v);
    if (allFalse) showSettingsModal();
  } catch (_) {
    // Non-fatal — skip auto-show on fetch failure
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _fetchKeyStatus() {
  // Existing endpoint returns [{provider, is_set, masked, ...}, ...]
  const res = await fetch('/api/settings/keys');
  if (!res.ok) throw new Error('Failed to fetch key status');
  const data = await res.json();
  // Normalize to {provider: bool} map
  const map = {};
  if (Array.isArray(data)) {
    for (const item of data) map[item.provider] = !!item.is_set;
  } else {
    // Fallback: object with boolean values
    for (const [k, v] of Object.entries(data)) map[k] = !!v;
  }
  return map;
}

async function _refreshKeys() {
  const body = document.getElementById('settings-modal-body');
  if (!body) return;
  body.innerHTML = '<p style="color:#999;font-size:13px;">Loading...</p>';
  try {
    const status = await _fetchKeyStatus();
    body.innerHTML = '';
    for (const p of PROVIDERS) {
      body.appendChild(_renderProvider(p, status[p.id] || false));
    }
  } catch (e) {
    body.innerHTML = `<p style="color:#ef4444;font-size:13px;">Error: ${e.message}</p>`;
  }
}

function _renderProvider(provider, configured) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1a1a1a;';

  const label = document.createElement('span');
  label.style.cssText = 'flex:1;color:#e0e0e0;font-size:13px;font-family:monospace;';
  label.textContent = provider.label + ':';

  const status = document.createElement('span');
  status.style.cssText = `font-size:12px;${configured ? 'color:#22c55e;' : 'color:#999;'}`;
  status.textContent = configured ? 'Configured ✓' : 'Not configured';

  const btn = document.createElement('button');
  btn.textContent = configured ? 'Replace' : 'Add Key';
  btn.style.cssText = 'background:#1a1a1a;border:1px solid #333;color:#e0e0e0;padding:4px 10px;border-radius:4px;font-size:12px;cursor:pointer;';
  btn.onclick = () => _showKeyInput(provider, row);

  row.appendChild(label);
  row.appendChild(status);
  row.appendChild(btn);
  return row;
}

function _showKeyInput(provider, container) {
  // Remove any existing input in container
  const existing = container.querySelector('.key-input-row');
  if (existing) existing.remove();

  const inTauri = !!(window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke);

  const inputRow = document.createElement('div');
  inputRow.className = 'key-input-row';
  inputRow.style.cssText = 'width:100%;margin-top:8px;';

  if (inTauri) {
    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = `Enter ${provider.label} API key...`;
    input.style.cssText = 'width:100%;background:#0a0a0a;border:1px solid #333;color:#e0e0e0;padding:6px 10px;border-radius:4px;font-size:12px;font-family:monospace;box-sizing:border-box;';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'margin-top:6px;background:#4a9eff;border:none;color:#fff;padding:5px 14px;border-radius:4px;font-size:12px;cursor:pointer;';
    saveBtn.onclick = () => _saveKeyTauri(provider.id, input.value.trim(), inputRow);

    inputRow.appendChild(input);
    inputRow.appendChild(saveBtn);
  } else {
    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:12px;color:#999;background:#0f0f0f;border:1px solid #1a1a1a;padding:10px;border-radius:4px;margin:0;font-family:monospace;line-height:1.6;';
    const envVar = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', google: 'GOOGLE_API_KEY', xai: 'XAI_API_KEY', together: 'TOGETHER_API_KEY' }[provider.id] || `${provider.id.toUpperCase()}_API_KEY`;
    msg.innerHTML = `Set the <code style="color:#4a9eff;">${envVar}</code> environment variable and restart the dev server.`;
    inputRow.appendChild(msg);
  }

  container.appendChild(inputRow);
}

async function _saveKeyTauri(providerId, key, inputRow) {
  if (!key) return;

  const errEl = inputRow.querySelector('.save-error');
  if (errEl) errEl.remove();

  // Optional: validate before saving
  try {
    const res = await fetch('/api/settings/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, key }),
    });
    const data = await res.json();
    if (!data.valid) {
      _showInputError(inputRow, `Validation failed: ${data.error || 'invalid key'}`);
      return;
    }
  } catch (_) {
    // Validation endpoint unavailable — proceed anyway
  }

  try {
    const runtimeRes = await fetch('/api/settings/set-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, key }),
    });
    const runtimeData = await runtimeRes.json().catch(() => ({}));
    if (!runtimeData.ok) {
      _showInputError(inputRow, `Runtime update failed: ${runtimeData.error || 'unknown'}`);
      return;
    }
  } catch (e) {
    _showInputError(inputRow, `Runtime update failed: ${e}`);
    return;
  }

  try {
    const invoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (invoke) {
      await invoke('set_api_key', { provider: providerId, key });
    }
    _refreshKeys();
    // Clear the stale "No X key set" banner that was rendered at page load.
    const warning = document.getElementById('anthropic-key-warning');
    if (warning) warning.remove();
  } catch (e) {
    _showInputError(inputRow, `Persisted save failed (runtime key IS active for this session): ${e}`);
  }
}

function _showInputError(container, msg) {
  let errEl = container.querySelector('.save-error');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.className = 'save-error';
    errEl.style.cssText = 'font-size:12px;color:#ef4444;margin:4px 0 0;';
    container.appendChild(errEl);
  }
  errEl.textContent = msg;
}

function _getOrCreateModal() {
  let modal = document.getElementById('settings-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;';
  modal.addEventListener('click', e => { if (e.target === modal) hideSettingsModal(); });

  const box = document.createElement('div');
  box.style.cssText = 'background:#0f0f0f;border:1px solid #1a1a1a;border-radius:8px;padding:24px;width:420px;max-width:90vw;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
  const title = document.createElement('h2');
  title.textContent = 'API Keys';
  title.style.cssText = 'margin:0;font-size:15px;color:#e0e0e0;font-family:monospace;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:#999;font-size:16px;cursor:pointer;';
  closeBtn.onclick = hideSettingsModal;
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.id = 'settings-modal-body';

  box.appendChild(header);
  box.appendChild(body);
  modal.appendChild(box);
  document.body.appendChild(modal);

  return modal;
}
