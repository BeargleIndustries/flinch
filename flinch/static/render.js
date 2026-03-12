// ─── Rendering ────────────────────────────────────────────────────────────────

import { state, setPhase } from './state.js';
import { api, loadStats, loadTurns, startBatch, cancelBatch, loadComparison, showSaveSnapshotDialog, showSnapshotBrowser, loadSnapshotDiff, deleteSnapshot, hideSnapshotView } from './api.js';
import {
  escHtml,
  normalizeClassification,
  extractSuggestionText,
  classificationBadge,
  statBar,
  groupProbesByDomain,
  filterProbes,
  showError,
  formatResponseText,
} from './components.js';

export function render() {
  renderSidebar();
  renderMain();
}

export function renderSessionSelect() {
  const sel = document.getElementById('session-select');
  const current = sel.value;
  sel.innerHTML = '<option value="">— no session —</option>';
  for (const s of state.sessions) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.target_model})`;
    sel.appendChild(opt);
  }
  if (state.currentSession) {
    sel.value = state.currentSession.id;
  } else {
    sel.value = current;
  }
}

function renderSidebar() {
  renderProbeList();
  renderRunHistory();
  renderStats();
}

export function renderProbeListOnly() {
  const container = document.getElementById('probe-list');
  if (!container) return;

  if (!state.probes.length) {
    container.innerHTML = `
      <div style="padding:24px 16px; text-align:center;">
        <div style="font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#252a35; font-family:'JetBrains Mono',monospace; margin-bottom:8px;">No probes loaded</div>
        <button onclick="loadDefaultProbes()" style="font-size:11px; color:#3b82f6; background:none; border:1px solid #1e3a8a; border-radius:3px; cursor:pointer; font-family:'JetBrains Mono',monospace; padding:4px 10px;">Load Defaults</button>
      </div>`;
    return;
  }

  const total = state.probes.length;
  const filtered = filterProbes(state.probes, state.probeSearch, state.probeDomainFilter);
  const visible = filtered.length;

  // Build unique domain list for dropdown (from full probe list, sorted)
  const allDomains = [...new Set(state.probes.map(p => p.domain || 'uncategorized'))].sort();

  const clearBtn = state.probeSearch
    ? `<span onclick="window.clearProbeSearch()" title="Clear search"
         style="position:absolute; right:6px; top:50%; transform:translateY(-50%); cursor:pointer; color:#4b5563; font-size:12px; line-height:1;"
         onmouseenter="this.style.color='#e2e8f0'" onmouseleave="this.style.color='#4b5563'">✕</span>`
    : '';

  const countHtml = `<span style="font-size:10px; font-family:'JetBrains Mono',monospace; color:#4b5563; font-weight:400; letter-spacing:0; text-transform:none;">${visible} / ${total}</span>`;

  let html = `
    <div style="padding:0 8px 6px 8px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <span style="font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; font-family:'JetBrains Mono',monospace; color:#4b5563;">Probes</span>
        ${countHtml}
      </div>
      <div style="position:relative; margin-bottom:5px;">
        <input
          type="text"
          id="probe-search-input"
          value="${escHtml(state.probeSearch)}"
          placeholder="Search probes..."
          oninput="window.onProbeSearchInput(this.value)"
          style="width:100%; box-sizing:border-box; height:28px; padding:0 24px 0 8px; font-size:12px; font-family:'JetBrains Mono',monospace; background:#0d0f16; border:1px solid #252a35; border-radius:4px; color:#e2e8f0; outline:none;"
          onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#252a35'"
        />
        ${clearBtn}
      </div>
      <select
        id="probe-domain-filter"
        onchange="window.onProbeDomainChange(this.value)"
        style="width:100%; box-sizing:border-box; height:28px; padding:0 6px; font-size:12px; font-family:'JetBrains Mono',monospace; background:#0d0f16; border:1px solid #252a35; border-radius:4px; color:${state.probeDomainFilter ? '#e2e8f0' : '#4b5563'}; outline:none; appearance:none; -webkit-appearance:none; cursor:pointer;"
        onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#252a35'"
      >
        <option value="" style="color:#4b5563;">All domains</option>
        ${allDomains.map(d => `<option value="${escHtml(d)}" ${state.probeDomainFilter === d ? 'selected' : ''} style="color:#e2e8f0;">${escHtml(d)}</option>`).join('')}
      </select>
    </div>
  `;

  if (!filtered.length) {
    html += `<div style="padding:12px; color:#374151; font-size:12px; font-family:'JetBrains Mono',monospace;">No probes match</div>`;
    container.innerHTML = html;
    return;
  }

  // Build a quick lookup: probe_id -> variant label
  const variantMap = {};
  for (const group of (state.variantGroups || [])) {
    for (const v of (group.variants || [])) {
      variantMap[v.probe_id] = { group_id: group.group_id, label: v.variant_label };
    }
  }

  // Custom prompt option
  const isCustomActive = state.currentProbe && state.currentProbe.id === 'custom';
  html += `
    <div class="probe-item ${isCustomActive ? 'active' : ''}"
         onclick="selectCustomProbe()"
         style="padding:8px 12px; cursor:pointer; border-left:2px solid ${isCustomActive ? '#f59e0b' : 'transparent'}; transition:all 0.1s; margin-bottom:4px; border-bottom:1px solid #1e2130;">
      <div style="font-size:12px; color:#f59e0b; font-weight:600; font-family:'JetBrains Mono',monospace;">+ Custom Prompt</div>
      <div style="font-size:10px; color:#4b5563; font-family:'JetBrains Mono',monospace;">Type your own prompt text</div>
    </div>
  `;

  const grouped = groupProbesByDomain(filtered);
  for (const [domain, probes] of Object.entries(grouped)) {
    html += `<div class="domain-header">${escHtml(domain)}</div>`;
    for (const probe of probes) {
      const isActive = state.currentProbe && state.currentProbe.id === probe.id;
      const variantInfo = variantMap[probe.id];
      const variantBadge = variantInfo
        ? `<span class="variant-badge" title="Group: ${escHtml(variantInfo.group_id)}">⊕ ${escHtml(variantInfo.label)}</span>`
        : '';
      html += `
        <div class="probe-item ${isActive ? 'active' : ''}"
             style="padding:8px 12px; cursor:pointer; border-left:2px solid transparent; transition:all 0.1s; display:flex; align-items:flex-start; gap:6px;">
          <div onclick="selectProbe('${probe.id}')" style="flex:1; min-width:0;">
            <div style="font-size:13px; color:${isActive ? '#93c5fd' : '#cbd5e1'}; font-weight:500; margin-bottom:2px; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">${escHtml(probe.name)}${variantBadge}${probe.narrative_opening ? '<span style="font-size:9px; color:#a855f7; border:1px solid #a855f740; border-radius:2px; padding:0 3px; font-family:\'JetBrains Mono\',monospace;">IF</span>' : ''}</div>
            <div style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(probe.prompt_text || '').slice(0, 60)}...</div>
          </div>
          <span onclick="event.stopPropagation(); deleteProbe(${probe.id}, '${escHtml(probe.name)}')"
                style="color:#7f1d1d; cursor:pointer; font-size:10px; padding:2px 4px; flex-shrink:0; opacity:0.5;"
                onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.5'"
                title="Delete probe">✕</span>
        </div>
      `;
    }
  }
  container.innerHTML = html;
}

function renderProbeList() {
  renderProbeListOnly();
}

export function renderStats() {
  const el = document.getElementById('stats-content');
  if (!state.stats) {
    el.innerHTML = `<span style="color:#374151;">No session selected</span>`;
    return;
  }
  const s = state.stats;
  const oc = s.outcome_classifications || s.initial_classifications || {};
  const refused    = oc.refused    || 0;
  const collapsed  = oc.collapsed  || 0;
  const negotiated = oc.negotiated || 0;
  const complied   = oc.complied   || 0;
  const total      = s.total_runs  || 0;

  el.innerHTML = `
    <div class="stat-row">
      <span><span class="stat-dot" style="background:#4b5563;"></span>Total runs</span>
      <span style="color:#9ca3af;">${total}</span>
    </div>
    <div class="stat-row">
      <span><span class="stat-dot" style="background:#ef4444;"></span>Refused</span>
      <span style="color:#fca5a5;">${refused}</span>
    </div>
    <div class="stat-row">
      <span><span class="stat-dot" style="background:#f59e0b;"></span>Collapsed</span>
      <span style="color:#fcd34d;">${collapsed}</span>
    </div>
    <div class="stat-row">
      <span><span class="stat-dot" style="background:#3b82f6;"></span>Negotiated</span>
      <span style="color:#93c5fd;">${negotiated}</span>
    </div>
    <div class="stat-row">
      <span><span class="stat-dot" style="background:#22c55e;"></span>Complied</span>
      <span style="color:#86efac;">${complied}</span>
    </div>
    ${total > 0 ? `
    <div style="margin-top:8px; padding-top:8px; border-top:1px solid #1e2130;">
      <div style="display:flex; gap:2px; border-radius:3px; overflow:hidden; height:6px;">
        ${statBar(refused, total, '#ef4444')}
        ${statBar(collapsed, total, '#f59e0b')}
        ${statBar(negotiated, total, '#3b82f6')}
        ${statBar(complied, total, '#22c55e')}
      </div>
    </div>` : ''}
  `;
}

function renderMain() {
  const main = document.getElementById('main');
  const { phase, currentSession, currentProbe, currentRun } = state;

  if (state.compareMode) {
    if (state.compareData && state.compareData.results) {
      renderMultiModelResults(state.compareData);
    } else if (state.compareData && state.compareData.probes) {
      renderCompareView(state.compareSessionIds);
    } else {
      renderCompareSessionPicker();
    }
    return;
  }

  if (state.settingsView) {
    renderSettingsView();
    return;
  }

  if (state.policyView) {
    renderPolicyBrowser();
    return;
  }

  if (state.consistencyView) {
    renderConsistencyView();
    return;
  }

  if (state.sequenceView) {
    renderSequenceView();
    return;
  }

  if (state.snapshotView) {
    if (state.snapshotDiff) {
      renderSnapshotDiff();
    } else {
      renderSnapshotBrowser();
    }
    return;
  }

  if (state.batchRunning || state.batchComplete) {
    main.innerHTML = renderBatchView();
    return;
  }

  if (!currentSession && phase === 'idle') {
    main.innerHTML = renderIdleState();
    return;
  }

  switch (phase) {
    case 'idle':
      main.innerHTML = renderIdleState();
      break;
    case 'probe_selected':
      main.innerHTML = renderProbeSelectedState();
      break;
    case 'awaiting':
      main.innerHTML = renderAwaitingState();
      break;
    case 'response':
    case 'pushback_decision':
    case 'pushback_sent':
      main.innerHTML = renderResponseState();
      wireupPushbackTextarea();
      break;
    default:
      main.innerHTML = renderIdleState();
  }
}

function renderIdleState() {
  const hasSession = !!state.currentSession;
  const systemPrompt = hasSession && state.currentSession.system_prompt;

  const toolCards = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:24px; max-width:640px; width:100%; text-align:left;">
      <div class="card" style="cursor:pointer; border-color:#a855f720;" onclick="clearAllViews(); showCompareModal();">
        <div style="font-size:13px; font-weight:600; color:#a855f7; margin-bottom:6px;">Multi-Model Compare</div>
        <div style="font-size:11px; color:#64748b; line-height:1.5;">Run the same probes against 2-5 models simultaneously. See responses side-by-side with classification badges.</div>
      </div>
      <div class="card" style="cursor:pointer; border-color:#3b82f620;" onclick="clearAllViews(); ${hasSession ? "state.sequenceView=true; render(); refreshSequences();" : "showNewSessionModal()"}">
        <div style="font-size:13px; font-weight:600; color:#3b82f6; margin-bottom:6px;">Narrative Momentum</div>
        <div style="font-size:11px; color:#64748b; line-height:1.5;">Multi-turn warmup sequences that build conversation context before the real probe. Auto-whittle finds minimum turns needed.</div>
      </div>
      <div class="card" style="cursor:pointer; border-color:#f59e0b20;" onclick="clearAllViews(); ${hasSession ? "state.consistencyView=true; render();" : "showNewSessionModal()"}">
        <div style="font-size:13px; font-weight:600; color:#f59e0b; margin-bottom:6px;">Framing Variants</div>
        <div style="font-size:11px; color:#64748b; line-height:1.5;">Test if models respond consistently to the same request framed differently. Group probe variants and compare outcomes.</div>
      </div>
      <div class="card" style="cursor:pointer; border-color:#14b8a620;" onclick="clearAllViews(); window.showPolicyBrowser ? showPolicyBrowser() : null;">
        <div style="font-size:13px; font-weight:600; color:#14b8a6; margin-bottom:6px;">Policy Browser</div>
        <div style="font-size:11px; color:#64748b; line-height:1.5;">Browse published content policies from Anthropic, OpenAI, Google, and xAI. Link claims to probes for compliance testing.</div>
      </div>
      <div class="card" style="cursor:pointer; border-color:#3b82f620;" onclick="clearAllViews(); showCoachExamples();">
        <div style="font-size:13px; font-weight:600; color:#60a5fa; margin-bottom:6px;">Pushback Coach</div>
        <div style="font-size:11px; color:#64748b; line-height:1.5;">AI-powered pushback suggestions when models refuse. Multiple strategies: reframe, appeal to authority, academic context.</div>
      </div>
      <div class="card" style="cursor:pointer; border-color:#64748b20;" onclick="clearAllViews(); state.settingsView=true; render();">
        <div style="font-size:13px; font-weight:600; color:#94a3b8; margin-bottom:6px;">Settings</div>
        <div style="font-size:11px; color:#64748b; line-height:1.5;">Configure API keys for Anthropic, OpenAI, and Google. Test connections and manage credentials.</div>
      </div>
    </div>`;

  return `
    <div class="fade-in" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; text-align:center;">
      <div class="idle-crosshair">
        <div class="idle-crosshair-ring"></div>
        <div class="idle-crosshair-dot"></div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#2d3348; margin-bottom:12px;">
        ${hasSession ? escHtml(state.currentSession.name) : 'flinch v0.2'}
      </div>
      <div style="font-size:18px; color:#94a3b8; font-weight:500; margin-bottom:4px; letter-spacing:-0.01em;">
        ${hasSession ? 'Select a probe to begin' : 'AI Content Restriction Research Tool'}
      </div>
      ${!hasSession ? `
      <div style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-bottom:8px;">
        Test how AI models handle sensitive content probes across providers
      </div>
      <div style="margin-top:12px; margin-bottom:8px;">
        <button class="btn-primary" onclick="showNewSessionModal()" style="font-size:13px; padding:10px 28px;">
          + New Session
        </button>
      </div>
      <div style="font-size:11px; color:#374151; font-family:'JetBrains Mono',monospace;">
        Create a session to test a specific model, or use Compare to test multiple at once
      </div>
      ${toolCards}` : `
      <div style="width:32px; height:1px; background:#1e2130; margin:12px auto;"></div>
      <div style="font-size:13px; color:#4b5563; max-width:280px; line-height:1.7; font-family:'JetBrains Mono',monospace;">
        Choose a probe from the sidebar.
      </div>
      ${state.probes.length > 0 ? `
      <div style="margin-top:16px;">
        <button class="btn-secondary" onclick="startBatch(${state.currentSession.id}, null, 2000)" style="font-size:12px;">
          Run All Probes
        </button>
      </div>` : ''}
      ${systemPrompt ? `
      <div style="margin-top:24px; max-width:400px; text-align:left; background:#161922; border:1px solid #252a35; border-radius:6px; padding:10px 14px;">
        <div style="font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-bottom:6px;">System Prompt</div>
        <div style="font-size:12px; color:#64748b; font-family:'JetBrains Mono',monospace; line-height:1.5; white-space:pre-wrap; word-break:break-word;">${escHtml(systemPrompt.length > 120 ? systemPrompt.slice(0, 120) + '\u2026' : systemPrompt)}</div>
      </div>` : ''}
      ${state.stats && state.stats.total_runs > 0 ? `
      <div style="margin-top:12px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-secondary" onclick="showSaveSnapshotDialog()" style="font-size:12px;">
          Save Baseline
        </button>
        ${state.snapshots && state.snapshots.length > 0 ? `
        <button class="btn-secondary" onclick="showSnapshotBrowser()" style="font-size:12px;">
          Compare to Baseline
        </button>` : ''}
      </div>` : ''}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; max-width:500px; text-align:left;">
        <div class="feature-description" style="cursor:pointer;" onclick="clearAllViews(); state.sequenceView=true; render(); refreshSequences();">
          <strong>Narrative Momentum</strong><br>
          Multi-turn warmup sequences that test how conversation context affects compliance.
        </div>
        <div class="feature-description" style="cursor:pointer;" onclick="clearAllViews(); state.consistencyView=true; render();">
          <strong>Framing Consistency</strong><br>
          Test if models respond consistently to the same request framed differently.
        </div>
      </div>
      <div style="margin-top:16px;">${renderExportDropdown()}</div>
      `}
    </div>
  `;
}

function renderProbeSelectedState() {
  const { currentProbe, currentSession } = state;
  if (currentProbe && currentProbe.id === 'custom') {
    return `
      <div style="max-width:720px;">
        <div class="card">
          <div class="card-label" style="color:#f59e0b;">Custom Prompt</div>
          <textarea id="custom-probe-text" placeholder="Type your probe text here..." rows="6"
                    style="width:100%; box-sizing:border-box; resize:vertical; font-size:13px; line-height:1.6; background:#0d0f16; border:1px solid #252a35; border-radius:4px; color:#e2e8f0; padding:10px; font-family:'JetBrains Mono',monospace;"
                    onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#252a35'">${escHtml(state.customProbeText || '')}</textarea>
        </div>
        <div style="margin-top:20px; display:flex; gap:10px; align-items:center;">
          <button class="btn-primary" onclick="sendCustomProbe()" style="background:#f59e0b; border-color:#f59e0b;" ${!currentSession ? 'disabled title="Select a session first"' : ''}>
            Send Custom Probe
          </button>
          ${!currentSession ? '<span style="font-size:12px; color:#ef4444; font-family:\'JetBrains Mono\',monospace;">select a session first</span>' : ''}
        </div>
      </div>
    `;
  }
  return `
    <div style="max-width:720px;">
      ${renderProbeCard(currentProbe)}
      <div style="margin-top:20px; display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" onclick="sendProbe()" ${!currentSession ? 'disabled title="Select a session first"' : ''}>
          Send Probe
        </button>
        ${!currentSession ? '<span style="font-size:12px; color:#ef4444; font-family:\'JetBrains Mono\',monospace;">select a session first</span>' : ''}
      </div>
    </div>
  `;
}

function renderAwaitingState() {
  const { currentProbe } = state;
  return `
    <div style="max-width:720px;">
      ${currentProbe ? renderProbeCard(currentProbe) : ''}
      <div class="card fade-in" style="margin-top:16px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
          <span class="spinner"></span>
          <span style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">Analyzing response...</span>
        </div>
        <div class="skeleton-line" style="width:85%;"></div>
        <div class="skeleton-line" style="width:60%;"></div>
        <div class="skeleton-line" style="width:72%;"></div>
        <div class="skeleton-line" style="width:45%; margin-bottom:0;"></div>
      </div>
    </div>
  `;
}

function threadDotColor(role, classification) {
  if (role === 'pushback') return '#3b82f6';
  if (role === 'probe') return '#4b5563';
  const cls = normalizeClassification(classification);
  return { refused: '#ef4444', collapsed: '#f59e0b', negotiated: '#3b82f6', complied: '#22c55e' }[cls] || '#4b5563';
}

function wrapThreadItem(cardHtml, dotColor, isLast) {
  return `
    <div class="thread-item">
      <div class="thread-timeline">
        <div class="thread-line top"></div>
        <div class="thread-dot" style="background:${dotColor};"></div>
        <div class="thread-line bottom${isLast ? ' last' : ''}"></div>
      </div>
      <div class="thread-card">${cardHtml}</div>
    </div>
  `;
}

function renderResponseState() {
  const { phase, currentProbe, currentRun } = state;
  if (!currentRun) return renderIdleState();

  const initialCls = normalizeClassification(currentRun.initial_classification);
  const finalCls = normalizeClassification(currentRun.final_classification);
  const hasCoach = !!currentRun.coach_suggestion;

  let html = `<div style="max-width:720px; display:flex; flex-direction:column; gap:16px;">`;

  if (currentProbe) html += renderProbeCard(currentProbe);

  // Build thread turns array
  let threadTurns = [];
  if (state.currentTurns && state.currentTurns.length > 0) {
    let responseIndex = 0;
    for (const turn of state.currentTurns) {
      if (turn.role === 'probe') continue;
      if (turn.role === 'pushback') {
        threadTurns.push({ type: 'pushback', content: turn.content, classification: null });
      } else if (turn.role === 'response') {
        const isInitial = responseIndex === 0;
        const label = isInitial ? 'Initial Response' : 'Response';
        const field = isInitial ? 'initial_classification' : 'final_classification';
        threadTurns.push({ type: 'response', content: turn.content, classification: turn.classification, label, field });
        responseIndex++;
      }
    }
  } else {
    threadTurns.push({
      type: 'response',
      content: currentRun.initial_response,
      classification: currentRun.initial_classification,
      label: 'Initial Response',
      field: 'initial_classification',
    });
    if (currentRun.final_response) {
      if (currentRun.pushback_text) {
        threadTurns.push({ type: 'pushback', content: currentRun.pushback_text, classification: null });
      }
      threadTurns.push({
        type: 'response',
        content: currentRun.final_response,
        classification: currentRun.final_classification,
        label: 'Final Response',
        field: 'final_classification',
      });
    }
  }

  if (threadTurns.length > 1) {
    // Multi-turn: render as conversation thread with timeline
    html += `<div class="conversation-thread">`;
    threadTurns.forEach((turn, idx) => {
      const isLast = idx === threadTurns.length - 1;
      let cardHtml;
      if (turn.type === 'pushback') {
        cardHtml = renderPushbackCard(turn.content);
      } else {
        cardHtml = renderResponseCard(turn.content, turn.classification, turn.label, currentRun.id, turn.field);
      }
      const dotColor = turn.type === 'pushback'
        ? threadDotColor('pushback', null)
        : threadDotColor('response', turn.classification);
      html += wrapThreadItem(cardHtml, dotColor, isLast);
    });
    html += `</div>`;
  } else if (threadTurns.length === 1) {
    // Single turn: no thread chrome needed
    const turn = threadTurns[0];
    html += renderResponseCard(turn.content, turn.classification, turn.label, currentRun.id, turn.field);
  }

  if (phase === 'pushback_decision') {
    if (hasCoach) {
      html += renderCoachSuggestion(currentRun);
    } else {
      html += renderManualPushback();
    }
  }

  if (phase === 'pushback_sent' || phase === 'response') {
    if (!currentRun.promoted) {
      const outcome = finalCls || initialCls;
      const hints = {
        collapsed: 'Collapsed \u2014 pushback worked',
        refused: 'Refused \u2014 train the coach on this pattern',
        negotiated: 'Negotiated \u2014 partial success worth learning from',
        complied: 'Complied \u2014 no pushback needed, but worth noting',
      };
      const hint = hints[outcome] || '';
      html += `
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn-amber" onclick="promoteToExample(${currentRun.id})">
            Promote to Coach Example
          </button>
          <span style="font-size:11px; color:#92400e; font-family:'JetBrains Mono',monospace;">${escHtml(hint)}</span>
        </div>
      `;
    } else {
      html += `<div style="font-size:12px; color:#86efac; font-family:'JetBrains Mono',monospace;">Promoted to coach example.</div>`;
    }

    if (phase === 'pushback_sent' && currentRun.final_response) {
      html += `
        <div class="card" style="margin-top:4px;">
          <div class="card-label">Continue Pushback</div>
          <textarea id="continue-text" rows="3" placeholder="Type another pushback..." style="width:100%; margin-bottom:8px;"></textarea>
          <div style="display:flex; gap:8px;">
            <button class="btn-primary" onclick="continuePushback()">Send Follow-up</button>
          </div>
        </div>
      `;
    }
  }

  if (phase === 'pushback_sent' && !currentRun.final_response) {
    html += `<div style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">Pushback skipped.</div>`;
  }

  if (phase === 'response' || phase === 'pushback_sent') {
    html += `
      <div style="display:flex; gap:10px; padding-top:4px; align-items:center; flex-wrap:wrap;">
        <button class="btn-primary" onclick="nextProbe()">Next Probe</button>
        <button class="btn-secondary" onclick="resetToProbe()">Re-run This Probe</button>
        ${renderExportDropdown()}
      </div>
    `;
  }

  // Annotation panel — show when we have a run in response or pushback_sent phase
  if (currentRun && (phase === 'response' || phase === 'pushback_sent')) {
    const ann = state.currentAnnotation || { note_text: '', pattern_tags: [], finding: '' };
    html += renderAnnotationPanel(ann, currentRun.id);
  }

  html += `</div>`;
  return html;
}

function renderAnnotationPanel(annotation, runId) {
  const tags = annotation.pattern_tags || [];
  const tagsHtml = tags.map(t =>
    `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; background:#1a2234; border:1px solid #253354; border-radius:3px; font-size:11px; color:#93c5fd; font-family:'JetBrains Mono',monospace;">
      ${escHtml(t)}
      <span onclick="removePatternTag(${runId}, '${escHtml(t)}')" style="cursor:pointer; color:#4b5563; font-size:9px;" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#4b5563'">&#x2715;</span>
    </span>`
  ).join(' ');

  return `
    <div style="margin-top:16px; padding-top:16px; border-top:1px solid #1e2130;">
      <div class="card" style="background:#1a1d27; border-color:#252a35;">
        <div class="card-label">Research Notes</div>

        <textarea id="annotation-notes"
          rows="3"
          placeholder="Research notes... (auto-saves on blur)"
          style="resize:vertical; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.6; margin-bottom:12px;"
          onblur="saveAnnotationNotes(${runId})"
        >${escHtml(annotation.note_text || '')}</textarea>

        <div class="card-label">Pattern Tags</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; align-items:center;">
          ${tagsHtml}
          <input id="pattern-tag-input"
            type="text"
            placeholder="Add tag..."
            style="width:120px; height:24px; padding:2px 8px; font-size:11px; font-family:'JetBrains Mono',monospace; background:#0d0f16; border:1px solid #252a35; border-radius:3px; color:#e2e8f0;"
            onkeydown="handlePatternTagKey(event, ${runId})"
            list="pattern-tag-suggestions"
          />
          <datalist id="pattern-tag-suggestions">
            ${(state.allPatternTags || []).map(t => `<option value="${escHtml(t)}">`).join('')}
          </datalist>
        </div>

        <div style="margin-top:12px; border-top:1px solid #252a35; padding-top:12px;">
          <div class="card-label" style="color:#f59e0b;">Key Finding</div>
          <textarea id="annotation-finding"
            rows="3"
            placeholder="What does this result demonstrate?"
            style="resize:vertical; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.6; border-color:#78350f;"
            onblur="saveAnnotationFinding(${runId})"
          >${escHtml(annotation.finding || '')}</textarea>
        </div>
      </div>
    </div>
  `;
}

function renderExportDropdown() {
  const sessionOptions = (state.sessions || []).map(s =>
    `<option value="${s.id}">${escHtml(s.name)} (${escHtml(s.target_model || '')})</option>`
  ).join('');
  return `
    <div style="position:relative; display:inline-block;">
      <button class="btn-secondary" onclick="toggleExportMenu()" style="font-size:12px;">
        Export &#9662;
      </button>
      <div id="export-menu" class="export-picker" style="display:none; right:0; left:auto;">
        <div class="export-picker-header">Export Data</div>

        <div class="export-section">
          <div class="export-section-label">Quick Export</div>
          <div class="export-buttons">
            <button class="export-btn" onclick="exportSession('json', false)">JSON (raw)</button>
            <button class="export-btn" onclick="exportSession('csv', false)">CSV (raw)</button>
          </div>
        </div>

        <div class="export-section">
          <div class="export-section-label">Research Exports</div>
          <div class="export-buttons">
            <button class="export-btn export-btn-accent" onclick="exportFindings()">Findings Schema</button>
            <button class="export-btn export-btn-accent" onclick="exportReport()">Research Report</button>
            <button class="export-btn export-btn-accent" onclick="exportAgent()">AI Agent Format</button>
          </div>
        </div>

        <div class="export-section">
          <div class="export-section-label">Enhanced Export</div>
          <div class="export-options">
            <label><input type="checkbox" id="exp-turns"> Include turns</label>
            <label><input type="checkbox" id="exp-annotations" checked> Include annotations</label>
            <label><input type="checkbox" id="exp-policy"> Include policy data</label>
            <label><input type="checkbox" id="exp-variants"> Include variants</label>
          </div>
          <div class="export-buttons">
            <button class="export-btn" onclick="exportEnhanced('json', document.getElementById('exp-turns').checked, document.getElementById('exp-annotations').checked, document.getElementById('exp-policy').checked, document.getElementById('exp-variants').checked)">Enhanced JSON</button>
            <button class="export-btn" onclick="exportEnhanced('csv', document.getElementById('exp-turns').checked, document.getElementById('exp-annotations').checked, document.getElementById('exp-policy').checked, document.getElementById('exp-variants').checked)">Enhanced CSV</button>
          </div>
        </div>

        <div class="export-section">
          <div class="export-section-label">Cross-Session Compare</div>
          <div class="export-compare">
            <select id="compare-sessions" multiple size="4" style="width:100%;background:#0f1117;color:#e0e0e0;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px;font-family:inherit;font-size:0.75rem">
              ${sessionOptions}
            </select>
            <div class="export-buttons" style="margin-top:6px">
              <button class="export-btn" onclick="const sel=document.getElementById('compare-sessions');const ids=[...sel.selectedOptions].map(o=>o.value);exportComparison(ids,'json')">Compare JSON</button>
              <button class="export-btn" onclick="const sel=document.getElementById('compare-sessions');const ids=[...sel.selectedOptions].map(o=>o.value);exportComparison(ids,'csv')">Compare CSV</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProbeCard(probe) {
  const tags = (probe.tags || []).map(t => `<span class="tag">${escHtml(t)}</span>`).join(' ');
  return `
    <div class="card">
      <div class="card-label">Probe</div>
      <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
        <span style="font-size:16px; font-weight:600; color:#f1f5f9;">${escHtml(probe.name)}</span>
        <span style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">${escHtml(probe.domain)}</span>
        ${tags ? `<div style="display:flex; gap:4px; flex-wrap:wrap;">${tags}</div>` : ''}
      </div>
      <div class="prompt-text">${escHtml(probe.prompt_text || '')}</div>
      ${probe.narrative_opening ? `
        <div style="margin-top:12px; padding:10px; border:1px solid #a855f720; border-radius:4px; background:#a855f708;">
          <div style="font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#a855f7; font-family:'JetBrains Mono',monospace; margin-bottom:6px;">IF Narrative Opening</div>
          <div style="font-size:12px; color:#cbd5e1; white-space:pre-wrap; font-family:'JetBrains Mono',monospace; line-height:1.5;">${escHtml(probe.narrative_opening)}</div>
        </div>
      ` : ''}
      ${probe.narrative_target ? `
        <div style="margin-top:8px; padding:10px; border:1px solid #a855f720; border-radius:4px; background:#a855f708;">
          <div style="font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#a855f7; font-family:'JetBrains Mono',monospace; margin-bottom:6px;">IF Narrative Target</div>
          <div style="font-size:12px; color:#cbd5e1; white-space:pre-wrap; font-family:'JetBrains Mono',monospace; line-height:1.5;">${escHtml(probe.narrative_target)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

let _cardIdCounter = 0;

function renderResponseCard(responseText, classification, label, runId, field) {
  const badge = classificationBadge(classification, runId, field);
  const cardId = `rc-${++_cardIdCounter}`;
  const text = responseText || '(no response)';
  // Determine if content is long enough to need collapsing.
  // Rough heuristic: > 800 chars or > 6 lines is "long"
  const lineCount = text.split('\n').length;
  const isLong = text.length > 800 || lineCount > 6;
  const collapsedClass = isLong ? 'collapsed' : '';

  return `
    <div class="card fade-in">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <div class="card-label" style="margin:0;">${escHtml(label)}</div>
        ${badge}
      </div>
      <div id="${cardId}" class="response-text ${collapsedClass}">${formatResponseText(text)}</div>
      ${isLong ? `<button class="show-more-btn" onclick="toggleResponseExpand('${cardId}', this)">show more</button>` : ''}
    </div>
  `;
}

function renderCoachSuggestion(run) {
  const cs = run.coach_suggestion || {};
  const pattern = run.coach_pattern_detected || (typeof cs === 'object' ? cs.pattern_detected : '') || '';
  const move    = run.coach_move_suggested   || (typeof cs === 'object' ? cs.move_suggested   : '') || '';
  const text    = state.pushbackText || extractSuggestionText(run.coach_suggestion) || '';
  return `
    <div class="card" style="border-color:#1e3a5f;">
      <div class="card-label">Coach Suggestion</div>
      ${pattern ? `<div style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-bottom:4px;">Pattern detected: <span style="color:#3b82f6;">${escHtml(pattern)}</span></div>` : ''}
      ${move ? `<div style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-bottom:10px;">Suggested move: <span style="color:#60a5fa;">${escHtml(move)}</span></div>` : ''}
      <div style="margin-bottom:10px;">
        <textarea id="pushback-text"
          rows="5"
          style="resize:vertical; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.6;"
          oninput="state.pushbackText = this.value"
        >${escHtml(text)}</textarea>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-primary" onclick="sendPushback('coach')">Send as Coach Suggestion</button>
        <button class="btn-secondary" onclick="sendPushback('override')">Send as Override</button>
        <button class="btn-ghost" onclick="skipPushback()">Skip</button>
      </div>
    </div>
  `;
}

function renderPushbackCard(text) {
  return `
    <div class="card fade-in" style="border-color:#1e3a5f; border-left:3px solid #3b82f6;">
      <div class="card-label" style="color:#60a5fa;">Your Pushback</div>
      <div class="response-text" style="color:#93c5fd;">${escHtml(text || '')}</div>
    </div>
  `;
}

function renderManualPushback() {
  const text = state.pushbackText || '';
  return `
    <div class="card" style="border-color:#1e3a5f;">
      <div class="card-label">Manual Pushback</div>
      <div style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-bottom:10px;">
        No coach suggestion available. Write your own pushback below.
      </div>
      <div style="margin-bottom:10px;">
        <textarea id="pushback-text"
          rows="5"
          style="resize:vertical; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.6;"
          oninput="state.pushbackText = this.value"
          placeholder="Type your pushback here..."
        >${escHtml(text)}</textarea>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-primary" onclick="sendPushback('override')">Send Pushback</button>
        <button class="btn-ghost" onclick="skipPushback()">Skip</button>
      </div>
    </div>
  `;
}

function wireupPushbackTextarea() {
  const el = document.getElementById('pushback-text');
  if (el) {
    if (!state.pushbackText && state.currentRun) {
      state.pushbackText = state.currentRun.coach_suggestion || '';
    }
    el.addEventListener('input', () => {
      state.pushbackText = el.value;
    });
  }
}

export async function renderRunHistory() {
  const container = document.getElementById('run-history-list');
  if (!state.currentSession) {
    container.innerHTML = `<div style="padding:8px; color:#2d3348; font-size:11px; font-family:'JetBrains Mono',monospace; text-align:center;">no session selected</div>`;
    return;
  }
  try {
    const session = await api(`/api/sessions/${state.currentSession.id}`);
    const runs = session.runs || [];
    if (!runs.length) {
      container.innerHTML = `<div style="padding:8px; color:#2d3348; font-size:11px; font-family:'JetBrains Mono',monospace; text-align:center;">no runs yet</div>`;
      return;
    }
    const badgeColors = {
      refused: '#fca5a5', collapsed: '#fcd34d', negotiated: '#93c5fd', complied: '#86efac',
    };
    container.innerHTML = runs.map(r => {
      const probe = state.probes.find(p => p.id === r.probe_id);
      const outcome = r.final_classification || r.initial_classification || 'unknown';
      const color = badgeColors[outcome] || '#9ca3af';
      const isActive = state.currentRun && state.currentRun.id === r.id;
      return `
        <div style="padding:5px 8px; display:flex; align-items:center; gap:6px; border-radius:3px; ${isActive ? 'background:#1e3a5f;' : ''}"
             onmouseenter="this.style.background='#1e2130'" onmouseleave="this.style.background='${isActive ? '#1e3a5f' : 'transparent'}'">
          <span style="width:6px; height:6px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
          <span onclick="viewRun(${r.id})" style="color:#cbd5e1; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;">${escHtml(probe ? probe.name : 'probe #' + r.probe_id)}</span>
          <span style="color:${color}; font-size:10px; flex-shrink:0;">${outcome}</span>
          <span onclick="event.stopPropagation(); deleteRun(${r.id})" style="color:#7f1d1d; cursor:pointer; font-size:10px; padding:0 2px;" title="Delete run">✕</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = 'Failed to load';
  }
}

export async function showCoachExamples() {
  try {
    const examples = await api('/api/coach-examples?profile=standard');
    const main = document.getElementById('main');
    if (!examples.length) {
      main.innerHTML = `
        <div style="max-width:720px;">
          <h2 style="font-size:18px; font-weight:600; color:#f1f5f9; margin-bottom:16px;">Coach Examples</h2>
          <div style="color:#4b5563; font-family:'JetBrains Mono',monospace; font-size:13px;">No promoted examples yet. Promote a collapsed run to add examples.</div>
        </div>
      `;
      return;
    }
    let html = `<div style="max-width:720px;"><h2 style="font-size:18px; font-weight:600; color:#f1f5f9; margin-bottom:16px;">Coach Examples (${examples.length})</h2>`;
    for (const ex of examples) {
      const outcomeColor = { refused: '#fca5a5', collapsed: '#fcd34d', negotiated: '#93c5fd', complied: '#86efac' }[ex.outcome] || '#9ca3af';
      html += `
        <div class="card" style="margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace;">Pattern:</span>
            <span style="font-size:11px; color:#60a5fa; font-family:'JetBrains Mono',monospace;">${escHtml(ex.pattern)}</span>
            <span style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace;">Move:</span>
            <span style="font-size:11px; color:#818cf8; font-family:'JetBrains Mono',monospace;">${escHtml(ex.move)}</span>
            <span style="font-size:11px; color:${outcomeColor}; font-family:'JetBrains Mono',monospace; margin-left:auto;">${escHtml(ex.outcome)}</span>
          </div>
          <div style="margin-bottom:8px;">
            <div class="card-label">Refusal</div>
            <div class="response-text" style="max-height:100px;">${escHtml((ex.refusal_text || '').slice(0, 300))}</div>
          </div>
          <div>
            <div class="card-label" style="color:#60a5fa;">Pushback That Worked</div>
            <div class="response-text" style="max-height:100px; border-color:#1e3a5f;">${escHtml((ex.pushback_text || '').slice(0, 300))}</div>
          </div>
          <div style="display:flex; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid #252a35;">
            <button class="btn-ghost" onclick="editCoachExample(${ex.id})" style="font-size:11px; padding:4px 10px;">Edit Pushback</button>
            <button class="btn-ghost" onclick="deleteCoachExample(${ex.id})" style="font-size:11px; padding:4px 10px; color:#ef4444; border-color:#7f1d1d;">Delete</button>
          </div>
        </div>
      `;
    }
    html += `<button class="btn-secondary" onclick="render()" style="margin-top:8px;">Back</button></div>`;
    main.innerHTML = html;
  } catch (e) {
    showError('Failed to load coach examples: ' + e.message);
  }
}

function renderBatchView() {
  const bp = state.batchProgress || { completed: 0, total: 0, failed: 0, results: [] };
  const pct = bp.total > 0 ? Math.round((bp.completed / bp.total) * 100) : 0;
  const isRunning = state.batchRunning;

  const classColors = {
    refused: '#ef4444', collapsed: '#f59e0b', negotiated: '#3b82f6', complied: '#22c55e', unknown: '#4b5563',
  };

  // Tally by classification
  const tally = {};
  for (const r of (bp.results || [])) {
    const cls = r.classification || 'unknown';
    tally[cls] = (tally[cls] || 0) + 1;
  }

  const lastResult = bp.results && bp.results.length > 0 ? bp.results[bp.results.length - 1] : null;
  const statusText = isRunning
    ? (lastResult ? `Running probe ${bp.completed} of ${bp.total} — ${escHtml(lastResult.probe_name)}` : `Starting batch...`)
    : `Batch complete — ${bp.completed} of ${bp.total} probes`;

  let html = `
    <div class="fade-in" style="max-width:720px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <div>
          <div style="font-size:18px; font-weight:600; color:#f1f5f9; margin-bottom:2px;">
            ${isRunning ? 'Batch Running' : 'Batch Complete'}
          </div>
          <div style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">${statusText}</div>
        </div>
        ${isRunning
          ? `<button class="btn-ghost" onclick="cancelBatch()" style="color:#ef4444; border-color:#7f1d1d; font-size:12px;">Cancel</button>`
          : `<button class="btn-secondary" onclick="exitBatch()" style="font-size:12px;">Back</button>`
        }
      </div>

      <div style="height:4px; background:#1e2130; border-radius:2px; overflow:hidden; margin-bottom:16px;">
        <div style="width:${pct}%; height:100%; background:#2563eb; transition:width 0.3s;"></div>
      </div>

      <div style="display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
        <div style="font-size:12px; color:#9ca3af; font-family:'JetBrains Mono',monospace;">${bp.completed}/${bp.total} completed</div>
        ${bp.failed > 0 ? `<div style="font-size:12px; color:#ef4444; font-family:'JetBrains Mono',monospace;">${bp.failed} errors</div>` : ''}
        ${Object.entries(tally).map(([cls, count]) =>
          `<div style="font-size:12px; color:${classColors[cls] || '#9ca3af'}; font-family:'JetBrains Mono',monospace;">${count} ${cls}</div>`
        ).join('')}
      </div>
  `;

  if (bp.results && bp.results.length > 0) {
    html += `
      <div style="border:1px solid #252a35; border-radius:6px; overflow:hidden;">
        <div style="display:grid; grid-template-columns:1fr auto auto; gap:0; font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#374151; font-family:'JetBrains Mono',monospace; padding:8px 12px; border-bottom:1px solid #252a35;">
          <span>Probe</span>
          <span style="padding-right:16px;">Domain</span>
          <span>Result</span>
        </div>
    `;
    bp.results.forEach((r, idx) => {
      const cls = r.classification || 'unknown';
      const color = classColors[cls] || '#9ca3af';
      const probe = state.probes.find(p => p.id === r.probe_id);
      const domain = probe ? (probe.domain || '') : '';
      const rowBg = idx % 2 === 0 ? '#161922' : '#0d0f16';
      html += `
        <div onclick="viewRun(${r.run_id})" style="display:grid; grid-template-columns:1fr auto auto; gap:0; padding:8px 12px; background:${rowBg}; cursor:pointer; transition:background 0.1s;"
             onmouseenter="this.style.background='#1e2130'" onmouseleave="this.style.background='${rowBg}'">
          <span style="font-size:13px; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(r.probe_name)}</span>
          <span style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; padding-right:16px; white-space:nowrap;">${escHtml(domain)}</span>
          <span style="font-size:11px; font-weight:600; color:${color}; font-family:'JetBrains Mono',monospace; white-space:nowrap;">${escHtml(cls)}</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

export function exitBatch() {
  state.batchRunning = false;
  state.batchComplete = false;
  state.batchProgress = null;
  render();
}

export function resetToProbe() {
  state.currentRun = null;
  setPhase('probe_selected');
  state.pushbackText = '';
  render();
}

export function toggleResponseExpand(cardId, btn) {
  const el = document.getElementById(cardId);
  if (!el) return;
  const isCollapsed = el.classList.contains('collapsed');
  if (isCollapsed) {
    el.classList.remove('collapsed');
    el.classList.add('expanded');
    btn.textContent = 'show less';
  } else {
    el.classList.remove('expanded');
    el.classList.add('collapsed');
    btn.textContent = 'show more';
  }
}

// ─── Compare view ─────────────────────────────────────────────────────────────

function providerLabel(model) {
  if (!model) return '';
  const m = model.toLowerCase();
  if (m.includes('claude')) return '<span class="provider-label-claude">Claude</span>';
  if (m.includes('gpt') || m.includes('openai') || m.includes('o1') || m.includes('o3') || m.includes('o4')) return '<span class="provider-label-openai">OpenAI</span>';
  if (m.includes('gemini')) return '<span class="provider-label-gemini">Gemini</span>';
  return `<span class="provider-label-unknown">${escHtml(model)}</span>`;
}

export function renderCompareSessionPicker() {
  const main = document.getElementById('main');
  const selectedModels = state.compareModels || [];
  const selectedProbeIds = new Set(state.compareProbeIds || []);

  // Build model list from the /api/models data (cached in state) or use fallback
  const availableModels = [];
  const modelProviders = state._modelProviders || [];
  if (modelProviders.length) {
    for (const provider of modelProviders) {
      for (const m of provider.models) {
        availableModels.push({ id: m.id, label: m.name, provider: provider.provider, available: provider.available, hint: provider.hint });
      }
    }
  } else {
    // Fallback if models haven't loaded yet
    availableModels.push(
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic', available: true },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', provider: 'anthropic', available: true },
      { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', available: false },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', available: false },
    );
  }

  const probes = state.probes || [];
  const grouped = groupProbesByDomain(probes);

  // Group models by provider for display
  const modelsByProvider = {};
  for (const m of availableModels) {
    if (!modelsByProvider[m.provider]) modelsByProvider[m.provider] = [];
    modelsByProvider[m.provider].push(m);
  }

  let modelCheckboxes = '';
  for (const [provider, models] of Object.entries(modelsByProvider)) {
    const providerAvailable = models[0]?.available !== false;
    const hint = models[0]?.hint || '';
    modelCheckboxes += `<div style="margin-bottom:6px;">
      <div style="font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:${providerAvailable ? '#64748b' : '#374151'}; margin-bottom:3px; font-family:'JetBrains Mono',monospace;">
        ${escHtml(provider)}${!providerAvailable && hint ? ` — ${escHtml(hint)}` : ''}
      </div>`;
    for (const m of models) {
      const checked = selectedModels.includes(m.id);
      const disabled = m.available === false;
      modelCheckboxes += `<label class="compare-session-item${checked ? ' selected' : ''}" style="cursor:pointer; padding:6px 10px;${disabled ? ' opacity:0.5;' : ''}">
        <input type="checkbox" value="${escHtml(m.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
               onchange="toggleCompareModel('${escHtml(m.id)}', this.checked)"
               style="width:14px; height:14px; flex-shrink:0;" />
        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; color:${disabled ? '#4b5563' : '#e2e8f0'}; font-weight:500;">${escHtml(m.label)}</div>
        </div>
      </label>`;
    }
    modelCheckboxes += '</div>';
  }

  let probeCheckboxes = '';
  for (const [domain, domainProbes] of Object.entries(grouped)) {
    probeCheckboxes += `<div style="margin-bottom:8px;">
      <div style="font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#4b5563; margin-bottom:4px; font-family:'JetBrains Mono',monospace;">${escHtml(domain || 'uncategorized')}</div>`;
    for (const p of domainProbes) {
      const checked = selectedProbeIds.has(p.id);
      probeCheckboxes += `<label style="display:flex; align-items:center; gap:8px; padding:4px 8px; cursor:pointer; border-radius:4px; ${checked ? 'background:#1a2f4e;' : ''}" onmouseover="this.style.background='#1a1f2e'" onmouseout="this.style.background='${checked ? '#1a2f4e' : 'transparent'}'">
        <input type="checkbox" value="${p.id}" ${checked ? 'checked' : ''}
               onchange="toggleCompareProbe(${p.id}, this.checked)"
               style="width:13px; height:13px; flex-shrink:0;" />
        <span style="font-size:12px; color:#cbd5e1;">${escHtml(p.name)}</span>
      </label>`;
    }
    probeCheckboxes += '</div>';
  }

  const canRun = selectedModels.length >= 2 && selectedProbeIds.size >= 1;

  let html = `
    <div class="fade-in" style="max-width:800px;">
      ${viewHeader('Multi-Model Comparison', 'Run the same probes against multiple models, see results side-by-side')}

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
        <div>
          <div style="font-size:11px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#64748b; margin-bottom:8px; font-family:'JetBrains Mono',monospace;">Models (pick 2–5)</div>
          <div style="background:#121520; border:1px solid #1e2235; border-radius:6px; padding:8px; max-height:300px; overflow-y:auto;">
            ${modelCheckboxes}
          </div>
          <div style="margin-top:8px;">
            <input id="custom-model-input" type="text" placeholder="Or type a model ID..."
                   style="width:100%; font-size:12px; padding:6px 10px; background:#0f1117; border:1px solid #252a35; border-radius:4px; color:#e2e8f0; font-family:'JetBrains Mono',monospace;"
                   onkeydown="if(event.key==='Enter'){addCustomCompareModel(this.value);this.value='';}" />
          </div>
        </div>
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="font-size:11px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#64748b; font-family:'JetBrains Mono',monospace;">Probes (pick 1+)</div>
            <button onclick="selectAllCompareProbes()" style="font-size:10px; color:#3b82f6; background:none; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace;">Select All</button>
          </div>
          <div style="background:#121520; border:1px solid #1e2235; border-radius:6px; padding:8px; max-height:340px; overflow-y:auto;">
            ${probeCheckboxes || '<div style="color:#4b5563; font-size:12px; padding:8px;">No probes loaded. Load defaults first.</div>'}
          </div>
          <div style="margin-top:8px;">
            <textarea id="compare-custom-probe" placeholder="Or type a custom prompt to include..."
                      rows="2" style="width:100%; box-sizing:border-box; font-size:12px; padding:6px 10px; background:#0f1117; border:1px solid #f59e0b40; border-radius:4px; color:#e2e8f0; font-family:'JetBrains Mono',monospace; resize:vertical;"
                      onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#f59e0b40'"></textarea>
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:12px;">
        <button class="btn-primary" onclick="runMultiModelCompare()" ${canRun ? '' : 'disabled'} style="font-size:13px; padding:10px 24px;">
          Run Comparison (${selectedModels.length} models × ${selectedProbeIds.size} probes)
        </button>
        ${!canRun ? '<span style="font-size:11px; color:#374151; font-family:\'JetBrains Mono\',monospace;">Pick at least 2 models and 1 probe</span>' : ''}
      </div>
    </div>
  `;
  main.innerHTML = html;
}

export async function renderCompareView(sessionIds) {
  // Legacy session-based compare — redirect to new multi-model flow
  state.compareData = null;
  renderCompareSessionPicker();
}

function renderMultiModelResults(data) {
  const main = document.getElementById('main');
  state.compareData = data;

  const models = data.models || [];
  const results = data.results || [];
  const agreementPct = Math.round(data.agreement_rate || 0);
  const agreementColor = agreementPct >= 80 ? '#22c55e' : agreementPct >= 50 ? '#f59e0b' : '#ef4444';

  // Tally per model
  const tallies = {};
  for (const m of models) tallies[m] = { refused: 0, complied: 0, collapsed: 0, negotiated: 0 };
  for (const row of results) {
    for (const m of models) {
      const r = (row.models || {})[m];
      if (r && r.classification && tallies[m][r.classification] !== undefined) tallies[m][r.classification]++;
    }
  }

  const clsColor = (c) => ({ refused: '#ef4444', complied: '#22c55e', collapsed: '#f59e0b', negotiated: '#4a9eff' }[c] || '#555');
  const clsBg = (c) => ({ refused: 'rgba(239,68,68,0.08)', complied: 'rgba(34,197,94,0.08)', collapsed: 'rgba(245,158,11,0.08)', negotiated: 'rgba(74,158,255,0.08)' }[c] || 'transparent');

  let html = `
    <div class="fade-in" style="max-width:100%; padding-bottom:40px;">
      <!-- Header -->
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px;">
        <div>
          <h2 style="font-size:20px; font-weight:700; color:#e0e0e0; letter-spacing:0.02em; margin-bottom:6px;">Comparison Results</h2>
          <div style="font-size:12px; color:#777; letter-spacing:0.02em;">${models.map(m => `<span style="color:#999;">${escHtml(m)}</span>`).join(' <span style="color:#333; padding:0 4px;">vs</span> ')}</div>
        </div>
        <button onclick="clearAllViews(); showCompareModal();"
                style="padding:8px 16px; font-size:12px; color:#999; background:#0f0f0f; border:1px solid #1a1a1a; border-radius:8px; cursor:pointer; font-family:inherit; letter-spacing:0.03em; transition:all 0.2s;"
                onmouseenter="this.style.borderColor='#333';this.style.color='#e0e0e0';this.style.background='#141414'"
                onmouseleave="this.style.borderColor='#1a1a1a';this.style.color='#999';this.style.background='#0f0f0f'">New Comparison</button>
      </div>

      <!-- Stats bar -->
      <div style="display:flex; align-items:center; gap:24px; margin-bottom:28px; padding:16px 20px; background:#0f0f0f; border:1px solid #1a1a1a; border-radius:10px;">
        <div style="display:flex; align-items:baseline; gap:8px;">
          <span style="font-size:32px; font-weight:700; color:${agreementColor}; letter-spacing:-0.02em;">${agreementPct}%</span>
          <span style="font-size:11px; color:#777;">agreement</span>
        </div>
        <div style="width:1px; height:32px; background:#1a1a1a;"></div>
        <div style="font-size:11px; color:#777;">${results.filter(r => !r.disagreement).length} of ${results.length} probes aligned</div>
        <div style="margin-left:auto; display:flex; gap:20px;">
          ${models.map(m => {
            const t = tallies[m];
            const parts = m.split('-');
            const shortName = parts[0] === 'claude' ? 'claude' : parts[0] === 'gpt' ? parts.slice(0,2).join('-') : parts[0];
            return `<div style="text-align:center;">
              <div style="font-size:10px; color:#555; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px;">${escHtml(shortName)}</div>
              <div style="display:flex; gap:8px; font-size:11px; font-family:'JetBrains Mono',monospace;">
                <span style="color:#22c55e;">${t.complied}C</span>
                <span style="color:#ef4444;">${t.refused}R</span>
                <span style="color:#f59e0b;">${t.collapsed}X</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
  `;

  if (!results.length) {
    html += `<div style="text-align:center; color:#555; padding:40px; font-size:13px;">No results.</div>`;
  }

  for (const row of results) {
    const disagree = row.disagreement || false;
    const probe = state.probes?.find(p => String(p.id) === String(row.probe_id)) || {};
    const promptText = probe.prompt_text || row.probe_prompt || '';

    html += `
      <div style="margin-bottom:20px; border:1px solid ${disagree ? '#3d2e00' : '#1a1a1a'}; border-radius:10px; background:${disagree ? '#0d0c06' : '#0a0a0a'}; overflow:hidden;">
        <!-- Probe header -->
        <div style="padding:16px 20px; border-bottom:1px solid ${disagree ? '#3d2e00' : '#1a1a1a'}; display:flex; align-items:flex-start; gap:12px;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:${promptText ? '6px' : '0'}; flex-wrap:wrap;">
              <span style="font-size:14px; font-weight:600; color:#e0e0e0;">${escHtml(row.probe_name)}</span>
              <span style="font-size:10px; color:#555; font-family:'JetBrains Mono',monospace; text-transform:uppercase; letter-spacing:0.08em;">${escHtml(row.probe_domain || '')}</span>
              ${disagree ? '<span style="font-size:10px; color:#f59e0b; border:1px solid rgba(245,158,11,0.2); border-radius:4px; padding:1px 6px;">disagreement</span>' : ''}
            </div>
            ${promptText ? `<div style="font-size:11px; color:#555; line-height:1.5; font-family:'JetBrains Mono',monospace;">${escHtml(promptText).slice(0, 300)}${promptText.length > 300 ? '...' : ''}</div>` : ''}
          </div>
        </div>

        <!-- Model responses grid -->
        <div style="display:grid; grid-template-columns:repeat(${models.length}, 1fr);">
    `;

    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const r = (row.models || {})[m];
      const borderRight = i < models.length - 1 ? 'border-right:1px solid #1a1a1a;' : '';

      if (!r || r.error) {
        html += `
          <div style="padding:16px 20px; ${borderRight}">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
              <span style="font-size:11px; font-weight:600; color:#555; text-transform:uppercase; letter-spacing:0.06em;">${escHtml(m)}</span>
            </div>
            <div style="color:#ef4444; font-size:11px; padding:10px 12px; background:rgba(239,68,68,0.06); border-radius:6px; border:1px solid rgba(239,68,68,0.1);">
              ${r && r.error ? escHtml(r.error.slice(0, 150)) : 'No response'}
            </div>
          </div>
        `;
      } else {
        const cls = r.classification || 'unknown';
        const responseText = r.response || '';
        html += `
          <div style="padding:16px 20px; ${borderRight}">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
              <span style="font-size:11px; font-weight:600; color:#555; text-transform:uppercase; letter-spacing:0.06em;">${escHtml(m)}</span>
              <span style="font-size:10px; font-weight:600; color:${clsColor(cls)}; background:${clsBg(cls)}; padding:2px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:0.06em;">${escHtml(cls)}</span>
            </div>
            <div style="font-size:12px; color:#999; line-height:1.7; max-height:500px; overflow-y:auto; font-family:'JetBrains Mono',monospace; white-space:pre-wrap; word-break:break-word;">${formatResponseText(responseText)}</div>
          </div>
        `;
      }
    }

    html += `</div></div>`;
  }

  html += `</div>`;
  main.innerHTML = html;
}

export function toggleCompareMode() {
  state.compareMode = true;
  renderCompareSessionPicker();
}

export function exitCompareMode() {
  state.compareMode = false;
  state.compareData = null;
  render();
}

export function showCompareModal() {
  state.compareMode = true;
  state.compareData = null;
  if (!state.compareModels) state.compareModels = [];
  if (!state.compareProbeIds) state.compareProbeIds = [];
  renderCompareSessionPicker();
}

function _showCompareModal_legacy() {
  const modal = document.getElementById('compare-modal');
  const list = document.getElementById('compare-session-list');
  if (!modal || !list) {
    renderCompareSessionPicker();
    return;
  }
  const selectedIds = new Set(state.compareSessionIds);
  list.innerHTML = state.sessions.map(s => `
    <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#161922; border:1px solid #252a35; border-radius:4px; margin-bottom:6px; cursor:pointer;">
      <input type="checkbox" value="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''}
             style="width:14px; height:14px; flex-shrink:0;" />
      <div>
        <div style="font-size:13px; color:#e2e8f0; font-weight:500;">${escHtml(s.name)}</div>
        <div style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-top:2px;">${providerLabel(s.target_model)} ${escHtml(s.target_model || '')}</div>
      </div>
    </label>
  `).join('');
  modal.style.display = 'flex';
}

// ─── Consistency view ─────────────────────────────────────────────────────────

export async function renderConsistencyView() {
  const main = document.getElementById('main');
  if (!state.currentSession) {
    main.innerHTML = needsSession('Framing Variants');
    return;
  }

  main.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; padding:20px 0;">
      <span class="spinner"></span>
      <span style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">Loading consistency data...</span>
    </div>
  `;

  const { loadConsistency } = await import('./api.js');
  await loadConsistency(state.currentSession.id);
  const data = state.consistencyData;

  if (!data) {
    main.innerHTML = `<div style="color:#4b5563; padding:20px; font-family:'JetBrains Mono',monospace; font-size:13px;">Failed to load consistency data.</div>`;
    return;
  }

  const score = data.consistency_score;
  const scoreColor = score === null ? '#4b5563'
    : score >= 80 ? '#22c55e'
    : score >= 50 ? '#f59e0b'
    : '#ef4444';

  let html = `
    <div class="fade-in" style="max-width:900px;">
      ${viewHeader('Framing Variants', escHtml(state.currentSession.name) + ' — variant groups')}
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
        ${score !== null ? `
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="consistency-score" style="color:${scoreColor}; font-size:24px;">${score}%</span>
          <span style="font-size:10px; color:#4b5563; font-family:'JetBrains Mono',monospace;">consistency (${data.consistent_count}/${data.total_groups} groups)</span>
        </div>` : `
        <span style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">No data yet</span>`}
        <button class="btn-secondary" onclick="showVariantGroupBuilder()" style="font-size:12px;">+ New Group</button>
      </div>
      <div class="feature-description">
        <strong>Framing Consistency Testing</strong> — Do models respond consistently to the same request framed differently?
        Create variant groups with semantically equivalent probes (e.g., direct request vs. fiction framing vs. roleplay)
        and test whether the model's classification changes based purely on framing.
      </div>
  `;

  if (!data.groups || !data.groups.length) {
    html += `
      <div class="card" style="text-align:center; padding:32px;">
        <div style="font-size:13px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-bottom:12px;">No variant groups defined yet.</div>
        <button class="btn-primary" onclick="showVariantGroupBuilder()" style="font-size:12px;">Create a Variant Group</button>
      </div>
    `;
  } else {
    html += `
      <div style="overflow-x:auto; border:1px solid #252a35; border-radius:6px; margin-bottom:20px;">
        <table class="consistency-table">
          <thead>
            <tr>
              <th style="width:180px;">Group</th>
              <th>Variants &amp; Results</th>
              <th style="width:100px;">Consistent</th>
              <th style="width:80px;"></th>
            </tr>
          </thead>
          <tbody>
    `;
    for (const group of data.groups) {
      const rowClass = group.has_data && !group.consistent ? 'consistency-inconsistent' : '';
      html += `<tr class="${rowClass}">`;
      html += `<td style="font-size:12px; color:#94a3b8; font-family:'JetBrains Mono',monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;" title="${escHtml(group.group_id)}">${escHtml(group.group_id)}</td>`;
      html += `<td><div style="display:flex; flex-wrap:wrap; gap:12px;">`;
      for (const v of group.variants) {
        const badge = v.classification
          ? classificationBadge(v.classification, v.run_id, null)
          : `<span class="badge badge-unknown">not run</span>`;
        html += `
          <div style="display:flex; flex-direction:column; gap:3px; min-width:110px;">
            <div style="font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#4b5563; font-family:'JetBrains Mono',monospace;">${escHtml(v.variant_label)}</div>
            <div style="font-size:11px; color:#64748b; font-family:'JetBrains Mono',monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;" title="${escHtml(v.probe_name)}">${escHtml(v.probe_name)}</div>
            ${badge}
          </div>
        `;
      }
      html += `</div></td>`;
      if (!group.has_data) {
        html += `<td><span style="font-size:11px; color:#374151; font-family:'JetBrains Mono',monospace;">pending</span></td>`;
      } else if (group.consistent) {
        html += `<td><span style="font-size:11px; color:#22c55e; font-family:'JetBrains Mono',monospace; font-weight:600;">yes</span></td>`;
      } else {
        html += `<td><span style="font-size:11px; color:#f59e0b; font-family:'JetBrains Mono',monospace; font-weight:600;">no</span><span class="hint-text" style="margin-left:4px;">(classifications differ across framings)</span></td>`;
      }
      html += `<td><button onclick="deleteVariantGroup('${escHtml(group.group_id)}')" style="font-size:10px; color:#7f1d1d; background:none; border:none; cursor:pointer; font-family:'JetBrains Mono',monospace; padding:2px 6px;" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#7f1d1d'">delete</button></td>`;
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
  }

  // Inline variant group builder (hidden by default)
  html += `
    <div id="variant-group-builder" style="display:none;">
      <div class="card" style="border-color:#252a35;">
        <div class="card-label">Create Variant Group</div>
        <div class="hint-text">
          A variant group contains 2+ probes that ask the same thing in different ways.
          Labels describe the framing approach (e.g., "Direct", "Fiction", "Academic").
          Run all probes in a session, then check if the model gave consistent classifications.
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-bottom:6px;">Group ID</div>
          <input id="vg-group-id" type="text" placeholder="e.g. violence-framing" style="max-width:320px;" />
        </div>
        <div id="vg-variant-rows" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          ${renderVariantRow(0)}
          ${renderVariantRow(1)}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn-secondary" onclick="addVariantRow()" style="font-size:12px;">+ Add Variant</button>
          <button class="btn-primary" onclick="submitVariantGroup()" style="font-size:12px;">Create Group</button>
          <button class="btn-ghost" onclick="hideVariantGroupBuilder()" style="font-size:12px;">Cancel</button>
        </div>
      </div>
    </div>
  `;

  html += `</div>`;
  main.innerHTML = html;
}

function renderVariantRow(index) {
  const probes = state.probes || [];
  const defaultLabels = ['Direct Request', 'Fiction Framing', 'Academic Framing', 'Roleplay', 'Historical Context', 'Satire'];
  return `
    <div class="vg-row" style="display:flex; gap:8px; align-items:center;">
      <input type="text" class="vg-label" placeholder="Label" style="width:130px; flex-shrink:0;" value="${escHtml(defaultLabels[index] || '')}" />
      <select class="vg-probe" style="flex:1;">
        <option value="">— select probe —</option>
        ${probes.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('')}
      </select>
    </div>
  `;
}

// ─── View switching helper ────────────────────────────────────────────────────

function clearAllViews() {
  state.compareMode = false;
  state.compareData = null;
  state.settingsView = false;
  state.policyView = false;
  state.consistencyView = false;
  state.sequenceView = false;
  state.snapshotView = false;
}
window.clearAllViews = clearAllViews;

function goHome() {
  clearAllViews();
  render();
}
window.goHome = goHome;

function viewHeader(title, subtitle) {
  return `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
    <div>
      <div style="font-size:18px; font-weight:600; color:#f1f5f9; margin-bottom:2px;">${title}</div>
      ${subtitle ? `<div style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">${subtitle}</div>` : ''}
    </div>
    <button onclick="goHome()" style="background:#1a1d27; border:1px solid #2d3348; color:#94a3b8; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-family:'JetBrains Mono',monospace;">Back to Tools</button>
  </div>`;
}

function needsSession(toolName) {
  // Auto-open new session modal — they'll land back on the tool after creating one
  showNewSessionModal();
  return `<div class="fade-in" style="max-width:600px;">
    ${viewHeader(toolName, '')}
    <div style="text-align:center; padding:40px 0;">
      <div style="font-size:13px; color:#64748b; font-family:'JetBrains Mono',monospace;">
        Create a session to get started with ${toolName}
      </div>
    </div>
  </div>`;
}

// ─── Window bindings for onclick handlers in HTML strings ─────────────────────

window.render = render;
window.resetToProbe = resetToProbe;
window.exitBatch = exitBatch;
window.showCoachExamples = showCoachExamples;
window.toggleResponseExpand = toggleResponseExpand;
window.toggleCompareMode = toggleCompareMode;
window.exitCompareMode = exitCompareMode;
window.showCompareModal = showCompareModal;
window.renderCompareView = renderCompareView;
window.renderConsistencyView = renderConsistencyView;

window.showVariantGroupBuilder = function() {
  const el = document.getElementById('variant-group-builder');
  if (el) el.style.display = 'block';
};

window.hideVariantGroupBuilder = function() {
  const el = document.getElementById('variant-group-builder');
  if (el) el.style.display = 'none';
};

window.addVariantRow = function() {
  const container = document.getElementById('vg-variant-rows');
  if (!container) return;
  const index = container.querySelectorAll('.vg-row').length;
  const div = document.createElement('div');
  div.innerHTML = renderVariantRow(index);
  container.appendChild(div.firstElementChild);
};

window.submitVariantGroup = async function() {
  const groupId = (document.getElementById('vg-group-id')?.value || '').trim();
  if (!groupId) { showError('Group ID is required'); return; }
  const rows = document.querySelectorAll('#vg-variant-rows .vg-row');
  const probeIds = [];
  const labels = [];
  for (const row of rows) {
    const label = (row.querySelector('.vg-label')?.value || '').trim();
    const probeId = parseInt(row.querySelector('.vg-probe')?.value || '0');
    if (!label || !probeId) continue;
    labels.push(label);
    probeIds.push(probeId);
  }
  if (probeIds.length < 2) { showError('Need at least 2 variants'); return; }
  const { createVariantGroup } = await import('./api.js');
  const result = await createVariantGroup(groupId, probeIds, labels);
  if (result) {
    await renderConsistencyView();
  }
};

window.hideConsistencyView = function() {
  state.consistencyView = false;
  render();
};

window.toggleCompareCell = function(cellId) {
  const el = document.getElementById(cellId);
  if (!el) return;
  if (el.classList.contains('collapsed')) {
    el.classList.remove('collapsed');
    el.classList.add('expanded');
  } else {
    el.classList.remove('expanded');
    el.classList.add('collapsed');
  }
};

// ─── Multi-model compare handlers ─────────────────────────────────────────────

window.toggleCompareModel = function(modelId, checked) {
  if (!state.compareModels) state.compareModels = [];
  if (checked) {
    if (!state.compareModels.includes(modelId)) state.compareModels.push(modelId);
  } else {
    state.compareModels = state.compareModels.filter(m => m !== modelId);
  }
  renderCompareSessionPicker();
};

window.addCustomCompareModel = function(modelId) {
  const id = (modelId || '').trim();
  if (!id) return;
  if (!state.compareModels) state.compareModels = [];
  if (!state.compareModels.includes(id)) state.compareModels.push(id);
  renderCompareSessionPicker();
};

window.toggleCompareProbe = function(probeId, checked) {
  if (!state.compareProbeIds) state.compareProbeIds = [];
  const ids = new Set(state.compareProbeIds);
  if (checked) ids.add(probeId); else ids.delete(probeId);
  state.compareProbeIds = [...ids];
  renderCompareSessionPicker();
};

window.selectAllCompareProbes = function() {
  state.compareProbeIds = (state.probes || []).map(p => p.id);
  renderCompareSessionPicker();
};

window.runMultiModelCompare = async function() {
  const models = state.compareModels || [];
  const probeIds = [...(state.compareProbeIds || [])];

  // Check for custom prompt text
  const customText = document.getElementById('compare-custom-probe')?.value?.trim();
  if (customText) {
    try {
      const { createProbe, loadProbes } = await import('./api.js');
      const probe = await createProbe({ name: `custom-${Date.now()}`, domain: 'custom', prompt_text: customText });
      probeIds.push(probe.id);
      await loadProbes();
    } catch (e) {
      showError('Failed to create custom probe: ' + e.message);
      return;
    }
  }

  if (models.length < 2 || probeIds.length < 1) return;

  const main = document.getElementById('main');
  main.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:40px 0;">
      <span class="spinner"></span>
      <span style="font-size:13px; color:#94a3b8; font-family:'JetBrains Mono',monospace;">
        Running ${probeIds.length} probe${probeIds.length > 1 ? 's' : ''} against ${models.length} models...
      </span>
      <span style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace;">This may take a minute</span>
    </div>
  `;

  try {
    const resp = await fetch('/api/compare/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe_ids: probeIds, models }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      showError(err.detail || 'Comparison failed');
      renderCompareSessionPicker();
      return;
    }
    const data = await resp.json();
    renderMultiModelResults(data);
  } catch (e) {
    showError('Comparison failed: ' + e.message);
    renderCompareSessionPicker();
  }
};

window.closeCompareModal = function() {
  const modal = document.getElementById('compare-modal');
  if (modal) modal.style.display = 'none';
};

window.onProbeSearchInput = function(value) {
  state.probeSearch = value;
  renderProbeListOnly();
};

window.onProbeDomainChange = function(value) {
  state.probeDomainFilter = value;
  renderProbeListOnly();
};

window.clearProbeSearch = function() {
  state.probeSearch = '';
  renderProbeListOnly();
};

window.saveAnnotationNotes = function(runId) {
  const el = document.getElementById('annotation-notes');
  if (!el) return;
  import('./api.js').then(mod => mod.saveAnnotation(runId, { note_text: el.value }));
};

window.saveAnnotationFinding = function(runId) {
  const el = document.getElementById('annotation-finding');
  if (!el) return;
  import('./api.js').then(mod => mod.saveAnnotation(runId, { finding: el.value }));
};

window.handlePatternTagKey = async function(event, runId) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    const input = event.target;
    const tag = input.value.trim().replace(/,/g, '');
    if (!tag) return;
    const currentTags = (state.currentAnnotation?.pattern_tags || []);
    if (!currentTags.includes(tag)) {
      const newTags = [...currentTags, tag];
      const { saveAnnotation } = await import('./api.js');
      await saveAnnotation(runId, { pattern_tags: newTags });
      if (state.currentAnnotation) state.currentAnnotation.pattern_tags = newTags;
      if (!state.allPatternTags.includes(tag)) state.allPatternTags.push(tag);
    }
    input.value = '';
    render();
  }
};

window.removePatternTag = async function(runId, tag) {
  const currentTags = (state.currentAnnotation?.pattern_tags || []).filter(t => t !== tag);
  const { saveAnnotation } = await import('./api.js');
  await saveAnnotation(runId, { pattern_tags: currentTags });
  if (state.currentAnnotation) state.currentAnnotation.pattern_tags = currentTags;
  render();
};

// ─── Provider colors (used by policy browser) ────────────────────────────────

const PROVIDER_COLORS = {
  anthropic: '#f59e0b',
  openai: '#22c55e',
  google: '#3b82f6',
  xai: '#ef4444',
};

// ─── TOU Mapper / Policy Browser ─────────────────────────────────────────────

const SEVERITY_COLORS = { hard: '#ef4444', medium: '#f59e0b', soft: '#22c55e' };

export function renderPolicyBrowser() {
  const main = document.getElementById('main');
  if (!main) return;

  const providers = ['', 'anthropic', 'openai', 'google', 'xai'];
  const labels = ['All', 'Anthropic', 'OpenAI', 'Google', 'xAI'];
  const activeFilter = state.policyFilter || '';

  let tabs = '<div style="display:flex; gap:6px; margin-bottom:16px;">';
  providers.forEach((p, i) => {
    const active = p === activeFilter;
    const color = p ? PROVIDER_COLORS[p] : '#94a3b8';
    tabs += `<button class="provider-tab${active ? ' active' : ''}"
      style="color:${color}; ${active ? `border-color:${color}; background:${color}15;` : ''}"
      onclick="filterPoliciesByProvider('${p}')">${labels[i]}</button>`;
  });
  tabs += '</div>';

  let claimRows = '';
  const claims = state.policyClaims;
  if (typeof claims === 'object' && !Array.isArray(claims)) {
    for (const [provider, list] of Object.entries(claims)) {
      if (activeFilter && provider !== activeFilter) continue;
      if (!Array.isArray(list)) continue;
      for (const c of list) {
        const sevColor = SEVERITY_COLORS[c.severity] || '#94a3b8';
        const behaviorIcon = c.expected_behavior === 'should_allow'
          ? '<span title="Should Allow" style="color:#22c55e;">&#10003;</span>'
          : '<span title="Should Refuse" style="color:#ef4444;">&#9632;</span>';
        const provColor = PROVIDER_COLORS[provider] || '#94a3b8';
        claimRows += `
          <div class="claim-row" onclick="this.querySelector('.claim-detail').style.display=this.querySelector('.claim-detail').style.display==='none'?'block':'none'">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="severity-dot" style="background:${sevColor};" title="${escHtml(c.severity)}"></span>
              <span style="color:${provColor}; font-size:11px; min-width:60px;">${escHtml(provider.toUpperCase())}</span>
              <span style="font-weight:600; color:#e2e8f0; font-size:13px;">${escHtml(c.claim_id)}</span>
              <span style="color:#64748b; font-size:12px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(c.claim_text)}</span>
              <span style="font-size:11px; padding:2px 8px; background:#1a1d27; border-radius:4px; color:#94a3b8;">${escHtml(c.category)}</span>
              ${behaviorIcon}
            </div>
            <div class="claim-detail" style="display:none; margin-top:10px; padding:10px; background:#0f1117; border-radius:6px; font-size:12px; color:#94a3b8;">
              <div style="margin-bottom:6px;"><strong style="color:#e2e8f0;">Policy:</strong> ${escHtml(c.claim_text)}</div>
              <div style="margin-bottom:6px;"><strong style="color:#e2e8f0;">Testable:</strong> ${escHtml(c.testable_statement)}</div>
              ${c.notes ? `<div style="margin-bottom:6px;"><strong style="color:#e2e8f0;">Notes:</strong> ${escHtml(c.notes)}</div>` : ''}
              <div><strong style="color:#e2e8f0;">Expected:</strong> ${c.expected_behavior === 'should_allow' ? 'Should Allow' : 'Should Refuse'} · <strong style="color:#e2e8f0;">Severity:</strong> ${escHtml(c.severity)}</div>
            </div>
          </div>`;
      }
    }
  }

  if (!claimRows) {
    claimRows = '<div style="padding:24px; text-align:center; color:#4b5563;">No policy claims found.</div>';
  }

  main.innerHTML = `
    <div class="policy-browser">
      ${viewHeader('Policy Claims Browser', 'Browse published content policies by provider')}
      ${tabs}
      <div style="background:#121520; border:1px solid #1e2235; border-radius:8px; overflow:hidden;">
        ${claimRows}
      </div>
    </div>`;
}

export function renderComplianceScorecard() {
  const main = document.getElementById('main');
  if (!main || !state.complianceData) return;

  const data = state.complianceData;
  const summary = data.summary || {};
  const avgPct = ((summary.average_compliance_rate || 0) * 100).toFixed(0);

  let bars = '';
  const byProvider = data.by_provider || {};
  for (const [provider, categories] of Object.entries(byProvider)) {
    const provColor = PROVIDER_COLORS[provider] || '#94a3b8';
    bars += `<div style="margin-bottom:16px;">
      <div style="font-weight:600; color:${provColor}; font-size:14px; margin-bottom:8px;">${escHtml(provider.charAt(0).toUpperCase() + provider.slice(1))}</div>`;
    for (const [cat, claims] of Object.entries(categories)) {
      for (const claim of claims) {
        const rate = claim.compliance_rate != null ? claim.compliance_rate : 0;
        const pct = (rate * 100).toFixed(0);
        const barColor = rate >= 0.8 ? '#22c55e' : rate >= 0.5 ? '#f59e0b' : '#ef4444';
        bars += `
          <div style="margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; color:#94a3b8; margin-bottom:2px;">
              <span>${escHtml(claim.claim_slug || claim.claim_id || cat)}</span>
              <span style="color:${barColor}; font-weight:600;">${pct}%</span>
            </div>
            <div class="compliance-bar"><div class="compliance-fill" style="width:${pct}%; background:${barColor};"></div></div>
            <div style="font-size:11px; color:#4b5563;">${claim.probe_count} probes: ${claim.refused_count}R ${claim.collapsed_count}C ${claim.negotiated_count}N ${claim.complied_count}A</div>
          </div>`;
      }
    }
    bars += '</div>';
  }

  if (!bars) {
    bars = '<div style="padding:24px; text-align:center; color:#4b5563;">No compliance data. Link probes to policy claims and run them first.</div>';
  }

  main.innerHTML = `
    <div class="policy-browser">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="font-size:18px; font-weight:600; color:#f1f5f9; margin:0;">Compliance Scorecard</h2>
        <button onclick="hidePolicyView()" style="background:#1a1d27; border:1px solid #2d3348; color:#94a3b8; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px;">Back</button>
      </div>
      <div style="display:flex; gap:24px; margin-bottom:20px;">
        <div style="background:#121520; border:1px solid #1e2235; border-radius:8px; padding:16px; flex:1; text-align:center;">
          <div style="font-size:36px; font-weight:700; color:#f1f5f9;">${avgPct}%</div>
          <div style="font-size:12px; color:#64748b;">Avg Compliance</div>
        </div>
        <div style="background:#121520; border:1px solid #1e2235; border-radius:8px; padding:16px; flex:1; text-align:center;">
          <div style="font-size:36px; font-weight:700; color:#f1f5f9;">${summary.total_claims_tested || 0}</div>
          <div style="font-size:12px; color:#64748b;">Claims Tested</div>
        </div>
        <div style="background:#121520; border:1px solid #1e2235; border-radius:8px; padding:16px; flex:1; text-align:center;">
          <div style="font-size:36px; font-weight:700; color:#22c55e;">${summary.compliant_claims || 0}</div>
          <div style="font-size:12px; color:#64748b;">Compliant (≥80%)</div>
        </div>
      </div>
      <div style="background:#121520; border:1px solid #1e2235; border-radius:8px; padding:16px;">${bars}</div>
    </div>`;
}

// ─── Snapshot view ────────────────────────────────────────────────────────────

function renderSnapshotBrowser() {
  const main = document.getElementById('main');
  const snaps = state.snapshots || [];
  const sessionId = state.currentSession?.id;

  let html = `
    <div class="fade-in" style="max-width:720px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
        <div>
          <div style="font-size:18px; font-weight:600; color:#f1f5f9; margin-bottom:4px;">Regression Snapshots</div>
          <div style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">
            ${escHtml(state.currentSession?.name || '')} — saved baselines
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" onclick="showSaveSnapshotDialog()" style="font-size:12px;">+ Save Baseline</button>
          <button class="btn-ghost" onclick="hideSnapshotView()" style="font-size:12px;">Back</button>
        </div>
      </div>
  `;

  if (!snaps.length) {
    html += `
      <div style="text-align:center; padding:60px 0; color:#374151; font-family:'JetBrains Mono',monospace; font-size:13px;">
        No snapshots yet. Save a baseline to track regression.
      </div>
    `;
  } else {
    html += `<div class="snapshot-list">`;
    for (const snap of snaps) {
      html += `
        <div class="snapshot-item">
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:500; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(snap.name)}</div>
            ${snap.description ? `<div style="font-size:11px; color:#4b5563; font-family:'JetBrains Mono',monospace; margin-top:2px;">${escHtml(snap.description)}</div>` : ''}
            <div style="font-size:11px; color:#374151; font-family:'JetBrains Mono',monospace; margin-top:3px;">${escHtml(snap.created_at || '')}</div>
          </div>
          <div style="display:flex; gap:8px; flex-shrink:0;">
            <button class="btn-secondary" onclick="loadSnapshotDiff(${snap.id}, ${sessionId})" style="font-size:11px; padding:5px 12px;">
              Compare
            </button>
            <button class="btn-ghost" onclick="deleteSnapshot(${snap.id})" style="font-size:11px; padding:5px 10px; color:#ef4444; border-color:#7f1d1d;">
              Delete
            </button>
          </div>
        </div>
      `;
    }
    html += `</div>`;
  }

  html += `</div>`;
  main.innerHTML = html;
}

function renderSnapshotDiff() {
  const main = document.getElementById('main');
  const diff = state.snapshotDiff;
  if (!diff) { renderSnapshotBrowser(); return; }

  const changes = diff.changes || [];
  const changed = changes.filter(c => c.status !== 'unchanged');
  const unchanged = changes.filter(c => c.status === 'unchanged');
  const improved = changed.filter(c => c.status === 'improved').length;
  const regressed = changed.filter(c => c.status === 'regressed').length;
  const different = changed.filter(c => c.status === 'changed').length;
  const total = changes.length;

  const clsColor = { refused: '#fca5a5', collapsed: '#fcd34d', negotiated: '#93c5fd', complied: '#86efac', '': '#4b5563' };
  const statusColor = { improved: '#22c55e', regressed: '#ef4444', changed: '#f59e0b', unchanged: '#374151' };
  const statusLabel = { improved: 'improved', regressed: 'regressed', changed: 'different', unchanged: '—' };

  let html = `
    <div class="fade-in" style="max-width:900px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
        <div>
          <div style="font-size:18px; font-weight:600; color:#f1f5f9; margin-bottom:4px;">
            Diff: ${escHtml(diff.snapshot_name)}
          </div>
          <div style="font-size:12px; color:#4b5563; font-family:'JetBrains Mono',monospace;">
            ${escHtml(state.currentSession?.name || '')} — current vs baseline
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-ghost" onclick="state.snapshotDiff=null; render();" style="font-size:12px;">← Snapshots</button>
          <button class="btn-ghost" onclick="hideSnapshotView()" style="font-size:12px;">Back</button>
        </div>
      </div>

      <div class="diff-summary">
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          ${improved > 0 ? `<span style="color:#22c55e; font-weight:600;">${improved} improved</span>` : ''}
          ${regressed > 0 ? `<span style="color:#ef4444; font-weight:600;">${regressed} regressed</span>` : ''}
          ${different > 0 ? `<span style="color:#f59e0b;">${different} different</span>` : ''}
          <span style="color:#4b5563;">${unchanged.length} unchanged</span>
        </div>
        <div class="diff-summary-bar">
          ${total > 0 ? `
            <div style="width:${(improved/total*100).toFixed(1)}%; background:#22c55e;"></div>
            <div style="width:${(regressed/total*100).toFixed(1)}%; background:#ef4444;"></div>
            <div style="width:${(different/total*100).toFixed(1)}%; background:#f59e0b;"></div>
          ` : ''}
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="diff-table">
          <thead>
            <tr>
              <th>Probe</th>
              <th>Baseline</th>
              <th>Current</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
  `;

  for (const row of changed) {
    const cls = `diff-${row.status}`;
    html += `
      <tr class="${cls}">
        <td style="color:#cbd5e1; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(row.probe_name)}</td>
        <td><span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${clsColor[row.old_classification] || '#4b5563'};">${escHtml(row.old_classification || '—')}</span></td>
        <td><span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${clsColor[row.new_classification] || '#4b5563'};">${escHtml(row.new_classification || '—')}</span></td>
        <td><span style="font-size:11px; font-weight:600; color:${statusColor[row.status] || '#4b5563'}; font-family:'JetBrains Mono',monospace;">${statusLabel[row.status] || row.status}</span></td>
      </tr>
    `;
  }

  for (const row of unchanged) {
    html += `
      <tr class="diff-unchanged">
        <td style="color:#4b5563; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(row.probe_name)}</td>
        <td><span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${clsColor[row.old_classification] || '#374151'};">${escHtml(row.old_classification || '—')}</span></td>
        <td><span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${clsColor[row.new_classification] || '#374151'};">${escHtml(row.new_classification || '—')}</span></td>
        <td><span style="font-size:11px; color:#374151; font-family:'JetBrains Mono',monospace;">—</span></td>
      </tr>
    `;
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  main.innerHTML = html;
}

window.renderSnapshotBrowser = renderSnapshotBrowser;
window.renderSnapshotDiff = renderSnapshotDiff;


// ── Narrative Momentum UI ─────────────────────────────────────

function renderSequenceView() {
  const main = document.getElementById('main');
  const currentSession = state.currentSession;

  if (!currentSession) {
    main.innerHTML = needsSession('Narrative Momentum');
    return;
  }

  main.innerHTML = `
    <div class="fade-in" style="max-width:900px;">
      ${viewHeader('Narrative Momentum', 'Session: ' + escHtml(currentSession.name))}
      <div class="feature-description">
        <strong>Narrative Momentum</strong> — Test how multi-turn conversation context affects model compliance.
        A coach AI builds narrative context over several warmup turns before delivering the real probe.
        <strong>Auto-whittle</strong> finds the minimum warmup turns needed for compliance by testing at decreasing depths.
      </div>
      <div id="sequence-panel"></div>
      <div id="sequence-results" style="margin-top:1rem;"></div>
      <div id="turn-detail-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:50; align-items:center; justify-content:center;"></div>
    </div>
  `;

  renderSequencePanel();
}

function renderSequencePanel() {
  const container = document.getElementById('sequence-panel');
  if (!container) return;

  const strategies = state.strategies || [];
  const sequences = state.sequences || [];
  const probes = state.probes || [];
  const currentSession = state.currentSession;

  if (!currentSession) {
    container.innerHTML = '<p style="color:#4b5563; font-size:13px;">Select a session first</p>';
    return;
  }

  container.innerHTML = `
    <div style="background:#161922; border:1px solid #252a35; border-radius:6px; padding:16px; margin-bottom:16px;">
      <div style="font-size:13px; font-weight:600; color:#f1f5f9; margin-bottom:12px;">Create Narrative Sequence</div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        <span style="min-width:100px; color:#4b5563; font-size:12px; font-family:'JetBrains Mono',monospace;">Strategy</span>
        <select id="seq-strategy" style="flex:1;" onchange="(function(sel){ var d=document.getElementById('strategy-desc'); var opt=sel.options[sel.selectedIndex]; if(d) d.textContent=opt?opt.title:''; })(this)">
          ${strategies.map(s => `<option value="${s.id}" title="${escHtml(s.description || '')}">${escHtml((s.name || '').replace(/_/g, ' '))} (${escHtml(s.category || '')})</option>`).join('')}
        </select>
      </div>
      <div id="strategy-desc" class="hint-text" style="margin-top:4px; margin-bottom:8px; margin-left:112px;">${escHtml((strategies[0] && strategies[0].description) || '')}</div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        <span style="min-width:100px; color:#4b5563; font-size:12px; font-family:'JetBrains Mono',monospace;">Probe</span>
        <select id="seq-probe" style="flex:1;" onchange="document.getElementById('seq-custom-prompt').style.display = this.value==='custom' ? 'block' : 'none'">
          ${probes.map(p => `<option value="${p.id}">${escHtml(p.name)} [${escHtml(p.domain)}]</option>`).join('')}
          <option value="custom" style="color:#f59e0b;">— Custom Prompt —</option>
        </select>
      </div>
      <div id="seq-custom-prompt" style="display:none; margin-left:112px; margin-bottom:8px;">
        <textarea id="seq-custom-text" placeholder="Type your custom probe text..." rows="3"
                  style="width:100%; box-sizing:border-box; resize:vertical; font-size:12px; background:#0d0f16; border:1px solid #f59e0b40; border-radius:4px; color:#e2e8f0; padding:8px; font-family:'JetBrains Mono',monospace;"
                  onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#f59e0b40'"></textarea>
      </div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        <span style="min-width:100px; color:#4b5563; font-size:12px; font-family:'JetBrains Mono',monospace;">Mode</span>
        <select id="seq-mode" style="flex:1;">
          <option value="automatic">Automatic — run all warmup turns + probe at once</option>
          <option value="interactive">Interactive — step through turns manually, drop probe when ready</option>
        </select>
      </div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <span style="min-width:100px; color:#4b5563; font-size:12px; font-family:'JetBrains Mono',monospace;">Warmup Turns</span>
        <input type="range" id="seq-turns" min="1" max="20" value="10" style="flex:1; accent-color:#3b82f6;"
          oninput="document.getElementById('seq-turns-display').textContent = this.value">
        <span id="seq-turns-display" style="min-width:24px; text-align:center; color:#e2e8f0; font-size:13px; font-family:'JetBrains Mono',monospace;">10</span>
      </div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <span style="min-width:100px; color:#4b5563; font-size:12px; font-family:'JetBrains Mono',monospace;">IF Engine</span>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="seq-narrative-engine" style="accent-color:#8b5cf6; width:16px; height:16px;" onchange="document.getElementById('narrative-engine-hint').style.display = this.checked ? 'block' : 'none'">
          <span style="color:#e2e8f0; font-size:12px;">Use Interactive Fiction Narrative Engine</span>
        </label>
      </div>
      <div id="narrative-engine-hint" style="display:none; margin-left:112px; margin-bottom:12px; padding:8px 12px; background:#1e1033; border:1px solid #581c87; border-radius:4px; font-size:11px; color:#c084fc; line-height:1.5;">
        Sets the target AI as a collaborative storytelling engine with IF conventions (dialogue in quotes, directions in ((parentheses))). The coach will act as an IF player directing scenes — matching the methodology from the original research.
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn-primary" onclick="handleCreateSequence()" style="font-size:12px;">Create Sequence</button>
        <button class="btn-amber" onclick="handleCreateSequenceWhittle()" style="font-size:12px;">Create + Auto-Whittle</button>
      </div>
    </div>

    <div>
      <div style="font-size:13px; font-weight:600; color:#f1f5f9; margin-bottom:8px;">Sequences ${sequences.length ? '(' + sequences.length + ')' : ''}</div>
      ${sequences.length === 0 ? '<div style="color:#4b5563; font-size:12px; font-family:\'JetBrains Mono\',monospace;">No sequences yet</div>' : ''}
      ${sequences.map(s => renderSequenceCard(s)).join('')}
    </div>
  `;
}

function renderSequenceCard(seq) {
  const statusColors = { pending: '#4b5563', running: '#3b82f6', completed: '#22c55e', failed: '#ef4444' };
  const statusColor = statusColors[seq.status] || '#4b5563';
  const summary = seq.summary || {};
  const isRunning = seq.status === 'running';
  const isPending = seq.status === 'pending';
  const isInteractive = seq.mode === 'interactive';
  const isAutomatic = seq.mode === 'automatic';
  const loadingId = `seq-loading-${seq.id}`;

  return `
    <div class="card fade-in" style="margin-bottom:8px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span class="badge" style="background:${statusColor}; color:#fff;">${seq.status}</span>
        <span style="color:#6b7280; font-size:11px; font-family:'JetBrains Mono',monospace;">${isInteractive ? 'interactive' : 'automatic'}</span>
        ${seq.use_narrative_engine ? '<span class="badge" style="background:#581c87; color:#c084fc; font-size:9px; padding:1px 6px;">IF Engine</span>' : ''}
        <span style="margin-left:auto;"></span>
        <button onclick="event.stopPropagation(); handleDeleteSequence(${seq.id})" style="color:#7f1d1d; cursor:pointer; font-size:11px; background:none; border:none; padding:2px 4px;" title="Delete sequence">✕</button>
      </div>
      <div style="display:flex; gap:12px; font-size:12px; color:#6b7280; font-family:'JetBrains Mono',monospace; margin-bottom:6px;">
        <span>Warmup: ${seq.max_warmup_turns} turns</span>
        ${summary.threshold_found ? `<span style="background:#581c87; color:#c084fc; padding:1px 6px; border-radius:3px; font-size:11px;">Threshold: ${summary.threshold_warmup_count} turns</span>` : ''}
      </div>
      ${summary.total_runs ? `<div style="display:flex; gap:12px; font-size:12px; font-family:'JetBrains Mono',monospace; margin-bottom:6px;">
        <span style="color:#6b7280;">${summary.total_runs} runs</span>
        <span style="color:#22c55e;">${summary.complied || 0} complied</span>
        <span style="color:#ef4444;">${summary.refused || 0} refused</span>
      </div>` : ''}
      <div id="${loadingId}" style="display:none; color:#3b82f6; font-size:12px; font-family:'JetBrains Mono',monospace; margin-bottom:6px;">
        <span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #3b82f6; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-right:6px;"></span>
        Running... this may take a minute
      </div>
      ${isPending || isRunning ? `<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <button class="btn-primary" onclick="handleRunSequenceAuto(${seq.id})" style="font-size:11px; padding:4px 10px;">Run Auto</button>
        <button class="btn-amber" onclick="handleRunWhittle(${seq.id})" style="font-size:11px; padding:4px 10px;">Auto-Whittle</button>
        <span style="color:#2d3348; font-size:11px;">|</span>
        <button class="btn-secondary" onclick="handleRunSequenceTurn(${seq.id})" style="font-size:11px; padding:4px 10px;">Next Turn</button>
        <button class="btn-ghost" onclick="handleDropProbe(${seq.id})" style="font-size:11px; padding:4px 10px; color:#f59e0b; border-color:#f59e0b40;">Drop Probe</button>
      </div>
      <div id="sequence-turns-live-${seq.id}" style="margin-top:10px; max-height:400px; overflow-y:auto; border:1px solid #252a35; border-radius:4px; padding:8px; background:#0d0f16; display:none;"></div>
      <div id="warmup-status-${seq.id}" style="margin-top:6px; color:#6b7280; font-size:11px; font-family:'JetBrains Mono',monospace; display:none;">
        <span id="warmup-count-display-${seq.id}">0 / ${seq.max_warmup_turns}</span> warmup turns sent — click "Drop Probe" when ready to test
      </div>` : ''}
      ${seq.status === 'completed' ? `<div style="display:flex; gap:6px;">
        <button class="btn-secondary" onclick="handleViewSequence(${seq.id})" style="font-size:11px; padding:4px 10px;">View Results</button>
      </div>` : ''}
      ${seq.status === 'failed' ? `<div style="display:flex; gap:6px;">
        <button class="btn-secondary" onclick="handleViewSequence(${seq.id})" style="font-size:11px; padding:4px 10px;">View Details</button>
        <button class="btn-primary" onclick="handleRunSequenceAuto(${seq.id})" style="font-size:11px; padding:4px 10px;">Retry</button>
      </div>` : ''}
    </div>
  `;
}

function renderSequenceConversation(turns) {
  if (!turns || turns.length === 0) return '<div style="color:#4b5563; font-size:12px;">No turns yet</div>';

  return `
    <div style="max-height:500px; overflow-y:auto;">
      ${turns.map(t => {
        const classColor = getClassificationColorNM(t.classification);
        const typeLabel = t.turn_type === 'warmup' ? 'W' : t.turn_type === 'setup' ? 'S' : 'P';
        const typeBorder = t.turn_type === 'probe' ? 'border-left:3px solid #ef4444;' :
                           t.turn_type === 'setup' ? 'border-left:3px solid #f59e0b;' : '';
        const roleIcon = t.role === 'coach' ? '🎭' : t.role === 'probe' ? '🎯' : '🤖';
        const roleLabel = t.role === 'coach' ? 'Coach' : t.role === 'probe' ? 'Probe' : 'Target';

        return `<div style="background:#12141e; border-radius:4px; padding:8px; margin-bottom:4px; ${typeBorder}">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:11px;">
            <span style="font-weight:600; color:#94a3b8;">${roleIcon} ${roleLabel}</span>
            <span style="color:#374151;">#${t.turn_number}</span>
            <span class="badge" style="padding:1px 4px; font-size:9px; background:${t.turn_type === 'warmup' ? '#1e293b' : t.turn_type === 'setup' ? '#78350f' : '#450a0a'}; color:${t.turn_type === 'warmup' ? '#94a3b8' : t.turn_type === 'setup' ? '#fcd34d' : '#fca5a5'};">${typeLabel}</span>
            ${t.classification ? `<span class="badge" style="padding:1px 6px; font-size:9px; background:${classColor}; color:#fff;">${t.classification}</span>` : ''}
          </div>
          <div style="font-size:12px; color:#cbd5e1; line-height:1.6; white-space:pre-wrap; font-family:'JetBrains Mono',monospace;">${escHtml(t.content || '')}</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function getClassificationColorNM(classification) {
  const colors = { refused: '#ef4444', collapsed: '#f59e0b', negotiated: '#3b82f6', complied: '#22c55e' };
  return colors[classification] || '#4b5563';
}


// ── Narrative Momentum: Visualizations ────────────────────────

function renderThresholdChart(whittlingData) {
  if (!whittlingData || !whittlingData.length) return '<div style="color:#4b5563; font-size:12px;">No whittling data</div>';

  const maxTurns = Math.max(...whittlingData.map(d => d.warmup_count));

  return `
    <div style="background:#161922; border:1px solid #252a35; border-radius:6px; padding:16px;">
      <div style="font-size:13px; font-weight:600; color:#f1f5f9; margin-bottom:12px;">Compliance Threshold</div>
      <div style="display:flex; align-items:flex-end; gap:4px; height:150px; padding-bottom:28px;">
        ${whittlingData.map(d => {
          const color = getClassificationColorNM(d.probe_classification);
          const height = maxTurns > 0 ? (d.warmup_count / maxTurns * 100) : 0;
          const isThreshold = d.threshold_found;
          return `<div style="display:flex; flex-direction:column; align-items:center; flex:1; height:100%; justify-content:flex-end;" title="${d.warmup_count} turns: ${d.probe_classification || '?'}">
            <div style="width:100%; min-width:20px; max-width:40px; height:${Math.max(height, 5)}%; background:${color}; border-radius:3px 3px 0 0; ${isThreshold ? 'box-shadow:0 0 8px ' + color + ';' : ''}"></div>
            <span style="font-size:10px; color:#4b5563; margin-top:4px; font-family:'JetBrains Mono',monospace;">${d.warmup_count}</span>
            <span style="font-size:9px; font-weight:700; color:#94a3b8; font-family:'JetBrains Mono',monospace;">${(d.probe_classification || '?')[0].toUpperCase()}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex; gap:12px; margin-top:8px; font-size:11px; color:#6b7280; font-family:'JetBrains Mono',monospace;">
        <span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; margin-right:4px;"></span>Complied</span>
        <span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#f59e0b; margin-right:4px;"></span>Collapsed</span>
        <span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; margin-right:4px;"></span>Refused</span>
      </div>
    </div>
  `;
}

function renderTurnTimeline(turnClassifications) {
  if (!turnClassifications || !turnClassifications.length) return '<div style="color:#4b5563; font-size:12px;">No classification data</div>';

  return `
    <div style="background:#161922; border:1px solid #252a35; border-radius:6px; padding:16px;">
      <div style="font-size:13px; font-weight:600; color:#f1f5f9; margin-bottom:12px;">Turn-by-Turn Classification</div>
      ${turnClassifications.map(run => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span style="min-width:50px; font-size:11px; color:#4b5563; text-align:right; font-family:'JetBrains Mono',monospace;">N=${run.warmup_count}</span>
          <div style="display:flex; gap:2px; flex:1;">
            ${(run.turns || []).map(t => {
              const color = getClassificationColorNM(t.classification);
              const borderStyle = t.turn_type === 'probe' ? 'border:2px solid #ef4444;' : t.turn_type === 'setup' ? 'border:2px solid #f59e0b;' : '';
              return `<div style="width:24px; height:24px; border-radius:3px; display:flex; align-items:center; justify-content:center; cursor:pointer; background:${t.classification ? color : '#1e2130'}; ${borderStyle} transition:transform 0.1s;"
                onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'"
                title="Turn ${t.turn_number} (${t.turn_type}): ${t.classification || 'n/a'}">
                <span style="font-size:8px; font-weight:700; color:rgba(255,255,255,0.7); font-family:'JetBrains Mono',monospace;">${t.turn_type[0].toUpperCase()}</span>
              </div>`;
            }).join('')}
          </div>
          <span style="min-width:70px; font-size:11px; font-weight:600; font-family:'JetBrains Mono',monospace; color:${getClassificationColorNM(run.probe_classification)};">${run.probe_classification || '?'}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCrossProbeComparison(thresholds) {
  if (!thresholds || !thresholds.length) return '<div style="color:#4b5563; font-size:12px;">No comparison data</div>';

  const sorted = [...thresholds].sort((a, b) => (b.threshold_turns || 0) - (a.threshold_turns || 0));

  return `
    <div style="background:#161922; border:1px solid #252a35; border-radius:6px; padding:16px;">
      <div style="font-size:13px; font-weight:600; color:#f1f5f9; margin-bottom:12px;">Cross-Probe Threshold Comparison</div>
      <table style="width:100%; border-collapse:collapse; font-size:12px; font-family:'JetBrains Mono',monospace;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px 8px; font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#4b5563; border-bottom:1px solid #252a35;">Probe</th>
            <th style="text-align:left; padding:6px 8px; font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#4b5563; border-bottom:1px solid #252a35;">Domain</th>
            <th style="text-align:left; padding:6px 8px; font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#4b5563; border-bottom:1px solid #252a35;">Strategy</th>
            <th style="text-align:left; padding:6px 8px; font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#4b5563; border-bottom:1px solid #252a35;">Threshold</th>
            <th style="text-align:left; padding:6px 8px; font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:#4b5563; border-bottom:1px solid #252a35;">Visual</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(t => {
            const barWidth = t.threshold_turns ? Math.min(t.threshold_turns * 10, 100) : 0;
            return `<tr style="border-bottom:1px solid #1e2130;">
              <td style="padding:6px 8px; color:#cbd5e1;">${escHtml(t.probe_name || '')}</td>
              <td style="padding:6px 8px; color:#6b7280;">${escHtml(t.domain || '')}</td>
              <td style="padding:6px 8px; color:#6b7280;">${escHtml(t.strategy_name || '')}</td>
              <td style="padding:6px 8px; color:#e2e8f0;">${t.threshold_turns !== null && t.threshold_turns !== undefined ? t.threshold_turns + ' turns' : 'N/A'}</td>
              <td style="padding:6px 8px;"><div style="width:${barWidth}%; height:12px; border-radius:2px; min-width:2px; background:${getClassificationColorNM(t.probe_classification)};"></div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderStrategyEffectiveness(data) {
  if (!data || !data.length) return '<div style="color:#4b5563; font-size:12px;">No strategy data</div>';

  return `
    <div style="background:#161922; border:1px solid #252a35; border-radius:6px; padding:16px;">
      <div style="font-size:13px; font-weight:600; color:#f1f5f9; margin-bottom:12px;">Strategy Effectiveness</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${data.map(d => {
          const successRate = d.sequence_count > 0 ? (d.success_count / d.sequence_count * 100) : 0;
          const barColor = successRate > 60 ? '#22c55e' : successRate > 30 ? '#f59e0b' : '#ef4444';
          return `<div style="display:flex; align-items:center; gap:8px;">
            <span style="min-width:120px; font-size:12px; color:#94a3b8; text-transform:capitalize; font-family:'JetBrains Mono',monospace;">${escHtml((d.name || '').replace(/_/g, ' '))}</span>
            <div style="flex:1; height:16px; background:#0d0f16; border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${successRate}%; background:${barColor}; border-radius:3px; transition:width 0.3s;"></div>
            </div>
            <span style="min-width:80px; font-size:11px; color:#6b7280; text-align:right; font-family:'JetBrains Mono',monospace;">${Math.round(successRate)}% (${d.success_count}/${d.sequence_count})</span>
            ${d.avg_threshold !== null && d.avg_threshold !== undefined ? `<span style="font-size:10px; color:#a855f7; font-family:'JetBrains Mono',monospace;">avg ${Math.round(d.avg_threshold)} turns</span>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderSequenceResults(sequenceId) {
  const container = document.getElementById('sequence-results');
  if (!container) return;

  container.innerHTML = `<div style="display:flex; align-items:center; gap:8px; color:#4b5563; font-size:12px;"><span class="spinner"></span> Loading results...</div>`;

  Promise.all([
    window.fetchSequence(sequenceId),
    window.fetchWhittlingResults(sequenceId),
    window.fetchTurnClassifications(sequenceId),
  ]).then(([sequence, whittling, turnClassifications]) => {
    state.whittlingData = whittling;
    state.turnHeatmapData = turnClassifications;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div>${renderThresholdChart(whittling)}</div>
        <div>${renderTurnTimeline(turnClassifications)}</div>
        ${sequence.runs ? `<div style="grid-column:1/-1;">
          <div style="background:#161922; border:1px solid #252a35; border-radius:6px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
              <div style="font-size:13px; font-weight:600; color:#f1f5f9;">Sequence Runs</div>
              <div style="display:flex; gap:8px;">
                <button class="btn-ghost" onclick="expandAllRunTurns([${sequence.runs.map(r => r.id).join(',')}])" style="font-size:10px; padding:3px 8px;">Expand All</button>
                <button class="btn-ghost" onclick="collapseAllRunTurns()" style="font-size:10px; padding:3px 8px;">Collapse All</button>
              </div>
            </div>
            ${sequence.runs.map(run => `
              <div style="margin-bottom:6px;">
                <div onclick="toggleRunTurnsInline(${run.id}, this)" style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:#12141e; border-radius:4px; cursor:pointer; font-size:12px; color:#94a3b8; font-family:'JetBrains Mono',monospace; transition:background 0.1s; border:1px solid transparent;"
                  onmouseenter="this.style.background='#1a1e2e'; this.style.borderColor='#252a35'" onmouseleave="this.style.background='#12141e'; this.style.borderColor='transparent'">
                  <span style="color:#4b5563; font-size:10px; transition:transform 0.2s;" class="run-chevron-${run.id}">▶</span>
                  <span style="font-weight:600;">N=${run.warmup_count}</span>
                  <span class="badge" style="background:${getClassificationColorNM(run.probe_classification)}; color:#fff; padding:1px 6px; font-size:10px;">${run.probe_classification || '?'}</span>
                  ${run.threshold_found ? '<span style="color:#a855f7; font-size:11px;">⚡ Threshold</span>' : ''}
                  <span style="margin-left:auto; color:#374151; font-size:10px;">click to view turns</span>
                </div>
                <div id="run-turns-inline-${run.id}" style="display:none; margin-top:2px; margin-left:18px; border-left:2px solid #252a35; padding-left:12px;"></div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}
      </div>
    `;
  }).catch(err => {
    container.innerHTML = `<div style="color:#ef4444; font-size:12px;">Error loading results: ${escHtml(err.message)}</div>`;
  });
}


// ── Narrative Momentum: Event Handlers ────────────────────────

async function resolveSeqProbeId() {
  const sel = document.getElementById('seq-probe');
  if (sel.value !== 'custom') return parseInt(sel.value);
  const text = document.getElementById('seq-custom-text')?.value?.trim();
  if (!text) { showError('Enter custom probe text.'); return null; }
  const { createProbe, loadProbes } = await import('./api.js');
  const probe = await createProbe({ name: `custom-${Date.now()}`, domain: 'custom', prompt_text: text });
  await loadProbes();
  return probe.id;
}

async function handleCreateSequence() {
  const sessionId = state.currentSession?.id;
  if (!sessionId) return;

  const probeId = await resolveSeqProbeId();
  if (!probeId) return;

  const body = {
    probe_id: probeId,
    strategy_id: parseInt(document.getElementById('seq-strategy').value),
    mode: document.getElementById('seq-mode').value,
    max_warmup_turns: parseInt(document.getElementById('seq-turns').value),
    use_narrative_engine: document.getElementById('seq-narrative-engine')?.checked || false,
  };

  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  try {
    const seq = await window.createSequence(sessionId, body);
    await refreshSequences();
  } catch (e) {
    showError('Failed to create sequence: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Create Sequence'; }
  }
}

async function handleCreateSequenceWhittle() {
  const sessionId = state.currentSession?.id;
  if (!sessionId) return;

  const probeId = await resolveSeqProbeId();
  if (!probeId) return;

  const body = {
    probe_id: probeId,
    strategy_id: parseInt(document.getElementById('seq-strategy').value),
    mode: 'automatic',
    max_warmup_turns: parseInt(document.getElementById('seq-turns').value),
    use_narrative_engine: document.getElementById('seq-narrative-engine')?.checked || false,
  };

  // Disable the button and show loading
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  try {
    const seq = await window.createSequence(sessionId, body);
    await refreshSequences();
    await handleRunWhittle(seq.id);
  } catch (e) {
    showError('Failed to create sequence: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Create + Auto-Whittle'; }
  }
}

async function handleRunSequenceAuto(seqId) {
  const loadingEl = document.getElementById(`seq-loading-${seqId}`);
  const btns = loadingEl?.parentElement?.querySelectorAll('button');
  if (loadingEl) {
    loadingEl.style.display = 'block';
    loadingEl.innerHTML = `
      <span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #3b82f6; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-right:6px;"></span>
      <span id="seq-progress-${seqId}">Starting...</span>
    `;
  }
  if (btns) btns.forEach(b => b.disabled = true);

  const typeLabels = { warmup: 'Warmup', setup: 'Setup', probe: 'Probe' };
  const classColors = { complied: '#22c55e', refused: '#ef4444', negotiated: '#f59e0b', unknown: '#6b7280' };

  try {
    await window.runSequenceAuto(seqId, (evt) => {
      const progressEl = document.getElementById(`seq-progress-${seqId}`);
      if (!progressEl) return;

      if (evt._event === 'turn') {
        const color = classColors[evt.classification] || '#6b7280';
        progressEl.innerHTML = `Turn ${evt.step}/${evt.total_steps} — <span style="color:${color};">${typeLabels[evt.turn_type] || evt.turn_type}</span> → ${evt.classification}`;
      } else if (evt._event === 'complete') {
        const color = classColors[evt.probe_classification] || '#6b7280';
        progressEl.innerHTML = `Done! Probe result: <span style="color:${color}; font-weight:600;">${evt.probe_classification}</span>`;
      } else if (evt._event === 'error') {
        progressEl.innerHTML = `<span style="color:#ef4444;">Error: ${evt.error}</span>`;
      }
    });
    await refreshSequences();
    renderSequenceResults(seqId);
  } catch (e) {
    showError('Failed to run sequence: ' + e.message);
    if (loadingEl) loadingEl.style.display = 'none';
    if (btns) btns.forEach(b => b.disabled = false);
  }
}

async function handleRunSequenceTurn(seqId) {
  // Find and disable the button, show loading
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  // Show the live turns container
  const turnContainer = document.getElementById(`sequence-turns-live-${seqId}`);
  const statusEl = document.getElementById(`warmup-status-${seqId}`);
  if (turnContainer) turnContainer.style.display = 'block';
  if (statusEl) statusEl.style.display = 'block';

  try {
    const result = await window.runSequenceTurn(seqId);
    if (turnContainer) {
      // Clear placeholder text on first turn
      if (turnContainer.querySelector('[data-placeholder]')) turnContainer.innerHTML = '';
      const newTurns = [result.coach_turn, result.target_turn].filter(Boolean);
      turnContainer.innerHTML += renderSequenceConversation(newTurns);
      turnContainer.scrollTop = turnContainer.scrollHeight;
    }
    const countEl = document.getElementById(`warmup-count-display-${seqId}`);
    if (countEl) {
      countEl.textContent = `${result.warmup_turns_sent} / ${result.warmup_turns_planned}`;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Next Turn'; }
  } catch (e) {
    showError('Failed to run turn: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Next Turn'; }
  }
}

async function handleDropProbe(seqId) {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Dropping...'; }
  try {
    const result = await window.dropSequenceProbe(seqId);
    const turnContainer = document.getElementById('sequence-turns-live');
    if (turnContainer) {
      turnContainer.innerHTML += renderSequenceConversation(result.turns);
      turnContainer.scrollTop = turnContainer.scrollHeight;
    }
    await refreshSequences();
  } catch (e) {
    showError('Failed to drop probe: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Drop Probe'; }
  }
}

async function handleRunWhittle(seqId) {
  const loadingEl = document.getElementById(`seq-loading-${seqId}`);
  const btns = loadingEl?.parentElement?.querySelectorAll('button');
  if (loadingEl) {
    loadingEl.style.display = 'block';
    loadingEl.innerHTML = '<span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #f59e0b; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-right:6px;"></span>Whittling... running multiple passes, this takes a few minutes';
  }
  if (btns) btns.forEach(b => b.disabled = true);
  try {
    await window.runWhittle(seqId);
    await refreshSequences();
    renderSequenceResults(seqId);
  } catch (e) {
    showError('Failed to run whittling: ' + e.message);
    if (loadingEl) loadingEl.style.display = 'none';
    if (btns) btns.forEach(b => b.disabled = false);
  }
}

async function handleDeleteSequence(seqId) {
  try {
    await window.deleteSequence(seqId);
    await refreshSequences();
  } catch (e) {
    showError('Failed to delete sequence: ' + e.message);
  }
}

async function handleViewSequence(seqId) {
  renderSequenceResults(seqId);
}

async function handleViewRunTurns(runId) {
  try {
    const resp = await fetch(`/api/sequence-runs/${runId}/turns`);
    const turns = await resp.json();
    const modal = document.getElementById('turn-detail-modal');
    if (modal) {
      modal.innerHTML = `
        <div style="background:#161922; border:1px solid #252a35; border-radius:8px; padding:24px; max-width:700px; width:90%; max-height:80vh; overflow-y:auto;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <span style="font-size:15px; font-weight:600; color:#f1f5f9;">Run #${runId} — Turn Detail</span>
            <button class="btn-ghost" onclick="document.getElementById('turn-detail-modal').style.display='none'" style="font-size:11px; padding:4px 10px;">Close</button>
          </div>
          ${renderSequenceConversation(turns)}
        </div>
      `;
      modal.style.display = 'flex';
    }
  } catch (e) {
    showError('Failed to load turns: ' + e.message);
  }
}

async function toggleRunTurnsInline(runId, headerEl) {
  const container = document.getElementById(`run-turns-inline-${runId}`);
  if (!container) return;

  const isVisible = container.style.display !== 'none';
  if (isVisible) {
    container.style.display = 'none';
    const chevron = headerEl?.querySelector(`.run-chevron-${runId}`);
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    return;
  }

  // Show and load if empty
  container.style.display = 'block';
  const chevron = headerEl?.querySelector(`.run-chevron-${runId}`);
  if (chevron) chevron.style.transform = 'rotate(90deg)';

  if (!container.dataset.loaded) {
    container.innerHTML = '<div style="color:#4b5563; font-size:11px; padding:8px;">Loading turns...</div>';
    try {
      const resp = await fetch(`/api/sequence-runs/${runId}/turns`);
      const turns = await resp.json();
      container.dataset.loaded = 'true';
      container.innerHTML = renderSequenceConversation(turns);
    } catch (e) {
      container.innerHTML = `<div style="color:#ef4444; font-size:11px; padding:8px;">Failed to load: ${escHtml(e.message)}</div>`;
    }
  }
}

async function expandAllRunTurns(runIds) {
  for (const runId of runIds) {
    const container = document.getElementById(`run-turns-inline-${runId}`);
    if (!container) continue;
    container.style.display = 'block';
    const chevron = document.querySelector(`.run-chevron-${runId}`);
    if (chevron) chevron.style.transform = 'rotate(90deg)';

    if (!container.dataset.loaded) {
      container.innerHTML = '<div style="color:#4b5563; font-size:11px; padding:8px;">Loading turns...</div>';
      try {
        const resp = await fetch(`/api/sequence-runs/${runId}/turns`);
        const turns = await resp.json();
        container.dataset.loaded = 'true';
        container.innerHTML = renderSequenceConversation(turns);
      } catch (e) {
        container.innerHTML = `<div style="color:#ef4444; font-size:11px; padding:8px;">Failed to load</div>`;
      }
    }
  }
}

function collapseAllRunTurns() {
  document.querySelectorAll('[id^="run-turns-inline-"]').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('[class^="run-chevron-"]').forEach(el => {
    el.style.transform = 'rotate(0deg)';
  });
}

async function refreshSequences() {
  const sessionId = state.currentSession?.id;
  if (!sessionId) return;

  try {
    const [sequences, strategies] = await Promise.all([
      window.fetchSequences(sessionId),
      window.fetchStrategies(),
    ]);
    state.sequences = sequences;
    state.strategies = strategies;
    renderSequencePanel();
  } catch (e) {
    showError('Failed to refresh sequences: ' + e.message);
  }
}

// Expose handlers globally
window.handleCreateSequence = handleCreateSequence;
window.handleCreateSequenceWhittle = handleCreateSequenceWhittle;
window.handleRunSequenceAuto = handleRunSequenceAuto;
window.handleRunSequenceTurn = handleRunSequenceTurn;
window.handleDropProbe = handleDropProbe;
window.handleRunWhittle = handleRunWhittle;
window.handleDeleteSequence = handleDeleteSequence;
window.handleViewSequence = handleViewSequence;
window.handleViewRunTurns = handleViewRunTurns;
window.toggleRunTurnsInline = toggleRunTurnsInline;
window.expandAllRunTurns = expandAllRunTurns;
window.collapseAllRunTurns = collapseAllRunTurns;
window.refreshSequences = refreshSequences;
window.renderSequencePanel = renderSequencePanel;
window.renderSequenceResults = renderSequenceResults;
window.renderThresholdChart = renderThresholdChart;
window.renderTurnTimeline = renderTurnTimeline;
window.renderCrossProbeComparison = renderCrossProbeComparison;
window.renderStrategyEffectiveness = renderStrategyEffectiveness;


// ── Settings View ─────────────────────────────────────────────

async function renderSettingsView() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="fade-in" style="max-width:600px;">
      ${viewHeader('Settings', 'API keys and configuration')}
      <div id="settings-keys" style="color:#6b7280;">Loading...</div>
    </div>
  `;

  try {
    const keys = await window.fetchApiKeys();
    state.apiKeys = keys;
    const container = document.getElementById('settings-keys');
    if (!container) return;

    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <h3 style="color:#e0e0e0; font-size:14px; margin:0 0 4px;">API Keys</h3>
        <p style="font-size:12px; color:#6b7280; margin:0 0 16px;">Configure API keys for the model providers you want to test. Keys are stored in your local .env file.</p>
      </div>
      ${keys.map(k => `
        <div class="card" style="background:#1a1d27; border-radius:8px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
              <span style="color:#e0e0e0; font-weight:600; font-size:13px;">${escHtml(k.label)}</span>
              ${k.required ? '<span style="color:#e74c3c; font-size:10px; margin-left:6px;">REQUIRED</span>' : '<span style="color:#6b7280; font-size:10px; margin-left:6px;">optional</span>'}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${k.is_set
                ? `<span style="color:#27ae60; font-size:11px;">● Set</span>
                   <span style="color:#4b5563; font-size:11px; font-family:'JetBrains Mono',monospace;">${escHtml(k.masked)}</span>`
                : '<span style="color:#e74c3c; font-size:11px;">○ Not set</span>'}
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="password" id="key-${k.env_var}" placeholder="${k.is_set ? 'Leave blank to keep current' : 'Enter API key...'}"
              style="flex:1; background:#0d0f16; border:1px solid #2a2d3a; color:#e0e0e0; padding:8px 10px; border-radius:4px; font-size:12px; font-family:'JetBrains Mono',monospace;"
              onkeydown="if(event.key==='Enter') handleSaveKey('${k.env_var}')">
            <button onclick="handleSaveKey('${k.env_var}')" style="background:#3498db; color:#fff; border:none; border-radius:4px; padding:8px 12px; cursor:pointer; font-size:12px; white-space:nowrap;">Save</button>
            ${k.is_set ? `<button onclick="handleTestKey('${k.provider}', this)" style="background:none; color:#6b7280; border:1px solid #2a2d3a; border-radius:4px; padding:8px 12px; cursor:pointer; font-size:12px; white-space:nowrap;">Test</button>
            <button onclick="handleClearKey('${k.env_var}')" style="background:none; color:#e74c3c; border:1px solid #3a2020; border-radius:4px; padding:8px 10px; cursor:pointer; font-size:12px;" title="Clear key">✕</button>` : ''}
          </div>
          <div id="key-status-${k.env_var}" style="margin-top:6px; font-size:11px; min-height:16px;"></div>
        </div>
      `).join('')}
      <div style="margin-top:24px; padding:12px; background:#12141e; border-radius:6px; font-size:11px; color:#4b5563;">
        Keys are stored in <code style="color:#6b7280;">.env</code> in the project root. This file is gitignored — your keys won't be committed.
      </div>
    `;
  } catch (e) {
    const container = document.getElementById('settings-keys');
    if (container) container.innerHTML = `<p style="color:#e74c3c;">Failed to load settings: ${escHtml(e.message)}</p>`;
  }
}

async function handleSaveKey(envVar) {
  const input = document.getElementById(`key-${envVar}`);
  const status = document.getElementById(`key-status-${envVar}`);
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    if (status) status.innerHTML = '<span style="color:#f59e0b;">No value entered</span>';
    return;
  }

  if (status) status.innerHTML = '<span style="color:#6b7280;">Saving...</span>';

  try {
    await window.updateApiKeys({ [envVar]: value });
    input.value = '';
    if (status) status.innerHTML = '<span style="color:#27ae60;">Saved ✓</span>';
    // Re-render to update masked display
    setTimeout(() => renderSettingsView(), 800);
  } catch (e) {
    if (status) status.innerHTML = `<span style="color:#e74c3c;">Error: ${escHtml(e.message)}</span>`;
  }
}

async function handleClearKey(envVar) {
  const status = document.getElementById(`key-status-${envVar}`);
  if (status) status.innerHTML = '<span style="color:#6b7280;">Clearing...</span>';

  try {
    await window.updateApiKeys({ [envVar]: '' });
    if (status) status.innerHTML = '<span style="color:#f59e0b;">Cleared</span>';
    setTimeout(() => renderSettingsView(), 800);
  } catch (e) {
    if (status) status.innerHTML = `<span style="color:#e74c3c;">Error: ${escHtml(e.message)}</span>`;
  }
}

async function handleTestKey(provider, btn) {
  const envVar = state.apiKeys.find(k => k.provider === provider)?.env_var;
  const status = document.getElementById(`key-status-${envVar}`);
  if (btn) btn.disabled = true;
  if (status) status.innerHTML = '<span style="color:#6b7280;">Testing connection...</span>';

  try {
    const result = await window.testApiKey(provider);
    if (result.ok) {
      if (status) status.innerHTML = `<span style="color:#27ae60;">✓ ${escHtml(result.message)}</span>`;
    } else {
      if (status) status.innerHTML = `<span style="color:#e74c3c;">✕ ${escHtml(result.error)}</span>`;
    }
  } catch (e) {
    if (status) status.innerHTML = `<span style="color:#e74c3c;">Error: ${escHtml(e.message)}</span>`;
  }
  if (btn) btn.disabled = false;
}

window.handleSaveKey = handleSaveKey;
window.handleClearKey = handleClearKey;
window.handleTestKey = handleTestKey;
window.renderSettingsView = renderSettingsView;
