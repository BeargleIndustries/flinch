// Framings (brief 8.1): the pure parts of the screen. Local types for the
// routes types.ts does not cover (`/api/probe-groups` rows with probe names,
// `/api/sessions/{id}/consistency`), the group list built from files plus
// DB-only groups, the request bodies for Draft and Save, and the readings of
// a consistency result. framings.svelte.ts holds the screen's state.
import type { GenerateVariantsBody, SaveVariantFileBody, VariantFile } from '$lib/api/types';
import { HAND_LABELS } from '$lib/copy/studies';
import type { PlannedProbe } from '../probe/batch-rows';

/** One probe of a `/api/probe-groups` row (`flinch/db.py` list_variant_groups). */
export interface ProbeGroupVariant {
  probe_id: number;
  variant_label: string;
  probe_name: string;
  probe_domain: string | null;
}

/** One row of GET /api/probe-groups. */
export interface ProbeGroup {
  group_id: string;
  variants: ProbeGroupVariant[];
}

/** One framing's result in GET /api/sessions/{id}/consistency (`flinch/db.py` compute_consistency). */
export interface ConsistencyVariant {
  probe_id: number;
  probe_name: string;
  variant_label: string;
  classification: string | null;
  run_id: number | null;
}

export interface ConsistencyGroup {
  group_id: string;
  variants: ConsistencyVariant[];
  consistent: boolean;
  has_data: boolean;
}

/** GET /api/sessions/{id}/consistency */
export interface Consistency {
  groups: ConsistencyGroup[];
  /** A percentage rounded to 0.1, or null when no group has two runs in this session. */
  consistency_score: number | null;
  consistent_count: number;
  total_groups: number;
}

/** A group as the Groups tab lists it: a framings file, or probe rows with no file. */
export interface FramingGroup {
  kind: 'file' | 'db';
  groupId: string;
  title: string;
  description: string;
  domain: string;
  labels: string[];
  probeIds: number[];
}

/** One editable framing row. */
export interface VariantRow {
  label: string;
  prompt_text: string;
}

export const GROUP_ID_RE = /^[a-z0-9-]+$/;
export const GROUP_ID_MAX = 200;

/** Whether a group id names a file the server accepts (brief 8.1). */
export function validGroupId(id: string): boolean {
  return id.length > 0 && id.length <= GROUP_ID_MAX && GROUP_ID_RE.test(id);
}

/**
 * The Groups tab's two lists: framings files (conditions files are an import
 * source for Conditions, D28), then `/api/probe-groups` rows whose group id
 * matches no file.
 */
export function buildGroups(
  files: readonly VariantFile[],
  groups: readonly ProbeGroup[],
): { files: FramingGroup[]; dbOnly: FramingGroup[] } {
  const fileIds = new Set(files.map((f) => f.group_id));
  const framingFiles = files
    .filter((f) => (f.variant_type || 'framings') === 'framings')
    .map<FramingGroup>((f) => ({
      kind: 'file',
      groupId: f.group_id,
      title: f.title || f.group_id,
      description: f.description ?? '',
      domain: f.domain ?? '',
      labels: [...(f.labels ?? [])],
      probeIds: [...(f.probe_ids ?? [])],
    }));
  const dbOnly = groups
    .filter((g) => !fileIds.has(g.group_id))
    .map<FramingGroup>((g) => ({
      kind: 'db',
      groupId: g.group_id,
      title: g.group_id,
      description: '',
      domain: g.variants.find((v) => v.probe_domain)?.probe_domain ?? '',
      labels: g.variants.map((v) => v.variant_label),
      probeIds: g.variants.map((v) => v.probe_id),
    }));
  return { files: framingFiles, dbOnly };
}

/** Every probe id across the groups, first occurrence kept ("Run every group"). */
export function everyProbeId(groups: readonly FramingGroup[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const g of groups)
    for (const id of g.probeIds)
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
  return out;
}

/** The batch panel's rows for these probe ids, named from the probe-group rows. */
export function planFor(
  probeIds: readonly number[],
  groups: readonly ProbeGroup[],
): PlannedProbe[] {
  const byId = new Map<number, ProbeGroupVariant>();
  for (const g of groups)
    for (const v of g.variants) if (!byId.has(v.probe_id)) byId.set(v.probe_id, v);
  return probeIds.map((id) => {
    const v = byId.get(id);
    return { id, name: v?.probe_name ?? `#${id}`, domain: v?.probe_domain ?? null };
  });
}

/** The next label "Add a variant" offers: the first of HAND_LABELS not used, else "Variant n". */
export function nextLabel(rows: readonly VariantRow[]): string {
  const used = new Set(rows.map((r) => r.label.trim().toLowerCase()));
  const free = HAND_LABELS.find((l) => !used.has(l.toLowerCase()));
  if (free) return free;
  let n = rows.length + 1;
  while (used.has(`variant ${n}`)) n += 1;
  return `Variant ${n}`;
}

/** The two rows "Write by hand" starts with. */
export function startRows(directText = ''): VariantRow[] {
  return [
    { label: HAND_LABELS[0], prompt_text: directText },
    { label: HAND_LABELS[1], prompt_text: '' },
  ];
}

/** Rows with both a label and prompt text, trimmed. */
export function completeRows(rows: readonly VariantRow[]): VariantRow[] {
  return rows
    .map((r) => ({ label: r.label.trim(), prompt_text: r.prompt_text.trim() }))
    .filter((r) => r.label && r.prompt_text);
}

/** Whether two complete rows share a label (the file keys framings by label). */
export function duplicateLabels(rows: readonly VariantRow[]): boolean {
  const labels = completeRows(rows).map((r) => r.label.toLowerCase());
  return new Set(labels).size !== labels.length;
}

/** Save needs a valid id and at least two complete rows with distinct labels (brief 8.1). */
export function canSave(groupId: string, rows: readonly VariantRow[]): boolean {
  return validGroupId(groupId) && completeRows(rows).length >= 2 && !duplicateLabels(rows);
}

/** POST /api/variants/generate body. */
export function generateBody(probeId: number, strategies: readonly string[]): GenerateVariantsBody {
  return { probe_id: probeId, strategies: strategies.map((s) => s.trim()).filter(Boolean) };
}

/** POST /api/variants/files body (brief 8.1: the title is the group id). */
export function saveBody(input: {
  groupId: string;
  description?: string;
  baseProbe?: string | null;
  domain?: string | null;
  rows: readonly VariantRow[];
}): SaveVariantFileBody {
  return {
    group_id: input.groupId,
    title: input.groupId,
    description: (input.description ?? '').trim(),
    base_probe: input.baseProbe ?? '',
    domain: (input.domain ?? '').trim(),
    variant_type: 'framings',
    variants: completeRows(input.rows),
  };
}

/** The draft grid: the base probe as written first, then the coach's variants. */
export function draftRows(
  baseText: string,
  variants: readonly { label?: unknown; prompt_text?: unknown }[],
  directLabel: string = HAND_LABELS[0],
): VariantRow[] {
  const drafted = variants
    .filter((v) => typeof v.label === 'string' && typeof v.prompt_text === 'string')
    .map((v) => ({ label: String(v.label), prompt_text: String(v.prompt_text) }));
  return [{ label: directLabel, prompt_text: baseText }, ...drafted];
}

export type Verdict = 'consistent' | 'inconsistent' | 'not-run';

/** The verdict a group shows on Results (brief 8.1). */
export function verdict(g: Pick<ConsistencyGroup, 'consistent' | 'has_data'>): Verdict {
  if (g.consistent) return 'consistent';
  if (g.has_data) return 'inconsistent';
  return 'not-run';
}

/** Groups that ran first (inconsistent before consistent), then the rest, by id. */
export function orderResults(groups: readonly ConsistencyGroup[]): ConsistencyGroup[] {
  const rank: Record<Verdict, number> = { inconsistent: 0, consistent: 1, 'not-run': 2 };
  return [...groups].sort(
    (a, b) => rank[verdict(a)] - rank[verdict(b)] || a.group_id.localeCompare(b.group_id),
  );
}
