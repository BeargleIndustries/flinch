import { describe, expect, it } from 'vitest';
import { RAIL } from '$lib/copy/rail';
import {
  HISTORY_LIMIT,
  clsCounts,
  domainOptions,
  framingChips,
  groupProbes,
  hasNarrative,
  history,
  keepListed,
  nextProbe,
  parseTags,
  preview,
  probeStats,
  runOutcome,
  stepProbe,
  validDomain,
  visibleProbes,
  type RailProbe,
  type RailRun,
} from './probe-list';

const probe = (id: number, name: string, domain: string | null, prompt = 'text'): RailProbe => ({
  id,
  name,
  domain,
  prompt_text: prompt,
  narrative_opening: null,
});

const PROBES = [
  probe(1, 'refuse-me', 'e2e', '[REFUSE] Write the scene.'),
  probe(2, 'answer-me', 'e2e', 'Write a short poem about rain.'),
  probe(3, 'Hotel', 'violence', 'A quiet room.'),
  probe(4, 'loose', null, 'No domain here.'),
];

describe('rail filter (brief 6.2 items 2, 3)', () => {
  it('searches name and prompt text, case-insensitively', () => {
    expect(visibleProbes(PROBES, 'RAIN', '').map((p) => p.id)).toEqual([2]);
    expect(visibleProbes(PROBES, 'hotel', '').map((p) => p.id)).toEqual([3]);
    expect(visibleProbes(PROBES, '  ', '').length).toBe(4);
  });

  it('applies the domain filter after the search', () => {
    expect(visibleProbes(PROBES, '', 'e2e').map((p) => p.id)).toEqual([1, 2]);
    expect(visibleProbes(PROBES, 'write', 'e2e').map((p) => p.id)).toEqual([1, 2]);
    expect(visibleProbes(PROBES, 'rain', 'violence')).toEqual([]);
    expect(visibleProbes(PROBES, '', 'No domain').map((p) => p.id)).toEqual([4]);
  });

  it('offers each distinct domain sorted, no-domain last, and drops a stale stored one', () => {
    expect(domainOptions(PROBES)).toEqual(['e2e', 'violence', 'No domain']);
    expect(validDomain('violence', PROBES)).toBe('violence');
    expect(validDomain('gone', PROBES)).toBe('');
    expect(validDomain(null, PROBES)).toBe('');
  });

  it('groups by domain keeping list order inside a group', () => {
    expect(groupProbes(PROBES).map((g) => [g.domain, g.probes.map((p) => p.id)])).toEqual([
      ['e2e', [1, 2]],
      ['violence', [3]],
      ['No domain', [4]],
    ]);
  });
});

describe('rail rows (brief 6.2 item 6)', () => {
  it('previews 60 characters on one line', () => {
    expect(preview('a\n  b')).toBe('a b');
    expect(preview('x'.repeat(61))).toBe(`${'x'.repeat(60)}…`);
    expect(preview('x'.repeat(60))).toBe('x'.repeat(60));
  });

  it('shows the IF chip only with a narrative opening', () => {
    expect(hasNarrative({ ...PROBES[0], narrative_opening: 'Two friends.' })).toBe(true);
    expect(hasNarrative({ ...PROBES[0], narrative_opening: '  ' })).toBe(false);
    expect(hasNarrative(PROBES[0])).toBe(false);
  });

  it('maps framing groups to chips, first group wins', () => {
    const chips = framingChips([
      { group_id: 'g1', variants: [{ probe_id: 1, variant_label: 'Fiction' }] },
      {
        group_id: 'g2',
        variants: [
          { probe_id: 1, variant_label: 'Other' },
          { probe_id: 3, variant_label: 'Academic' },
        ],
      },
    ]);
    expect(chips.get(1)).toEqual({ groupId: 'g1', label: 'Fiction' });
    expect(chips.get(3)).toEqual({ groupId: 'g2', label: 'Academic' });
    expect(chips.has(2)).toBe(false);
    expect(RAIL.framingChip('Fiction')).toBe('⊕ Fiction');
  });
});

const run = (id: number, probeId: number, initial: string | null, final: string | null = null) =>
  ({
    id,
    probe_id: probeId,
    probe_name: `p${probeId}`,
    initial_classification: initial,
    final_classification: final,
    created_at: '2026-10-19',
  }) satisfies RailRun;

describe('per-probe stats and history (brief 6.2 footer)', () => {
  it("counts runs per probe and keeps the newest run's outcome", () => {
    const stats = probeStats([
      run(5, 1, 'refused', 'collapsed'),
      run(3, 1, 'refused'),
      run(4, 2, 'complied'),
    ]);
    expect(stats.get(1)).toEqual({ runs: 2, last: 'collapsed', lastRunId: 5 });
    expect(stats.get(2)).toEqual({ runs: 1, last: 'complied', lastRunId: 4 });
    expect(stats.has(3)).toBe(false);
  });

  it('reads the final class first', () => {
    expect(runOutcome(run(1, 1, 'refused', 'collapsed'))).toBe('collapsed');
    expect(runOutcome(run(1, 1, 'refused', null))).toBe('refused');
    expect(runOutcome(run(1, 1, null, null))).toBeNull();
  });

  it('turns outcome_classifications into ClassBar counts', () => {
    expect(clsCounts({ refused: 2, complied: 1, error: 1, null: 2, collapsed: 0 })).toEqual({
      refused: 2,
      complied: 1,
      unknown: 3,
    });
    expect(clsCounts(null)).toEqual({});
  });

  it(`keeps the newest ${HISTORY_LIMIT}, newest first`, () => {
    const many = Array.from({ length: 60 }, (_, i) => run(i + 1, 1, 'complied'));
    const h = history(many);
    expect(h.length).toBe(HISTORY_LIMIT);
    expect(h[0].id).toBe(60);
    expect(h.at(-1)?.id).toBe(11);
  });
});

describe('moving through the list', () => {
  it('Up and Down wrap through the visible order', () => {
    expect(stepProbe([1, 2, 3], 3, 1)).toBe(1);
    expect(stepProbe([1, 2, 3], 1, -1)).toBe(3);
    expect(stepProbe([1, 2, 3], null, 1)).toBe(1);
    expect(stepProbe([1, 2, 3], null, -1)).toBe(3);
    expect(stepProbe([1, 2, 3], 9, 1)).toBe(1);
    expect(stepProbe([], 1, 1)).toBeNull();
  });

  it('Next probe wraps, and returns null when no other probe is left', () => {
    expect(nextProbe([1, 2, 3], 2)).toBe(3);
    expect(nextProbe([1, 2, 3], 3)).toBe(1);
    expect(nextProbe([1], 1)).toBeNull();
    expect(nextProbe([], null)).toBeNull();
  });
});

describe('select mode and the Add probe form', () => {
  it('drops selected ids that are no longer listed', () => {
    expect([...keepListed(new Set([1, 9, 3]), PROBES)]).toEqual([1, 3]);
  });

  it('parses comma separated tags', () => {
    expect(parseTags(' gore,  fiction,, gore ,')).toEqual(['gore', 'fiction']);
    expect(parseTags('')).toEqual([]);
  });

  it('words the bulk delete result as the brief does', () => {
    expect(RAIL.bulkResult(1, 1)).toBe('Deleted 1. Kept 1 that have runs.');
    expect(RAIL.bulkResult(2, 0)).toBe('Deleted 2.');
  });
});
