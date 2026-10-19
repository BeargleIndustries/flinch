// Publish state (brief 9.3, 9.9). Every request goes through status.track;
// the screen calls these from an $effect inside `untrack`.
//
// Sources: GET /api/sessions (models), GET /api/probes (domains), GET
// /api/themes. Make the document: POST /api/publication/export. Past
// documents: GET /api/publication/exports; Preview reopens one with GET
// /api/publication/exports/{id}. The theme line and its preview read GET
// /api/themes/{name} and GET /api/themes/{name}/preview-css, once per theme.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { SessionListItem } from '$lib/api/types';
import { PUBLISH } from '$lib/copy/data';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import type { ThemeOption } from '../dialogs/export-paths';
import { distinctModels } from './scorecard';
import {
  distinctDomains,
  docFromExport,
  docFromRow,
  toDocList,
  type OpenDoc,
  type PublishBody,
  type PublishedDoc,
} from './publish';

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

/** A read that may fail on its own without blanking the form. */
async function soft<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (e) {
    report(e);
    return fallback;
  }
}

/** GET /api/themes/{name} with its preview-css, as far as they loaded. */
export interface ThemeLook {
  detail: Record<string, unknown> | null;
  css: string | null;
}

class PublishStore {
  // ── Sources ──
  models = $state<string[]>([]);
  domains = $state<string[]>([]);
  themes = $state<ThemeOption[]>([]);
  sourcesLoaded = $state(false);

  // ── Past documents ──
  docs = $state<PublishedDoc[]>([]);
  docsLoaded = $state(false);
  docsError = $state<string | null>(null);

  // ── The document on screen ──
  doc = $state<OpenDoc | null>(null);
  making = $state(false);
  /** Saved document id being reopened. */
  opening = $state<number | null>(null);

  // ── Theme looks, by name ──
  looks = $state<Record<string, ThemeLook>>({});

  #sourcesToken = 0;
  #docsToken = 0;
  #docToken = 0;
  #lookLoading = new Set<string>();

  async loadSources(): Promise<void> {
    const token = ++this.#sourcesToken;
    const [sessions, probes, themes] = await status.track(
      Promise.all([
        soft(request<SessionListItem[]>(ROUTES.listSessions), []),
        soft(request<{ domain?: string | null }[]>(ROUTES.listProbes), []),
        soft(request<ThemeOption[]>(ROUTES.listThemes), []),
      ]),
    );
    if (token !== this.#sourcesToken) return;
    this.models = distinctModels(Array.isArray(sessions) ? sessions : []);
    this.domains = distinctDomains(Array.isArray(probes) ? probes : []);
    this.themes = Array.isArray(themes) ? themes : [];
    this.sourcesLoaded = true;
  }

  async loadDocs(): Promise<void> {
    const token = ++this.#docsToken;
    try {
      const rows = await status.track(request<unknown>(ROUTES.listPublicationExports));
      if (token !== this.#docsToken) return;
      this.docs = toDocList(rows);
      this.docsError = null;
    } catch (e) {
      if (token === this.#docsToken) this.docsError = report(e);
    } finally {
      if (token === this.#docsToken) this.docsLoaded = true;
    }
  }

  /** Makes and saves a document, then shows it. Returns whether it worked. */
  async make(body: PublishBody): Promise<boolean> {
    if (this.making) return false;
    this.making = true;
    const token = ++this.#docToken;
    try {
      const reply = await status.track(request<unknown>(ROUTES.createPublicationExport, { body }));
      const doc = docFromExport(reply, body);
      if (token === this.#docToken && doc) this.doc = doc;
      status.note(PUBLISH.made);
      void this.loadDocs();
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      this.making = false;
    }
  }

  /** Reopens a saved document into the preview. */
  async open(id: number): Promise<void> {
    if (this.opening !== null) return;
    this.opening = id;
    const token = ++this.#docToken;
    try {
      const row = await status.track(
        request<unknown>(ROUTES.getPublicationExport, { params: { export_id: id } }),
      );
      const doc = docFromRow(row);
      if (token === this.#docToken && doc) this.doc = doc;
    } catch (e) {
      report(e);
    } finally {
      this.opening = null;
    }
  }

  /** Reads a theme's details and preview CSS once; a failed read is tried again next time. */
  async loadLook(name: string): Promise<void> {
    if (!name || this.looks[name] || this.#lookLoading.has(name)) return;
    this.#lookLoading.add(name);
    try {
      const [detail, css] = await status.track(
        Promise.all([
          request<Record<string, unknown>>(ROUTES.getTheme, { params: { name } }).catch(() => null),
          request<string>(ROUTES.getThemePreviewCss, { params: { name } }).catch(() => null),
        ]),
      );
      if (detail || css) {
        this.looks = {
          ...this.looks,
          [name]: { detail, css: typeof css === 'string' ? css : null },
        };
      }
    } finally {
      this.#lookLoading.delete(name);
    }
  }
}

export const publish = new PublishStore();
