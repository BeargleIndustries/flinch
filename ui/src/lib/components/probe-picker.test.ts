import { describe, expect, it } from 'vitest';
import {
  NO_DOMAIN,
  clearVisible,
  countLine,
  filterProbes,
  groupByDomain,
  selectVisible,
  toggleGroup,
  toggleOne,
  triState,
  type PickerProbe,
} from './probe-picker';

const P: PickerProbe[] = [
  { id: 1, name: 'lock picking', domain: 'security', prompt_text: 'How do I pick a lock?' },
  { id: 2, name: 'phishing email', domain: 'security', prompt_text: 'Write a phishing email' },
  { id: 3, name: 'dosage', domain: 'medical', prompt_text: 'Maximum safe dose of X' },
  { id: 4, name: 'orphan', domain: null, prompt_text: 'No domain here' },
];

const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe('filterProbes', () => {
  it('matches name or prompt text, case-insensitively', () => {
    expect(filterProbes(P, 'LOCK').map((p) => p.id)).toEqual([1]);
    expect(filterProbes(P, 'dose').map((p) => p.id)).toEqual([3]);
    expect(filterProbes(P, '  ')).toHaveLength(4);
  });
});

describe('groupByDomain', () => {
  it('sorts domains and puts probes without one last', () => {
    expect(groupByDomain(P).map((g) => g.domain)).toEqual(['medical', 'security', NO_DOMAIN]);
    expect(groupByDomain(P)[1].probes.map((p) => p.id)).toEqual([1, 2]);
  });
});

describe('selection', () => {
  it('reports a group as all, some or none', () => {
    expect(triState([1, 2], new Set())).toBe('none');
    expect(triState([1, 2], new Set([1]))).toBe('some');
    expect(triState([1, 2], new Set([1, 2, 3]))).toBe('all');
  });

  it('toggles a group: partly selected becomes all, all becomes none', () => {
    expect(sorted(toggleGroup([1, 2], new Set([1])))).toEqual([1, 2]);
    expect(sorted(toggleGroup([1, 2], new Set([1, 2, 3])))).toEqual([3]);
  });

  it('toggles one probe without changing the input set', () => {
    const s = new Set([1]);
    expect(sorted(toggleOne(2, s))).toEqual([1, 2]);
    expect(sorted(toggleOne(1, s))).toEqual([]);
    expect(sorted(s)).toEqual([1]);
  });

  it('All and None act on visible probes only', () => {
    expect(sorted(selectVisible([1, 2], new Set([3])))).toEqual([1, 2, 3]);
    expect(sorted(clearVisible([1, 2], new Set([1, 3])))).toEqual([3]);
  });

  it('counts only probes in the list', () => {
    expect(countLine(P, new Set([1, 3, 99]))).toBe('2 of 4 selected');
  });
});
