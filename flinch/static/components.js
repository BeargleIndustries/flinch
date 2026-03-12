// ─── Components ───────────────────────────────────────────────────────────────

import { state, setPhase } from './state.js';
import { api } from './api.js';

export function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeClassification(cls) {
  if (!cls) return 'unknown';
  return cls.toLowerCase();
}

export function extractSuggestionText(coachSuggestion) {
  if (!coachSuggestion) return '';
  if (typeof coachSuggestion === 'object') {
    return coachSuggestion.pushback_draft || coachSuggestion.pushback_text || '';
  }
  return String(coachSuggestion);
}

export function groupProbesByDomain(probes) {
  const groups = {};
  for (const probe of probes) {
    const domain = probe.domain || 'uncategorized';
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(probe);
  }
  const sorted = {};
  for (const key of Object.keys(groups).sort()) {
    sorted[key] = groups[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
}

export function filterProbes(probes, search, domainFilter) {
  let filtered = probes;
  if (domainFilter) {
    filtered = filtered.filter(p => (p.domain || 'uncategorized') === domainFilter);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.prompt_text || '').toLowerCase().includes(q)
    );
  }
  return filtered;
}

export function statBar(count, total, color) {
  if (!count || !total) return '';
  const pct = (count / total * 100).toFixed(1);
  return `<div style="background:${color}; flex:${count}; height:100%;"></div>`;
}

export function classificationBadge(classification, runId, field) {
  const cls = normalizeClassification(classification);
  const label = cls.toUpperCase();
  const classMap = {
    refused: 'badge-refused',
    collapsed: 'badge-collapsed',
    negotiated: 'badge-negotiated',
    complied: 'badge-complied',
  };
  const cssClass = classMap[cls] || 'badge-unknown';
  if (runId && field) {
    return `<span class="badge ${cssClass}" style="cursor:pointer; position:relative;"
      onclick="showClassificationDropdown(event, ${runId}, '${field}', '${cls}')"
      title="Click to override classification">${escHtml(label)}</span>`;
  }
  return `<span class="badge ${cssClass}">${escHtml(label)}</span>`;
}

export function showClassificationDropdown(event, runId, field, currentCls) {
  event.stopPropagation();
  const existing = document.getElementById('cls-dropdown');
  if (existing) existing.remove();

  const options = ['refused', 'collapsed', 'negotiated', 'complied'];
  const dropdown = document.createElement('div');
  dropdown.id = 'cls-dropdown';
  dropdown.style.cssText = 'position:fixed; z-index:1000; background:#1a1d2e; border:1px solid #2d3348; border-radius:6px; padding:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5);';
  dropdown.style.left = event.clientX + 'px';
  dropdown.style.top = event.clientY + 'px';

  options.forEach(opt => {
    const item = document.createElement('div');
    item.textContent = opt.toUpperCase();
    item.style.cssText = 'padding:6px 12px; cursor:pointer; font-size:12px; font-family:"JetBrains Mono",monospace; color:#e2e8f0; border-radius:4px;';
    if (opt === currentCls) item.style.fontWeight = '600';
    item.onmouseenter = () => item.style.background = '#2d3348';
    item.onmouseleave = () => item.style.background = 'none';
    item.onclick = async () => {
      dropdown.remove();
      try {
        const { loadStats } = await import('./api.js');
        const { render } = await import('./render.js');
        const run = await api(`/api/runs/${runId}/classification`, {
          method: 'PATCH',
          body: { field, value: opt },
        });
        state.currentRun = run;
        if (field === 'initial_classification' && (opt === 'refused' || opt === 'negotiated') && state.phase === 'response') {
          setPhase('pushback_decision');
        }
        if (field === 'initial_classification' && opt === 'complied' && state.phase === 'pushback_decision') {
          setPhase('response');
        }
        await loadStats();
        render();
      } catch (e) {
        showError('Failed to update classification: ' + e.message);
      }
    };
    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
  setTimeout(() => {
    document.addEventListener('click', function handler() {
      dropdown.remove();
      document.removeEventListener('click', handler);
    });
  }, 10);
}

export function formatResponseText(text) {
  if (!text) return '<p>(no response)</p>';

  // Split into lines, process blocks
  const lines = text.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip (paragraph breaks handled by block grouping)
    if (line.trim() === '') {
      i++;
      continue;
    }

    // List block: consecutive lines starting with - or *
    if (/^[\-\*]\s/.test(line)) {
      html += '<ul class="rt-list">';
      while (i < lines.length && /^[\-\*]\s/.test(lines[i])) {
        html += `<li>${escHtml(lines[i].replace(/^[\-\*]\s+/, ''))}</li>`;
        i++;
      }
      html += '</ul>';
      continue;
    }

    // Quote block: lines starting with >
    if (/^>\s?/.test(line)) {
      html += '<div class="rt-quote">';
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        html += escHtml(lines[i].replace(/^>\s?/, '')) + '\n';
        i++;
      }
      html += '</div>';
      continue;
    }

    // Paragraph: collect until blank line or list/quote
    let paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^[\-\*]\s/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      html += `<p>${escHtml(paraLines.join('\n'))}</p>`;
    }
  }

  return html || `<p>${escHtml(text)}</p>`;
}

export function showError(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 100;
    background: #450a0a; border: 1px solid #7f1d1d; color: #fca5a5;
    padding: 10px 16px; border-radius: 6px; font-size: 13px;
    font-family: 'JetBrains Mono', monospace; max-width: 360px;
    animation: slideInRight 0.3s ease-out;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── Window bindings for onclick handlers in HTML strings ─────────────────────

window.showClassificationDropdown = showClassificationDropdown;
