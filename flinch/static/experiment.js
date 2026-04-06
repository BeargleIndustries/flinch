// ─── Flinch — Experiment Dashboard ───────────────────────────────────────────
// ES module — no build step. Called by app.js when Experiments tab is selected.

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  draft:     { bg: 'rgba(102,102,102,0.12)', color: '#999',    border: 'rgba(102,102,102,0.25)' },
  running:   { bg: 'rgba(33,150,243,0.12)',  color: '#64b5f6', border: 'rgba(33,150,243,0.3)'  },
  paused:    { bg: 'rgba(255,152,0,0.12)',   color: '#ffb74d', border: 'rgba(255,152,0,0.3)'   },
  completed: { bg: 'rgba(76,175,80,0.12)',   color: '#81c784', border: 'rgba(76,175,80,0.3)'   },
  failed:    { bg: 'rgba(244,67,54,0.12)',   color: '#e57373', border: 'rgba(244,67,54,0.3)'   },
};

const CONDITION_COLORS = {
  honest:            '#4CAF50',
  deceptive:         '#f44336',
  neutral:           '#2196F3',
  high_effort_honest:'#FF9800',
};

const PAGE_SIZE = 50;

// ─── SSE handle (module-level for cross-call cleanup) ─────────────────────────

let activeSSE = null;

// ─── State ────────────────────────────────────────────────────────────────────

const expState = {
  view: 'list',          // 'list' | 'create' | 'dashboard' | 'results' | 'analysis' | 'export'
  experiments: [],
  currentExp: null,
  resultsPage: 0,
  resultsFilter: { model: '', condition: '', status: '' },
  resultRows: [],
  resultTotal: 0,
  sseSource: null,
  createStep: 1,
  draftExp: {
    name: '',
    description: '',
    conditions: [],
    models: [],
    probe_set_ids: [],
    repetitions: 1,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadge(status) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return `<span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;background:${s.bg};color:${s.color};border:1px solid ${s.border};">${esc(status)}</span>`;
}

function conditionBadge(cond) {
  const color = CONDITION_COLORS[cond] || '#999';
  return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;background:${color}1a;color:${color};border:1px solid ${color}33;">${esc(cond)}</span>`;
}

function progressBar(pct, color) {
  return `<div style="height:4px;border-radius:2px;background:#1a1a1a;overflow:hidden;margin:3px 0;">
    <div style="height:100%;width:${Math.min(100, pct)}%;background:${color};border-radius:2px;transition:width 0.4s ease;"></div>
  </div>`;
}

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

function fmtPct(n) {
  if (n == null) return '—';
  return (Number(n) * 100).toFixed(1) + '%';
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) { return iso; }
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(txt || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return res.text();
}

function showMsg(container, msg, isError = false) {
  const color = isError ? '#e57373' : '#81c784';
  const banner = document.createElement('div');
  banner.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;background:#141414;border:1px solid ${color}44;border-radius:8px;font-size:13px;color:${color};z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;
  banner.textContent = msg;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 3000);
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

function startProgressSSE(expId, container) {
  if (activeSSE) { activeSSE.close(); activeSSE = null; }
  if (expState.sseSource) {
    expState.sseSource.close();
    expState.sseSource = null;
  }
  const src = new EventSource(`/api/experiments/${expId}/progress`);
  activeSSE = src;
  expState.sseSource = src;

  src.addEventListener('progress', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateProgressUI(container, data);
    } catch (_) {}
  });

  src.addEventListener('complete', () => {
    src.close();
    activeSSE = null;
    expState.sseSource = null;
    loadExperiment(expId, container);
  });

  src.onerror = () => {
    src.close();
    activeSSE = null;
    expState.sseSource = null;
  };
}

function updateProgressUI(container, data) {
  // Update per-condition progress bars
  if (data.conditions) {
    for (const [cond, info] of Object.entries(data.conditions)) {
      const bar = container.querySelector(`[data-progress-cond="${cond}"]`);
      if (bar && info.total > 0) {
        const pct = (info.completed / info.total) * 100;
        bar.style.width = pct + '%';
      }
      const label = container.querySelector(`[data-progress-label="${cond}"]`);
      if (label && info.total > 0) {
        label.textContent = `${info.completed} / ${info.total}`;
      }
    }
  }
  // Update overall count
  const overallEl = container.querySelector('[data-progress-overall]');
  if (overallEl && data.total_completed != null) {
    overallEl.textContent = `${data.total_completed} / ${data.total_trials} responses collected`;
  }
}

// ─── Views ────────────────────────────────────────────────────────────────────

function renderExperimentList(container) {
  const exps = expState.experiments;

  container.innerHTML = `
    <div class="fade-in" style="max-width:960px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;">
        <div>
          <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#e0e0e0;margin:0 0 4px;">Experiments</h1>
          <div style="font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            Design, run, and analyze multi-condition probe experiments
          </div>
        </div>
        <button onclick="window._expUI.showCreate()" class="btn-primary" style="font-size:13px;padding:9px 20px;">
          + New Experiment
        </button>
      </div>

      ${exps.length === 0 ? renderEmptyState() : renderExpCards(exps)}
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div style="text-align:center;padding:80px 20px;">
      <div style="width:48px;height:48px;margin:0 auto 20px;position:relative;">
        <div style="position:absolute;inset:0;border:1px solid #1a1a1a;border-radius:50%;"></div>
        <div style="position:absolute;inset:8px;border:1px solid #222;border-radius:50%;"></div>
        <div style="position:absolute;top:50%;left:50%;width:5px;height:5px;background:#333;border-radius:50%;transform:translate(-50%,-50%);"></div>
      </div>
      <div style="font-size:13px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:8px;">No experiments yet</div>
      <div style="font-size:11px;color:#333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Create one to run controlled multi-condition probe studies</div>
    </div>
  `;
}

function renderExpCards(exps) {
  return `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${exps.map(exp => `
        <div class="card" style="cursor:pointer;padding:18px 20px;" onclick="window.openConditionDashboard(${exp.id})">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span style="font-size:14px;font-weight:600;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${esc(exp.name)}</span>
                ${statusBadge(exp.status)}
              </div>
              ${exp.description ? `<div style="font-size:12px;color:#666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:10px;line-height:1.5;">${esc(exp.description)}</div>` : ''}
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                ${(exp.conditions || []).map(c => conditionBadge(c.name || c)).join('')}
                ${(exp.models || []).map(m => `<span style="font-size:11px;color:#555;font-family:'JetBrains Mono',monospace;">${esc(m)}</span>`).join('')}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
              <div style="font-size:11px;color:#444;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${fmtDate(exp.created_at)}</div>
              ${exp.total_trials ? `<div style="font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${fmtNum(exp.completed_trials)} / ${fmtNum(exp.total_trials)} trials</div>` : ''}
              <button onclick="event.stopPropagation(); window.openConditionDashboard(${exp.id})"
                style="font-size:10px; color:#3b82f6; background:none; border:1px solid rgba(59,130,246,0.3); border-radius:4px; padding:3px 8px; cursor:pointer; font-family:'JetBrains Mono',monospace;"
                onmouseenter="this.style.background='rgba(59,130,246,0.1)'"
                onmouseleave="this.style.background='none'">
                View Comparison
              </button>
            </div>
          </div>
          ${exp.status === 'running' && exp.total_trials > 0 ? progressBar((exp.completed_trials / exp.total_trials) * 100, '#2196F3') : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Create Wizard ────────────────────────────────────────────────────────────

function renderCreateWizard(container) {
  const step = expState.createStep;
  const draft = expState.draftExp;

  const steps = ['Basic Info', 'Conditions', 'Models & Probes', 'Review'];
  const stepNav = steps.map((label, i) => {
    const num = i + 1;
    const isActive = num === step;
    const isDone = num < step;
    return `
      <div style="display:flex;align-items:center;gap:6px;${i > 0 ? 'margin-left:6px;' : ''}">
        ${i > 0 ? `<div style="width:24px;height:1px;background:${isDone ? '#4a9eff' : '#1a1a1a'};"></div>` : ''}
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            background:${isActive ? '#4a9eff' : isDone ? 'rgba(74,158,255,0.15)' : '#141414'};
            color:${isActive ? '#fff' : isDone ? '#6db3ff' : '#444'};
            border:1px solid ${isActive ? '#4a9eff' : isDone ? 'rgba(74,158,255,0.3)' : '#1a1a1a'};">
            ${isDone ? '✓' : num}
          </div>
          <span style="font-size:11px;color:${isActive ? '#e0e0e0' : '#555'};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;white-space:nowrap;">${label}</span>
        </div>
      </div>
    `;
  }).join('');

  let stepContent = '';
  if (step === 1) stepContent = renderWizardStep1(draft);
  else if (step === 2) stepContent = renderWizardStep2(draft);
  else if (step === 3) stepContent = renderWizardStep3(draft);
  else stepContent = renderWizardStep4(draft);

  container.innerHTML = `
    <div class="fade-in" style="max-width:680px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
        <button onclick="window._expUI.backToList()" style="background:none;border:none;color:#555;cursor:pointer;font-size:20px;padding:0;line-height:1;" title="Back">←</button>
        <div>
          <h1 style="font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#e0e0e0;margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">New Experiment</h1>
        </div>
      </div>

      <div style="display:flex;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:4px;">
        ${stepNav}
      </div>

      <div class="card" style="padding:24px;">
        ${stepContent}
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:16px;">
        <button onclick="window._expUI.wizardBack()" class="btn-ghost" style="${step === 1 ? 'visibility:hidden;' : ''}">Back</button>
        <div style="display:flex;gap:8px;">
          <button onclick="window._expUI.backToList()" class="btn-ghost">Cancel</button>
          ${step < 4
            ? `<button onclick="window._expUI.wizardNext()" class="btn-primary">Next →</button>`
            : `<button onclick="window._expUI.submitCreate()" class="btn-primary">Create Experiment</button>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderWizardStep1(draft) {
  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div>
        <div class="card-label">Experiment Name <span style="color:#e57373;">*</span></div>
        <input type="text" id="exp-name" value="${esc(draft.name)}" placeholder="e.g. Condition framing effect on refusal rates" />
      </div>
      <div>
        <div class="card-label">Description</div>
        <textarea id="exp-description" rows="3" placeholder="What hypothesis are you testing? What are the expected outcomes?" style="resize:vertical;">${esc(draft.description)}</textarea>
      </div>
      <div>
        <div class="card-label">Repetitions per condition</div>
        <input type="number" id="exp-repetitions" value="${draft.repetitions || 1}" min="1" max="50" style="width:120px;" />
        <div style="font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-top:4px;">
          How many times to run each probe per condition (for statistical power)
        </div>
      </div>
    </div>
  `;
}

function renderWizardStep2(draft) {
  const conditions = draft.conditions || [];
  const condRows = conditions.map((c, i) => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:12px;background:#080808;border:1px solid #1a1a1a;border-radius:6px;margin-bottom:8px;">
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;gap:8px;">
          <div style="flex:1;">
            <div class="card-label" style="margin-bottom:4px;">Condition Name</div>
            <input type="text" value="${esc(c.name)}" onchange="window._expUI.updateCondition(${i},'name',this.value)" placeholder="e.g. honest" />
          </div>
          <div style="width:140px;">
            <div class="card-label" style="margin-bottom:4px;">Type</div>
            <select onchange="window._expUI.updateCondition(${i},'type',this.value)">
              <option value="honest" ${c.type === 'honest' ? 'selected' : ''}>Honest</option>
              <option value="deceptive" ${c.type === 'deceptive' ? 'selected' : ''}>Deceptive</option>
              <option value="neutral" ${c.type === 'neutral' ? 'selected' : ''}>Neutral</option>
              <option value="high_effort_honest" ${c.type === 'high_effort_honest' ? 'selected' : ''}>High-effort honest</option>
              <option value="custom" ${c.type === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </div>
        </div>
        <div>
          <div class="card-label" style="margin-bottom:4px;">System Prompt <span style="color:#555;font-weight:400;text-transform:none;font-size:10px;">(optional override)</span></div>
          <textarea rows="3" style="resize:vertical;font-family:'JetBrains Mono',monospace;font-size:11px;" onchange="window._expUI.updateCondition(${i},'system_prompt',this.value)" placeholder="Leave blank to use default session system prompt…">${esc(c.system_prompt || '')}</textarea>
        </div>
      </div>
      <button onclick="window._expUI.removeCondition(${i})" style="background:none;border:none;color:#444;cursor:pointer;font-size:16px;padding:2px 4px;flex-shrink:0;margin-top:24px;" title="Remove">✕</button>
    </div>
  `).join('');

  return `
    <div>
      <div style="font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:16px;line-height:1.6;">
        Define the conditions that will be compared. Each condition runs all selected probes with its own system prompt framing.
      </div>
      ${condRows}
      <button onclick="window._expUI.addCondition()" class="btn-secondary" style="width:100%;font-size:12px;padding:8px;">
        + Add Condition
      </button>
      ${conditions.length === 0 ? `<div style="font-size:11px;color:#444;margin-top:8px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Add at least one condition to continue</div>` : ''}
    </div>
  `;
}

function renderWizardStep3(draft) {
  const models = draft.models || [];
  const modelRows = models.map((m, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
      <input type="text" value="${esc(m)}" onchange="window._expUI.updateModel(${i}, this.value)" placeholder="e.g. claude-3-5-haiku-20241022" style="font-family:'JetBrains Mono',monospace;font-size:12px;" />
      <button onclick="window._expUI.removeModel(${i})" style="background:none;border:none;color:#444;cursor:pointer;font-size:16px;padding:2px 6px;flex-shrink:0;" title="Remove">✕</button>
    </div>
  `).join('');

  return `
    <div style="display:flex;flex-direction:column;gap:20px;">
      <div>
        <div class="card-label" style="margin-bottom:8px;">Target Models</div>
        <div style="font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:10px;">
          Each model will run all probes under all conditions.
        </div>
        ${modelRows}
        <button onclick="window._expUI.addModel()" class="btn-secondary" style="font-size:12px;padding:7px 14px;margin-top:4px;">
          + Add Model
        </button>
      </div>
      <div>
        <div class="card-label" style="margin-bottom:8px;">Probe Set IDs <span style="color:#555;font-weight:400;text-transform:none;font-size:10px;">(comma-separated)</span></div>
        <textarea id="exp-probe-ids" rows="2" placeholder="Leave blank to use all probes from current session, or enter probe IDs: 1,2,5,12" style="resize:none;">${(draft.probe_set_ids || []).join(', ')}</textarea>
        <div style="font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-top:4px;">
          Blank = use all probes in active session
        </div>
      </div>
    </div>
  `;
}

function renderWizardStep4(draft) {
  const conditions = draft.conditions || [];
  const models = draft.models || [];
  const totalTrials = conditions.length * models.length * (draft.probe_set_ids.length || 1) * (draft.repetitions || 1);

  return `
    <div style="display:flex;flex-direction:column;gap:18px;">
      <div>
        <div class="card-label">Summary</div>
        <div style="background:#080808;border:1px solid #1a1a1a;border-radius:6px;padding:14px;font-size:12px;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#999;">
          <div><span style="color:#555;">Name:</span> <span style="color:#e0e0e0;">${esc(draft.name)}</span></div>
          ${draft.description ? `<div><span style="color:#555;">Description:</span> <span style="color:#e0e0e0;">${esc(draft.description)}</span></div>` : ''}
          <div><span style="color:#555;">Conditions:</span> ${conditions.map(c => conditionBadge(c.name)).join(' ')}</div>
          <div><span style="color:#555;">Models:</span> ${models.map(m => `<span style="font-family:'JetBrains Mono',monospace;color:#6db3ff;">${esc(m)}</span>`).join(', ') || '<span style="color:#444;">none</span>'}</div>
          <div><span style="color:#555;">Repetitions:</span> <span style="color:#e0e0e0;">${draft.repetitions}</span></div>
        </div>
      </div>
      <div style="background:rgba(74,158,255,0.04);border:1px solid rgba(74,158,255,0.12);border-radius:6px;padding:14px;">
        <div style="font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#4a9eff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${fmtNum(totalTrials)}</div>
        <div style="font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-top:2px;">estimated total trials</div>
        <div style="font-size:10px;color:#333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-top:6px;">${conditions.length} conditions × ${models.length || '?'} models × ${draft.probe_set_ids.length || '?'} probes × ${draft.repetitions} reps</div>
      </div>
      ${totalTrials > 500 ? `
        <div style="padding:10px 14px;background:rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.2);border-radius:6px;font-size:11px;color:#ffb74d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;">
          ⚠ Large experiment — consider reducing repetitions or probe count to control API costs.
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Experiment Dashboard ─────────────────────────────────────────────────────

function renderExpDashboard(container, exp) {
  const conditions = exp.conditions || [];
  const isRunning = exp.status === 'running';
  const isPaused = exp.status === 'paused';
  const isDraft = exp.status === 'draft';

  const condProgressRows = conditions.map(c => {
    const color = CONDITION_COLORS[c.name] || CONDITION_COLORS[c.type] || '#4a9eff';
    const completed = c.completed_trials || 0;
    const total = c.total_trials || 0;
    const pct = total > 0 ? (completed / total) * 100 : 0;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            ${conditionBadge(c.name || c.type)}
            ${c.system_prompt ? `<span style="font-size:10px;color:#444;font-family:'JetBrains Mono',monospace;" title="${esc(c.system_prompt)}">has system prompt</span>` : ''}
          </div>
          <span style="font-size:11px;color:#555;font-family:'JetBrains Mono',monospace;" data-progress-label="${esc(c.name || c.type)}">${completed} / ${total || '?'}</span>
        </div>
        <div style="height:6px;border-radius:3px;background:#1a1a1a;overflow:hidden;">
          <div data-progress-cond="${esc(c.name || c.type)}" style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.4s ease;"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="fade-in" style="max-width:960px;margin:0 auto;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:12px;">
          <button onclick="window._expUI.backToList()" style="background:none;border:none;color:#555;cursor:pointer;font-size:20px;padding:0;line-height:1;">←</button>
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 style="font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#e0e0e0;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${esc(exp.name)}</h1>
              ${statusBadge(exp.status)}
            </div>
            ${exp.description ? `<div style="font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${esc(exp.description)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${isDraft ? `<button onclick="window._expUI.startExp(${exp.id})" class="btn-primary">▶ Start Run</button>` : ''}
          ${isRunning ? `<button onclick="window._expUI.pauseExp(${exp.id})" class="btn-amber">⏸ Pause</button>` : ''}
          ${isPaused ? `<button onclick="window._expUI.resumeExp(${exp.id})" class="btn-primary">▶ Resume</button>` : ''}
          <button onclick="window._expUI.showResults(${exp.id})" class="btn-secondary">Results</button>
          ${exp.status === 'completed' ? `<button onclick="window._expUI.showAnalysis(${exp.id})" class="btn-secondary">Analysis</button>` : ''}
          <button onclick="window._expUI.showExport(${exp.id})" class="btn-ghost">Export</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="card">
          <div class="card-label">Progress</div>
          <div style="font-size:10px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:14px;" data-progress-overall>
            ${exp.completed_trials != null ? `${fmtNum(exp.completed_trials)} / ${fmtNum(exp.total_trials)} responses collected` : 'Not started'}
          </div>
          ${condProgressRows}
        </div>
        <div class="card">
          <div class="card-label">Configuration</div>
          <div style="font-size:12px;line-height:2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <div class="stat-row">
              <span style="color:#555;">Conditions</span>
              <span style="color:#e0e0e0;">${conditions.length}</span>
            </div>
            <div class="stat-row">
              <span style="color:#555;">Models</span>
              <span style="color:#e0e0e0;">${(exp.models || []).length}</span>
            </div>
            <div class="stat-row">
              <span style="color:#555;">Repetitions</span>
              <span style="color:#e0e0e0;">${exp.repetitions || 1}</span>
            </div>
            <div class="stat-row">
              <span style="color:#555;">Created</span>
              <span style="color:#e0e0e0;">${fmtDate(exp.created_at)}</span>
            </div>
            ${exp.started_at ? `
              <div class="stat-row">
                <span style="color:#555;">Started</span>
                <span style="color:#e0e0e0;">${fmtDate(exp.started_at)}</span>
              </div>
            ` : ''}
            ${exp.completed_at ? `
              <div class="stat-row">
                <span style="color:#555;">Completed</span>
                <span style="color:#e0e0e0;">${fmtDate(exp.completed_at)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${(exp.models || []).length > 0 ? `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-label">Models</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
            ${(exp.models || []).map(m => `<span class="tag">${esc(m)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  if (isRunning) {
    startProgressSSE(exp.id, container);
  }
}

// ─── Results Explorer ─────────────────────────────────────────────────────────

function renderResultsView(container, exp) {
  const f = expState.resultsFilter;
  const rows = expState.resultRows || [];
  const total = expState.resultTotal || 0;
  const page = expState.resultsPage;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const conditions = (exp.conditions || []).map(c => c.name || c.type || c);
  const models = exp.models || [];

  const tableRows = rows.map(r => {
    const clsColor = {
      refused: '#e57373', collapsed: '#ffb74d', negotiated: '#64b5f6', complied: '#81c784'
    }[r.classification] || '#666';
    return `
      <tr style="border-bottom:1px solid #1a1a1a;background:${rows.indexOf(r) % 2 === 0 ? '#0f0f0f' : '#141414'};">
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(r.probe_name || '')}">${esc(r.probe_name || r.probe_id)}</td>
        <td style="padding:10px 14px;">${conditionBadge(r.condition || '')}</td>
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#6db3ff;white-space:nowrap;">${esc(r.model || '')}</td>
        <td style="padding:10px 14px;">
          <span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;background:${clsColor}1a;color:${clsColor};border:1px solid ${clsColor}33;">${esc(r.classification || 'unknown')}</span>
        </td>
        <td style="padding:10px 14px;max-width:280px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;cursor:pointer;" onclick="this.style.webkitLineClamp=this.style.webkitLineClamp==='unset'?'2':'unset'" title="Click to expand">${esc(r.response_text || '')}</div>
        </td>
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#444;white-space:nowrap;">${r.rep != null ? `rep ${r.rep}` : ''}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="fade-in" style="max-width:1100px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <button onclick="window._expUI.openExp(${exp.id})" style="background:none;border:none;color:#555;cursor:pointer;font-size:20px;padding:0;line-height:1;">←</button>
        <div>
          <h1 style="font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#e0e0e0;margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${esc(exp.name)}</h1>
          <div style="font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Results — ${fmtNum(total)} responses</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
        <select onchange="window._expUI.filterResults('condition',this.value)" style="width:160px;">
          <option value="">All conditions</option>
          ${conditions.map(c => `<option value="${esc(c)}" ${f.condition === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <select onchange="window._expUI.filterResults('model',this.value)" style="width:200px;font-family:'JetBrains Mono',monospace;font-size:11px;">
          <option value="">All models</option>
          ${models.map(m => `<option value="${esc(m)}" ${f.model === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
        </select>
        <select onchange="window._expUI.filterResults('status',this.value)" style="width:140px;">
          <option value="">All classifications</option>
          <option value="refused" ${f.status === 'refused' ? 'selected' : ''}>Refused</option>
          <option value="collapsed" ${f.status === 'collapsed' ? 'selected' : ''}>Collapsed</option>
          <option value="negotiated" ${f.status === 'negotiated' ? 'selected' : ''}>Negotiated</option>
          <option value="complied" ${f.status === 'complied' ? 'selected' : ''}>Complied</option>
        </select>
        <div style="flex:1;"></div>
        <span style="font-size:11px;color:#444;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Page ${page + 1} of ${totalPages}</span>
      </div>

      <div style="overflow-x:auto;border:1px solid #1a1a1a;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <thead>
            <tr style="border-bottom:1px solid #1a1a1a;">
              <th style="position:sticky;top:0;background:#0a0a0a;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;white-space:nowrap;z-index:10;">Probe</th>
              <th style="position:sticky;top:0;background:#0a0a0a;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;white-space:nowrap;z-index:10;">Condition</th>
              <th style="position:sticky;top:0;background:#0a0a0a;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;white-space:nowrap;z-index:10;">Model</th>
              <th style="position:sticky;top:0;background:#0a0a0a;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;white-space:nowrap;z-index:10;">Classification</th>
              <th style="position:sticky;top:0;background:#0a0a0a;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;z-index:10;">Response</th>
              <th style="position:sticky;top:0;background:#0a0a0a;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;z-index:10;">Rep</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? tableRows : `
              <tr><td colspan="6" style="padding:40px;text-align:center;color:#333;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">No results match the current filters</td></tr>
            `}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:center;gap:6px;margin-top:16px;">
        <button onclick="window._expUI.changePage(-1)" class="btn-ghost" style="font-size:12px;padding:6px 14px;" ${page === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>← Prev</button>
        <span style="font-size:11px;color:#444;padding:7px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${page + 1} / ${totalPages}</span>
        <button onclick="window._expUI.changePage(1)" class="btn-ghost" style="font-size:12px;padding:6px 14px;" ${page >= totalPages - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>Next →</button>
      </div>
    </div>
  `;
}

// ─── Analysis View ────────────────────────────────────────────────────────────

function renderAnalysisView(container, exp, analysis) {
  if (!analysis) {
    container.innerHTML = `
      <div class="fade-in" style="max-width:960px;margin:0 auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <button onclick="window._expUI.openExp(${exp.id})" style="background:none;border:none;color:#555;cursor:pointer;font-size:20px;padding:0;line-height:1;">←</button>
          <h1 style="font-size:18px;font-weight:600;color:#e0e0e0;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Statistical Analysis</h1>
        </div>
        <div style="text-align:center;padding:60px 20px;color:#444;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          No analysis available. Run the experiment to completion first.
        </div>
      </div>
    `;
    return;
  }

  const pairwiseRows = (analysis.pairwise || []).map(p => {
    const sigColor = p.significant ? '#81c784' : '#555';
    return `
      <tr style="border-bottom:1px solid #1a1a1a;">
        <td style="padding:10px 14px;">${conditionBadge(p.condition_a)}</td>
        <td style="padding:10px 14px;">${conditionBadge(p.condition_b)}</td>
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#e0e0e0;">${p.effect_size != null ? p.effect_size.toFixed(3) : '—'}</td>
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#e0e0e0;">${p.p_value != null ? p.p_value.toFixed(4) : '—'}</td>
        <td style="padding:10px 14px;"><span style="font-size:11px;color:${sigColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${p.significant ? 'Yes' : 'No'}</span></td>
        <td style="padding:10px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#555;">${p.ci_low != null ? `[${p.ci_low.toFixed(3)}, ${p.ci_high.toFixed(3)}]` : '—'}</td>
      </tr>
    `;
  }).join('');

  const winRateRows = Object.entries(analysis.win_rates || {}).map(([cond, rate]) => {
    const color = CONDITION_COLORS[cond] || '#4a9eff';
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          ${conditionBadge(cond)}
          <span style="font-size:13px;font-weight:600;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${fmtPct(rate)}</span>
        </div>
        ${progressBar(rate * 100, color)}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="fade-in" style="max-width:960px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <button onclick="window._expUI.openExp(${exp.id})" style="background:none;border:none;color:#555;cursor:pointer;font-size:20px;padding:0;line-height:1;">←</button>
        <div>
          <h1 style="font-size:18px;font-weight:600;color:#e0e0e0;margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Statistical Analysis — ${esc(exp.name)}</h1>
          ${analysis.generated_at ? `<div style="font-size:11px;color:#444;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Generated ${fmtDate(analysis.generated_at)}</div>` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="card">
          <div class="card-label">Compliance Rate by Condition</div>
          <div style="margin-top:12px;">${winRateRows || '<div style="color:#444;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">No data</div>'}</div>
        </div>
        <div class="card">
          <div class="card-label">Overall Agreement</div>
          <div style="margin-top:12px;">
            ${analysis.inter_rater_agreement != null ? `
              <div style="font-size:48px;font-weight:600;letter-spacing:-0.03em;color:#4a9eff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${fmtPct(analysis.inter_rater_agreement)}</div>
              <div style="font-size:11px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-top:4px;">inter-rater agreement (LLM judge vs keyword)</div>
            ` : '<div style="color:#444;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">Not computed</div>'}
          </div>
        </div>
      </div>

      ${pairwiseRows ? `
        <div class="card">
          <div class="card-label" style="margin-bottom:12px;">Pairwise Comparisons</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <thead>
                <tr style="border-bottom:1px solid #1a1a1a;">
                  <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;">Condition A</th>
                  <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;">Condition B</th>
                  <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;">Effect Size</th>
                  <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;">p-value</th>
                  <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;">Significant</th>
                  <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#444;">95% CI</th>
                </tr>
              </thead>
              <tbody>${pairwiseRows}</tbody>
            </table>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Export Controls ──────────────────────────────────────────────────────────

function renderExportView(container, exp) {
  container.innerHTML = `
    <div class="fade-in" style="max-width:680px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <button onclick="window._expUI.openExp(${exp.id})" style="background:none;border:none;color:#555;cursor:pointer;font-size:20px;padding:0;line-height:1;">←</button>
        <h1 style="font-size:18px;font-weight:600;color:#e0e0e0;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Export — ${esc(exp.name)}</h1>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div class="card">
          <div class="card-label" style="margin-bottom:8px;">Research Data</div>
          <div style="font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:12px;line-height:1.5;">
            Full response data with classifications, conditions, and metadata.
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="window._expUI.doExport(${exp.id},'csv')" class="btn-secondary" style="font-size:12px;">Download CSV</button>
            <button onclick="window._expUI.doExport(${exp.id},'jsonl')" class="btn-secondary" style="font-size:12px;">Download JSONL</button>
          </div>
        </div>

        <div class="card">
          <div class="card-label" style="margin-bottom:8px;">Prolific Integration</div>
          <div style="font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:12px;line-height:1.5;">
            Formatted participant CSV for Prolific study upload. Includes condition assignments and completion codes.
          </div>
          <button onclick="window._expUI.doExport(${exp.id},'prolific')" class="btn-secondary" style="font-size:12px;">Download Prolific CSV</button>
        </div>

        <div class="card">
          <div class="card-label" style="margin-bottom:8px;">Preregistration</div>
          <div style="font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:12px;line-height:1.5;">
            Generate a structured preregistration document (OSF-compatible) based on your experiment design.
          </div>
          <button onclick="window._expUI.doExport(${exp.id},'prereg')" class="btn-secondary" style="font-size:12px;">Generate Preregistration</button>
        </div>

        <div class="card">
          <div class="card-label" style="margin-bottom:8px;">Publication Report</div>
          <div style="font-size:12px;color:#555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:12px;line-height:1.5;">
            Auto-generated methods + results section for academic publication. Requires completed experiment with analysis.
          </div>
          <button onclick="window._expUI.doExport(${exp.id},'report')" class="${exp.status === 'completed' ? 'btn-secondary' : 'btn-ghost'}" style="font-size:12px;" ${exp.status !== 'completed' ? 'disabled' : ''}>Generate Report</button>
        </div>

      </div>
    </div>
  `;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

async function loadExperiments() {
  try {
    const data = await apiFetch('/api/experiments');
    expState.experiments = Array.isArray(data) ? data : (data.experiments || []);
  } catch (_) {
    expState.experiments = [];
  }
}

async function loadExperiment(id, container) {
  try {
    const exp = await apiFetch(`/api/experiments/${id}`);
    expState.currentExp = exp;
    renderExpDashboard(container, exp);
  } catch (e) {
    showMsg(container, 'Failed to load experiment: ' + e.message, true);
  }
}

async function loadResults(expId, container) {
  const { model, condition, status } = expState.resultsFilter;
  const offset = expState.resultsPage * PAGE_SIZE;
  try {
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
    if (model) params.set('model', model);
    if (condition) params.set('condition', condition);
    if (status) params.set('classification', status);
    const data = await apiFetch(`/api/experiments/${expId}/results?${params}`);
    expState.resultRows = data.results || data || [];
    expState.resultTotal = data.total || expState.resultRows.length;
    renderResultsView(container, expState.currentExp);
  } catch (e) {
    showMsg(container, 'Failed to load results: ' + e.message, true);
  }
}

async function loadAnalysis(expId, container) {
  try {
    const analysis = await apiFetch(`/api/experiments/${expId}/analysis`);
    renderAnalysisView(container, expState.currentExp, analysis);
  } catch (_) {
    renderAnalysisView(container, expState.currentExp, null);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function cleanupExperimentUI() {
  if (activeSSE) { activeSSE.close(); activeSSE = null; }
  if (expState.sseSource) { expState.sseSource.close(); expState.sseSource = null; }
}

export function initExperimentUI(container) {
  // Close any active SSE connection from a previous tab visit
  cleanupExperimentUI();
  expState.view = 'list';
  expState.currentExp = null;

  const ui = {
    backToList: async () => {
      if (expState.sseSource) {
        expState.sseSource.close();
        expState.sseSource = null;
      }
      expState.view = 'list';
      expState.currentExp = null;
      await loadExperiments();
      renderExperimentList(container);
    },

    showCreate: () => {
      expState.view = 'create';
      expState.createStep = 1;
      expState.draftExp = { name: '', description: '', conditions: [], models: [], probe_set_ids: [], repetitions: 1 };
      renderCreateWizard(container);
    },

    openExp: async (id) => {
      expState.view = 'dashboard';
      try {
        const exp = await apiFetch(`/api/experiments/${id}`);
        expState.currentExp = exp;
        renderExpDashboard(container, exp);
      } catch (e) {
        showMsg(container, 'Failed to load experiment: ' + e.message, true);
      }
    },

    wizardNext: () => {
      const step = expState.createStep;
      const draft = expState.draftExp;

      if (step === 1) {
        draft.name = document.getElementById('exp-name')?.value.trim() || '';
        draft.description = document.getElementById('exp-description')?.value.trim() || '';
        draft.repetitions = parseInt(document.getElementById('exp-repetitions')?.value || '1', 10) || 1;
        if (!draft.name) { showMsg(container, 'Experiment name is required.', true); return; }
      } else if (step === 2) {
        if (!draft.conditions.length) { showMsg(container, 'Add at least one condition.', true); return; }
      } else if (step === 3) {
        const rawIds = document.getElementById('exp-probe-ids')?.value.trim();
        draft.probe_set_ids = rawIds ? rawIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)) : [];
      }

      expState.createStep = step + 1;
      renderCreateWizard(container);
    },

    wizardBack: () => {
      expState.createStep = Math.max(1, expState.createStep - 1);
      renderCreateWizard(container);
    },

    addCondition: () => {
      expState.draftExp.conditions.push({ name: '', type: 'neutral', system_prompt: '' });
      renderCreateWizard(container);
    },

    removeCondition: (i) => {
      expState.draftExp.conditions.splice(i, 1);
      renderCreateWizard(container);
    },

    updateCondition: (i, field, value) => {
      if (expState.draftExp.conditions[i]) {
        expState.draftExp.conditions[i][field] = value;
      }
    },

    addModel: () => {
      expState.draftExp.models.push('');
      renderCreateWizard(container);
    },

    removeModel: (i) => {
      expState.draftExp.models.splice(i, 1);
      renderCreateWizard(container);
    },

    updateModel: (i, value) => {
      expState.draftExp.models[i] = value;
    },

    submitCreate: async () => {
      const draft = expState.draftExp;
      if (!draft.name) { showMsg(container, 'Experiment name is required.', true); return; }
      if (!draft.conditions.length) { showMsg(container, 'Add at least one condition.', true); return; }
      try {
        const result = await apiFetch('/api/experiments', {
          method: 'POST',
          body: JSON.stringify(draft),
        });
        showMsg(container, 'Experiment created.');
        ui.openExp(result.id || result.experiment_id);
      } catch (e) {
        showMsg(container, 'Failed to create experiment: ' + e.message, true);
      }
    },

    startExp: async (id) => {
      try {
        await apiFetch(`/api/experiments/${id}/start`, { method: 'POST' });
        await ui.openExp(id);
      } catch (e) {
        showMsg(container, 'Failed to start: ' + e.message, true);
      }
    },

    pauseExp: async (id) => {
      try {
        await apiFetch(`/api/experiments/${id}/pause`, { method: 'POST' });
        await ui.openExp(id);
      } catch (e) {
        showMsg(container, 'Failed to pause: ' + e.message, true);
      }
    },

    resumeExp: async (id) => {
      try {
        await apiFetch(`/api/experiments/${id}/resume`, { method: 'POST' });
        await ui.openExp(id);
      } catch (e) {
        showMsg(container, 'Failed to resume: ' + e.message, true);
      }
    },

    showResults: async (id) => {
      expState.view = 'results';
      expState.resultsPage = 0;
      expState.resultsFilter = { model: '', condition: '', status: '' };
      await loadResults(id, container);
    },

    showAnalysis: async (id) => {
      expState.view = 'analysis';
      await loadAnalysis(id, container);
    },

    showExport: (id) => {
      expState.view = 'export';
      renderExportView(container, expState.currentExp);
    },

    filterResults: async (field, value) => {
      expState.resultsFilter[field] = value;
      expState.resultsPage = 0;
      await loadResults(expState.currentExp.id, container);
    },

    changePage: async (delta) => {
      const total = expState.resultTotal;
      const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
      expState.resultsPage = Math.max(0, Math.min(maxPage, expState.resultsPage + delta));
      await loadResults(expState.currentExp.id, container);
    },

    doExport: async (id, format) => {
      try {
        const url = `/api/experiments/${id}/export?format=${format}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `experiment-${id}-${format}.${format === 'jsonl' ? 'jsonl' : format === 'report' ? 'md' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        showMsg(container, 'Export failed: ' + e.message, true);
      }
    },
  };

  window._expUI = ui;

  loadExperiments().then(() => renderExperimentList(container));
}
