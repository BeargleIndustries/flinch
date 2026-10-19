// The probe rail's list rules (brief 6.2), pure so probe-list.test.ts covers
// them: search and domain filter, domain options, grouping, the framing and
// IF chips, per-probe stats from the session's runs, the run history slice,
// Up/Down and "Next probe" order, and the bulk delete result line.
// stores/probe.svelte.ts holds the state; components/rail/* render it.
import { toCls } from '$lib/cls';
import type { ClsCounts } from '$lib/components/class-bar';
import {
  filterProbes,
  groupByDomain,
  NO_DOMAIN,
  type DomainGroup,
} from '$lib/components/probe-picker';

/** The fields of GET /api/probes the rail reads (api/types.ts `Probe`). */
export interface RailProbe {
  id: number;
  name: string;
  domain: string | null;
  prompt_text: string;
  narrative_opening: string | null;
  narrative_target?: string | null;
}

/** One group of GET /api/probe-groups (flinch/db.py list_variant_groups). */
export interface VariantGroup {
  group_id: string;
  variants: { probe_id: number; variant_label: string }[];
}

/** The fields of a session run (api/types.ts `SessionRun`) the rail reads. */
export interface RailRun {
  id: number;
  probe_id: number;
  probe_name: string;
  initial_classification: string | null;
  final_classification: string | null;
  created_at: string;
}

/** How many runs the history shows (brief 6.2 footer). */
export const HISTORY_LIMIT = 50;
/** Characters of `prompt_text` under a row's name (brief 6.2 item 6). */
export const PREVIEW_CHARS = 60;

/** The domain key a probe sorts under (the picker's NO_DOMAIN for none). */
export function domainOf(p: { domain: string | null }): string {
  return p.domain?.trim() || NO_DOMAIN;
}

/** Search (name and prompt, case-insensitive) then the domain filter ('' is "All domains"). */
export function visibleProbes<P extends RailProbe>(
  probes: readonly P[],
  query: string,
  domain: string,
): P[] {
  const found = filterProbes(probes, query);
  return domain ? found.filter((p) => domainOf(p) === domain) : found;
}

/** Distinct domains of the listed probes, sorted, the no-domain bucket last. */
export function domainOptions(probes: readonly RailProbe[]): string[] {
  return groupByDomain(probes).map((g) => g.domain);
}

/** A stored domain filter that no listed probe has falls back to "All domains". */
export function validDomain(domain: string | null, probes: readonly RailProbe[]): string {
  if (!domain) return '';
  return probes.some((p) => domainOf(p) === domain) ? domain : '';
}

export function groupProbes<P extends RailProbe>(probes: readonly P[]): DomainGroup<P>[] {
  return groupByDomain(probes);
}

/** The first characters of a prompt, on one line. */
export function preview(text: string, max = PREVIEW_CHARS): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max)}…`;
}

/** The IF chip: the probe has a narrative opening (brief 6.2 item 6). */
export function hasNarrative(p: RailProbe): boolean {
  return typeof p.narrative_opening === 'string' && p.narrative_opening.trim() !== '';
}

export interface FramingChip {
  groupId: string;
  label: string;
}

/** Probe id to its framing chip, from GET /api/probe-groups (first group wins). */
export function framingChips(groups: readonly VariantGroup[]): Map<number, FramingChip> {
  const map = new Map<number, FramingChip>();
  for (const g of groups) {
    for (const v of g.variants ?? []) {
      if (!map.has(v.probe_id))
        map.set(v.probe_id, { groupId: g.group_id, label: v.variant_label });
    }
  }
  return map;
}

/** The class a run ended on: the final one when there is one, else the first. */
export function runOutcome(r: Pick<RailRun, 'initial_classification' | 'final_classification'>) {
  return r.final_classification || r.initial_classification || null;
}

export interface ProbeStat {
  runs: number;
  /** The newest run's outcome. */
  last: string | null;
  lastRunId: number;
}

/** Per-probe run count and newest outcome in this session. */
export function probeStats(runs: readonly RailRun[]): Map<number, ProbeStat> {
  const map = new Map<number, ProbeStat>();
  for (const r of runs) {
    const cur = map.get(r.probe_id);
    if (!cur) {
      map.set(r.probe_id, { runs: 1, last: runOutcome(r), lastRunId: r.id });
      continue;
    }
    cur.runs += 1;
    if (r.id > cur.lastRunId) {
      cur.last = runOutcome(r);
      cur.lastRunId = r.id;
    }
  }
  return map;
}

/** The newest `limit` runs, newest first. */
export function history<R extends RailRun>(runs: readonly R[], limit = HISTORY_LIMIT): R[] {
  return [...runs].sort((a, b) => b.id - a.id).slice(0, limit);
}

/** Up/Down (brief 6.2): the next or previous probe in visible order, wrapping; null when none. */
export function stepProbe(
  visibleIds: readonly number[],
  currentId: number | null,
  delta: 1 | -1,
): number | null {
  if (visibleIds.length === 0) return null;
  const i = currentId === null ? -1 : visibleIds.indexOf(currentId);
  if (i === -1) return delta === 1 ? visibleIds[0] : visibleIds[visibleIds.length - 1];
  const n = visibleIds.length;
  return visibleIds[(i + delta + n) % n];
}

/** "Next probe" (brief 7.7): the next visible probe after the current one, wrapping; null when no other is left. */
export function nextProbe(visibleIds: readonly number[], currentId: number | null): number | null {
  const others = visibleIds.filter((id) => id !== currentId);
  if (others.length === 0) return null;
  return stepProbe(visibleIds, currentId, 1);
}

/** Probe ids that exist in the list, dropping stale ones from a selection. */
export function keepListed(
  selected: ReadonlySet<number>,
  probes: readonly RailProbe[],
): Set<number> {
  const ids = new Set(probes.map((p) => p.id));
  return new Set([...selected].filter((id) => ids.has(id)));
}

/** Tags typed as "a, b,, c" as a clean list. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const t of text.split(',')) {
    const tag = t.trim();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/** A stats record (`outcome_classifications`) as ClassBar counts; odd keys count as unknown. */
export function clsCounts(record: Record<string, number> | null | undefined): ClsCounts {
  const out: ClsCounts = {};
  for (const [key, n] of Object.entries(record ?? {})) {
    if (!Number.isFinite(n) || n <= 0) continue;
    const cls = toCls(key);
    out[cls] = (out[cls] ?? 0) + n;
  }
  return out;
}
