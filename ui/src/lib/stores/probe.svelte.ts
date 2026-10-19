// The probe store (brief 6.2, 7): the current session's probes (GET
// /api/probes?session_id=), framing groups for the chips, the session's stats
// and run history, the rail's search, domain filter and select mode, and the
// Probe workspace's state machine (`$lib/probe-machine`).
//
// The rail picks probes by dispatching PICK_PROBE / PICK_CUSTOM; T17's
// workspace dispatches the events its requests produce and calls
// `refreshActivity()` after a run so the rail's stats and history follow.
// A session change (stores/session.svelte.ts `onChange`) resets the machine
// to idle and reloads everything (brief 4.4).
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type {
  BulkDeleteResult,
  CreateProbeBody,
  Probe,
  SessionDetail,
  SessionRun,
  SessionStats,
} from '$lib/api/types';
import { RAIL } from '$lib/copy/rail';
import { friendlyError } from '$lib/errors';
import { read as readPref, remove as forgetPref, write as writePref } from '$lib/prefs';
import {
  accepts,
  initialState,
  transition,
  type MachineEvent,
  type MachineState,
} from '$lib/probe-machine';
import {
  domainOptions,
  framingChips,
  groupProbes,
  history,
  keepListed,
  nextProbe,
  probeStats,
  stepProbe,
  validDomain,
  visibleProbes,
  type VariantGroup,
} from './probe-list';
import { session } from './session.svelte';
import { status } from './status.svelte';

class ProbeStore {
  /** The session whose probes are listed; null with no session. */
  sessionId = $state<number | null>(null);
  list = $state<Probe[]>([]);
  /** The list for `sessionId` has loaded at least once. */
  loaded = $state(false);
  groups = $state<VariantGroup[]>([]);
  stats = $state<SessionStats | null>(null);
  runs = $state<SessionRun[]>([]);

  // Rail controls (brief 6.2 items 1 to 3, 7)
  query = $state('');
  domainPref = $state(readPref('probe_filter_domain') ?? '');
  selecting = $state(false);
  checked = $state<Set<number>>(new Set());

  /** The Probe workspace (brief 7). */
  machine = $state<MachineState>(initialState());

  /** The stored domain filter, or "All domains" when no listed probe has it. */
  domain = $derived(validDomain(this.domainPref, this.list));
  visible = $derived(visibleProbes(this.list, this.query, this.domain));
  grouped = $derived(groupProbes(this.visible));
  domains = $derived(domainOptions(this.list));
  chips = $derived(framingChips(this.groups));
  perProbe = $derived(probeStats(this.runs));
  recent = $derived(history(this.runs));

  /** The probe the workspace is on (selected, sending, thread), or null. */
  get activeId(): number | null {
    return this.machine.phase === 'idle' || this.machine.phase === 'custom'
      ? null
      : this.machine.probeId;
  }

  get active(): Probe | null {
    const id = this.activeId;
    return id === null ? null : (this.list.find((p) => p.id === id) ?? null);
  }

  /** Bumped on every session switch so late answers for the old session are dropped. */
  #epoch = 0;

  dispatch(event: MachineEvent): void {
    this.machine = transition(this.machine, event);
  }

  can(type: MachineEvent['type']): boolean {
    return accepts(this.machine, type);
  }

  pick(probeId: number): void {
    this.dispatch({ type: 'PICK_PROBE', probeId });
  }

  pickCustom(): void {
    this.dispatch({ type: 'PICK_CUSTOM' });
  }

  /** Up/Down (brief 6.2 Keyboard): move the active probe through the visible list. */
  move(delta: 1 | -1): void {
    const id = stepProbe(
      this.visible.map((p) => p.id),
      this.activeId,
      delta,
    );
    if (id !== null) this.pick(id);
  }

  /** "Next probe" (brief 7.7): the next visible probe after the active one, or null. */
  nextId(): number | null {
    return nextProbe(
      this.visible.map((p) => p.id),
      this.machine.probeId,
    );
  }

  setDomain(domain: string): void {
    this.domainPref = domain;
    if (domain) writePref('probe_filter_domain', domain);
    else forgetPref('probe_filter_domain');
  }

  setSelecting(on: boolean): void {
    this.selecting = on;
    if (!on) this.checked = new Set();
  }

  toggleChecked(id: number): void {
    const next = new Set(this.checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.checked = next;
  }

  checkAllVisible(): void {
    this.checked = new Set([...this.checked, ...this.visible.map((p) => p.id)]);
  }

  clearChecked(): void {
    this.checked = new Set();
  }

  /** Switches the rail to another session: workspace back to idle, everything reloaded. */
  async setSession(id: number | null): Promise<void> {
    if (id === this.sessionId && this.loaded) return;
    this.#epoch++;
    this.sessionId = id;
    this.dispatch({ type: 'SESSION_CHANGED' });
    this.list = [];
    this.runs = [];
    this.stats = null;
    this.loaded = false;
    this.query = '';
    this.setSelecting(false);
    if (id === null) return;
    await Promise.all([this.reload(), this.refreshActivity()]);
  }

  /** GET /api/probes?session_id= and GET /api/probe-groups. */
  async reload(): Promise<void> {
    const id = this.sessionId;
    if (id === null) return;
    const epoch = this.#epoch;
    try {
      const [list, groups] = await status.track(
        Promise.all([
          request<Probe[]>(ROUTES.listProbes, { query: { session_id: id } }),
          request<VariantGroup[]>(ROUTES.listProbeGroups).catch(() => [] as VariantGroup[]),
        ]),
      );
      if (epoch !== this.#epoch) return;
      this.list = list;
      this.groups = groups;
      this.checked = keepListed(this.checked, list);
    } catch (e) {
      if (epoch === this.#epoch) report(e);
    } finally {
      if (epoch === this.#epoch) this.loaded = true;
    }
  }

  /** The session's stats and run history (the rail footer). */
  async refreshActivity(): Promise<void> {
    const id = this.sessionId;
    if (id === null) return;
    const epoch = this.#epoch;
    try {
      const [stats, detail] = await status.track(
        Promise.all([
          request<SessionStats>(ROUTES.getSessionStats, { params: { session_id: id } }),
          request<SessionDetail>(ROUTES.getSession, { params: { session_id: id } }),
        ]),
      );
      if (epoch !== this.#epoch) return;
      this.stats = stats;
      this.runs = detail.runs ?? [];
    } catch (e) {
      if (epoch === this.#epoch) report(e);
    }
  }

  /**
   * POST /api/probes with the current session (B18: a scoped session gains
   * it), reloads the rail and makes the new probe active. Throws for the
   * dialog to show.
   */
  async add(body: CreateProbeBody): Promise<Probe> {
    const made = await status.track(
      request<Probe>(ROUTES.createProbe, { body: { ...body, session_id: this.sessionId } }),
    );
    await this.reload();
    this.query = '';
    if (made.domain && this.domain && made.domain !== this.domain) this.setDomain('');
    this.pick(made.id);
    // The session's probe_ids changed server-side.
    void session.refresh();
    return made;
  }

  /** POST /api/probes/import-file; returns how many probes it loaded. Throws for the dialog. */
  async importFile(filename: string): Promise<number> {
    const res = await status.track(
      request<{ loaded: number }>(ROUTES.importProbeFile, { body: { filename } }),
    );
    await this.reload();
    return res.loaded;
  }

  /** "Load defaults" (brief 6.2 item 4): progress, then "Loaded {n} probes" in the strip. */
  async loadDefaults(): Promise<void> {
    const job = 'load-defaults';
    status.progress(job, {
      label: RAIL.loadingDefaults,
      completed: 0,
      total: 1,
      route: '/probe',
    });
    try {
      const res = await status.track(request<{ loaded: number }>(ROUTES.loadDefaultProbes));
      await this.reload();
      status.note(RAIL.loaded(res.loaded));
    } catch (e) {
      report(e);
    } finally {
      status.clearProgress(job);
    }
  }

  /** DELETE /api/probes/{id}; a refusal (a probe with runs) shows the server's words. */
  async remove(id: number): Promise<boolean> {
    try {
      await status.track(request(ROUTES.deleteProbe, { params: { probe_id: id } }));
    } catch (e) {
      report(e);
      return false;
    }
    if (this.machine.probeId === id) this.dispatch({ type: 'SESSION_CHANGED' });
    await this.reload();
    return true;
  }

  /** POST /api/probes/bulk-delete over the checked probes (brief 6.2 item 7). */
  async removeChecked(): Promise<BulkDeleteResult | null> {
    const ids = [...this.checked];
    if (ids.length === 0) return null;
    try {
      const res = await status.track(
        request<BulkDeleteResult>(ROUTES.bulkDeleteProbes, { body: { probe_ids: ids } }),
      );
      const kept = res.skipped?.length ?? 0;
      status.note(RAIL.bulkResult(res.deleted, kept));
      const gone = ids.filter((id) => !(res.skipped ?? []).includes(id));
      if (this.machine.probeId !== null && gone.includes(this.machine.probeId)) {
        this.dispatch({ type: 'SESSION_CHANGED' });
      }
      this.setSelecting(false);
      await this.reload();
      return res;
    } catch (e) {
      report(e);
      return null;
    }
  }

  /** DELETE /api/runs/{id} from the history, then the footer reloads. */
  async removeRun(id: number): Promise<void> {
    try {
      await status.track(request(ROUTES.deleteRun, { params: { run_id: id } }));
      status.note(RAIL.runDeleted);
    } catch (e) {
      report(e);
    }
    await this.refreshActivity();
  }
}

function report(e: unknown): void {
  const f = friendlyError(e);
  status.error(f.message, f.details);
}

export const probes = new ProbeStore();

// Follow the current session (brief 4.4): a switch resets the workspace and reloads the rail.
session.onChange((id) => void probes.setSession(id));
