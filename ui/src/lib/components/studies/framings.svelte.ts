// Framings screen state (brief 8.1). Loads the framings files and the
// probe-group rows, saves and deletes groups, drafts variants with the coach,
// and runs a group in the current session through the shared batch run
// (components/probe/batch.svelte.ts, stream id `batch:{sessionId}`), so the
// status strip shows it and the rail's stats follow when it ends.
//
// Every request goes through status.track; screens call `load()` from an
// $effect inside `untrack`.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { SettingsKey, VariantFile, VariantFileDetail } from '$lib/api/types';
import { FRAMINGS } from '$lib/copy/studies';
import { friendlyError } from '$lib/errors';
import { probes } from '$lib/stores/probe.svelte';
import { status } from '$lib/stores/status.svelte';
import { batch } from '../probe/batch.svelte';
import {
  buildGroups,
  draftRows,
  everyProbeId,
  generateBody,
  planFor,
  saveBody,
  type FramingGroup,
  type ProbeGroup,
  type VariantRow,
} from './framings';

/** The pause between framings in a group run (brief 8.1: `delay_ms: 2000`). */
export const GROUP_DELAY_MS = 2000;

/** The screen's route; the strip's "Show" link returns here. */
export const FRAMINGS_ROUTE = '/studies/framings';

const ANTHROPIC = 'ANTHROPIC_API_KEY';

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

class FramingsStore {
  files = $state<VariantFile[]>([]);
  groupRows = $state<ProbeGroup[]>([]);
  loaded = $state(false);
  /** Null until the keys answer; the Draft button waits on it. */
  anthropicKey = $state<boolean | null>(null);
  /** Group id of a running delete, so its card dims. */
  deleting = $state<string | null>(null);

  lists = $derived(buildGroups(this.files, this.groupRows));
  all = $derived<FramingGroup[]>([...this.lists.files, ...this.lists.dbOnly]);
  everyId = $derived(everyProbeId(this.all));

  /** The cached `/api/variants/files/{id}` answers, for "View". */
  #details = new Map<string, VariantFileDetail>();

  /** GET /api/variants/files, GET /api/probe-groups and the Anthropic key's status. */
  async load(): Promise<void> {
    try {
      const [files, groups, keys] = await status.track(
        Promise.all([
          request<VariantFile[]>(ROUTES.listVariantFiles),
          request<ProbeGroup[]>(ROUTES.listProbeGroups),
          request<SettingsKey[]>(ROUTES.listKeys).catch(() => null),
        ]),
      );
      this.files = files;
      this.groupRows = groups;
      this.#details.clear();
      if (keys) this.anthropicKey = keys.some((k) => k.env_var === ANTHROPIC && k.is_set);
    } catch (e) {
      report(e);
    } finally {
      this.loaded = true;
    }
  }

  /** Whether a group id already names a group (Save replaces a file group). */
  exists(groupId: string): boolean {
    return this.all.some((g) => g.groupId === groupId);
  }

  /** GET /api/variants/files/{group_id}, cached until the next load. */
  async detail(groupId: string): Promise<VariantFileDetail> {
    const hit = this.#details.get(groupId);
    if (hit) return hit;
    const d = await status.track(
      request<VariantFileDetail>(ROUTES.getVariantFile, { params: { group_id: groupId } }),
    );
    this.#details.set(groupId, d);
    return d;
  }

  /** The probe-group row behind a group (names for "View" on a DB-only group). */
  rowsOf(groupId: string): ProbeGroup | null {
    return this.groupRows.find((g) => g.group_id === groupId) ?? null;
  }

  /**
   * POST /api/variants/generate. Resolves to the draft grid (the base probe's
   * text first); throws a friendly message for the editor to show.
   */
  async draft(
    probeId: number,
    baseText: string,
    strategies: readonly string[],
  ): Promise<VariantRow[]> {
    try {
      const res = await status.track(
        request<{ variants?: { label?: unknown; prompt_text?: unknown }[] }>(
          ROUTES.generateVariants,
          { body: generateBody(probeId, strategies) },
        ),
      );
      return draftRows(baseText, Array.isArray(res?.variants) ? res.variants : []);
    } catch (e) {
      throw new Error(report(e));
    }
  }

  /**
   * POST /api/variants/files, then reloads both lists and the rail (brief
   * 8.1). Throws a friendly message for the editor to show.
   */
  async save(input: Parameters<typeof saveBody>[0]): Promise<void> {
    const body = saveBody(input);
    try {
      await status.track(request(ROUTES.saveVariantFile, { body }));
    } catch (e) {
      throw new Error(report(e));
    }
    status.note(FRAMINGS.savedNotice(body.group_id, body.variants.length));
    await Promise.all([this.load(), probes.reload()]);
  }

  /** Deletes a file group (its file and probes) or a DB-only group (its rows). */
  async remove(group: FramingGroup): Promise<void> {
    this.deleting = group.groupId;
    try {
      const route = group.kind === 'file' ? ROUTES.deleteVariantFile : ROUTES.deleteProbeGroup;
      await status.track(request(route, { params: { group_id: group.groupId } }));
      status.note(FRAMINGS.deletedNotice(group.groupId));
      await Promise.all([this.load(), probes.reload()]);
    } catch (e) {
      report(e);
    } finally {
      this.deleting = null;
    }
  }

  /**
   * Runs probe ids in the session through the shared batch (POST
   * /api/sessions/{id}/batch {probe_ids, delay_ms: 2000}). Resolves when the
   * stream has ended; the batch store refreshes the rail's activity then.
   */
  async run(sessionId: number, probeIds: readonly number[], label: string): Promise<void> {
    if (probeIds.length === 0) return;
    if (batch.live && batch.sessionId === sessionId) {
      status.note(FRAMINGS.batchBusy);
      return;
    }
    await batch.start(sessionId, GROUP_DELAY_MS, planFor(probeIds, this.groupRows), {
      probeIds: [...probeIds],
      route: FRAMINGS_ROUTE,
      label,
    });
  }
}

export const framings = new FramingsStore();
