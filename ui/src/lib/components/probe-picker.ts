// Probe picker logic (brief 5.6 `ProbePicker`): search, domain groups with
// tri-state checkboxes, All and None, and the count line. `PickerProbe` holds
// the fields of GET /api/probes the picker reads (tests/shapes.py `Probe`).

export interface PickerProbe {
  id: number;
  name: string;
  domain: string | null;
  prompt_text: string;
}

export interface DomainGroup<P extends PickerProbe = PickerProbe> {
  /** Domain name; probes without one sit under NO_DOMAIN. */
  domain: string;
  probes: P[];
}

export type TriState = 'all' | 'some' | 'none';

export const NO_DOMAIN = 'No domain';

/** Probes whose name or prompt text contains `query`, case-insensitively. */
export function filterProbes<P extends PickerProbe>(probes: readonly P[], query: string): P[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...probes];
  return probes.filter(
    (p) => p.name.toLowerCase().includes(q) || p.prompt_text.toLowerCase().includes(q),
  );
}

/** Probes grouped by domain, domains sorted with NO_DOMAIN last, list order kept inside a group. */
export function groupByDomain<P extends PickerProbe>(probes: readonly P[]): DomainGroup<P>[] {
  const map = new Map<string, P[]>();
  for (const p of probes) {
    const d = p.domain?.trim() || NO_DOMAIN;
    const list = map.get(d);
    if (list) list.push(p);
    else map.set(d, [p]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === NO_DOMAIN) return 1;
      if (b === NO_DOMAIN) return -1;
      return a.localeCompare(b);
    })
    .map(([domain, list]) => ({ domain, probes: list }));
}

/** How many of `ids` are in `selected`, as a checkbox state. */
export function triState(ids: readonly number[], selected: ReadonlySet<number>): TriState {
  const n = ids.filter((id) => selected.has(id)).length;
  if (n === 0) return 'none';
  return n === ids.length ? 'all' : 'some';
}

/**
 * Clicking a group's checkbox: when every probe in it is selected, deselect
 * them all; otherwise select them all. Returns a new set.
 */
export function toggleGroup(ids: readonly number[], selected: ReadonlySet<number>): Set<number> {
  const next = new Set(selected);
  if (triState(ids, selected) === 'all') for (const id of ids) next.delete(id);
  else for (const id of ids) next.add(id);
  return next;
}

/** Toggle one probe. Returns a new set. */
export function toggleOne(id: number, selected: ReadonlySet<number>): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** "All" adds every visible probe to the selection (hidden selected ones stay). */
export function selectVisible(ids: readonly number[], selected: ReadonlySet<number>): Set<number> {
  return new Set([...selected, ...ids]);
}

/** "None" removes every visible probe from the selection (hidden selected ones stay). */
export function clearVisible(ids: readonly number[], selected: ReadonlySet<number>): Set<number> {
  const drop = new Set(ids);
  return new Set([...selected].filter((id) => !drop.has(id)));
}

/** "{n} of {total} selected", counting only probes that exist in the list. */
export function countLine(probes: readonly PickerProbe[], selected: ReadonlySet<number>): string {
  const n = probes.filter((p) => selected.has(p.id)).length;
  return `${n} of ${probes.length} selected`;
}
