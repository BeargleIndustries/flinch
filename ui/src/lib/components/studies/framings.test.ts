import { describe, expect, it } from 'vitest';
import type { VariantFile } from '$lib/api/types';
import { DEFAULT_STRATEGIES, HAND_LABELS } from '$lib/copy/studies';
import {
  buildGroups,
  canSave,
  completeRows,
  draftRows,
  duplicateLabels,
  everyProbeId,
  generateBody,
  nextLabel,
  orderResults,
  planFor,
  saveBody,
  startRows,
  validGroupId,
  verdict,
  type ConsistencyGroup,
  type ProbeGroup,
} from './framings';

const file = (over: Partial<VariantFile>): VariantFile => ({
  group_id: 'g',
  title: 'G',
  description: '',
  domain: 'd',
  variant_type: 'framings',
  variant_count: 2,
  labels: ['A', 'B'],
  probe_ids: [1, 2],
  ...over,
});

const rows: ProbeGroup[] = [
  {
    group_id: 'g',
    variants: [
      { probe_id: 1, variant_label: 'A', probe_name: 'g--a', probe_domain: 'd' },
      { probe_id: 2, variant_label: 'B', probe_name: 'g--b', probe_domain: 'd' },
    ],
  },
  {
    group_id: 'loose',
    variants: [
      { probe_id: 2, variant_label: 'Again', probe_name: 'g--b', probe_domain: null },
      { probe_id: 7, variant_label: 'Other', probe_name: 'seven', probe_domain: 'x' },
    ],
  },
];

describe('validGroupId', () => {
  it('takes lowercase slugs up to 200 characters', () => {
    expect(validGroupId('violence-framing')).toBe(true);
    expect(validGroupId('a1-b2')).toBe(true);
    expect(validGroupId('a'.repeat(200))).toBe(true);
  });
  it('refuses empty, uppercase, spaces, underscores and over-long ids', () => {
    for (const bad of ['', 'Violence', 'a b', 'a_b', '../x', 'a'.repeat(201)])
      expect(validGroupId(bad)).toBe(false);
  });
});

describe('buildGroups', () => {
  it('lists framings files and drops conditions files', () => {
    const { files } = buildGroups(
      [file({}), file({ group_id: 'c', variant_type: 'conditions', probe_ids: [] })],
      rows,
    );
    expect(files.map((g) => g.groupId)).toEqual(['g']);
    expect(files[0]).toMatchObject({ kind: 'file', title: 'G', probeIds: [1, 2] });
  });
  it('lists probe groups with no file under DB-only', () => {
    const { dbOnly } = buildGroups([file({})], rows);
    expect(dbOnly).toEqual([
      {
        kind: 'db',
        groupId: 'loose',
        title: 'loose',
        description: '',
        domain: 'x',
        labels: ['Again', 'Other'],
        probeIds: [2, 7],
      },
    ]);
  });
  it('falls back to the group id when a file has no title', () => {
    expect(buildGroups([file({ title: '' })], []).files[0].title).toBe('g');
  });
});

describe('everyProbeId and planFor', () => {
  it('deduplicates across groups in first-seen order', () => {
    const { files, dbOnly } = buildGroups([file({})], rows);
    expect(everyProbeId([...files, ...dbOnly])).toEqual([1, 2, 7]);
  });
  it('names planned rows from the probe-group rows', () => {
    expect(planFor([1, 7, 99], rows)).toEqual([
      { id: 1, name: 'g--a', domain: 'd' },
      { id: 7, name: 'seven', domain: 'x' },
      { id: 99, name: '#99', domain: null },
    ]);
  });
});

describe('rows', () => {
  it('starts with Direct request and Fiction framing', () => {
    expect(startRows('text')).toEqual([
      { label: 'Direct request', prompt_text: 'text' },
      { label: 'Fiction framing', prompt_text: '' },
    ]);
  });
  it('offers the next unused label, then numbered ones', () => {
    expect(nextLabel(startRows())).toBe('Academic framing');
    const all = HAND_LABELS.map((label) => ({ label, prompt_text: 'x' }));
    expect(nextLabel(all)).toBe(`Variant ${HAND_LABELS.length + 1}`);
  });
  it('needs a valid id and two complete rows with distinct labels', () => {
    const two = [
      { label: 'A', prompt_text: 'one' },
      { label: 'B', prompt_text: 'two' },
    ];
    expect(canSave('g', two)).toBe(true);
    expect(canSave('G', two)).toBe(false);
    expect(canSave('g', [two[0], { label: 'B', prompt_text: '  ' }])).toBe(false);
    expect(canSave('g', [two[0], { label: 'a', prompt_text: 'x' }])).toBe(false);
    expect(duplicateLabels([two[0], { label: ' a ', prompt_text: 'x' }])).toBe(true);
  });
  it('trims and drops incomplete rows', () => {
    expect(
      completeRows([
        { label: ' A ', prompt_text: ' one ' },
        { label: '', prompt_text: 'orphan' },
      ]),
    ).toEqual([{ label: 'A', prompt_text: 'one' }]);
  });
});

describe('request bodies', () => {
  it('generate sends the probe id and the checked strategies (POST /api/variants/generate)', () => {
    expect(generateBody(3, [...DEFAULT_STRATEGIES.slice(0, 2), '  ', ' Own '])).toEqual({
      probe_id: 3,
      strategies: ['Fiction Workshop', 'Academic Analysis', 'Own'],
    });
  });
  it('save sends a framings file with the group id as title (POST /api/variants/files)', () => {
    expect(
      saveBody({
        groupId: 'g',
        description: ' about ',
        baseProbe: 'refuse-me',
        domain: null,
        rows: [
          { label: 'Direct request', prompt_text: 'x' },
          { label: 'Fiction framing', prompt_text: 'y' },
          { label: 'Empty', prompt_text: '' },
        ],
      }),
    ).toEqual({
      group_id: 'g',
      title: 'g',
      description: 'about',
      base_probe: 'refuse-me',
      domain: '',
      variant_type: 'framings',
      variants: [
        { label: 'Direct request', prompt_text: 'x' },
        { label: 'Fiction framing', prompt_text: 'y' },
      ],
    });
  });
  it('drafts put the base probe first and skip malformed variants', () => {
    expect(
      draftRows('base', [
        { label: 'Satire/Parody', prompt_text: 'Satire/Parody: [REFUSE] variant' },
        { label: 3, prompt_text: 'x' },
      ]),
    ).toEqual([
      { label: 'Direct request', prompt_text: 'base' },
      { label: 'Satire/Parody', prompt_text: 'Satire/Parody: [REFUSE] variant' },
    ]);
  });
});

describe('consistency', () => {
  const g = (id: string, consistent: boolean, has_data: boolean): ConsistencyGroup => ({
    group_id: id,
    variants: [],
    consistent,
    has_data,
  });
  it('reads each group as consistent, inconsistent or not run', () => {
    expect(verdict(g('a', true, true))).toBe('consistent');
    expect(verdict(g('a', false, true))).toBe('inconsistent');
    expect(verdict(g('a', false, false))).toBe('not-run');
  });
  it('orders inconsistent, consistent, then not run, each by id', () => {
    const out = orderResults([
      g('z', false, false),
      g('b', true, true),
      g('c', false, true),
      g('a', true, true),
    ]);
    expect(out.map((x) => x.group_id)).toEqual(['c', 'a', 'b', 'z']);
  });
});
