// The API client (brief 10.3, plan I15): JSON in and out, ApiError with the
// server's detail and the errors.ts sentence, one retry on a network
// TypeError only, and the desktop sidecar address re-resolved on that retry.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tauriState = vi.hoisted(() => ({ inTauri: false, urls: [] as string[] }));

vi.mock('../is-tauri', () => ({ isTauri: () => tauriState.inTauri }));
vi.mock('../tauri', () => ({
  sidecarUrl: vi.fn(async () => {
    const url = tauriState.urls.shift();
    if (!url) throw { kind: 'Sidecar', detail: 'not running' };
    return url;
  }),
  onSidecarCrashed: vi.fn(async () => () => {}),
  onSidecarRestarted: vi.fn(async () => () => {}),
  tauriError: (e: { detail?: string }) => new Error(e.detail ?? String(e)),
}));

import { ERROR_COPY } from '../copy/errors-copy';
import { sidecarUrl } from '../tauri';
import { ApiError, download, filenameFrom, pathFor, request, resetBase } from './client';
import { ROUTES } from './endpoints';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  tauriState.inTauri = false;
  tauriState.urls = [];
  resetBase();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('request', () => {
  it('GETs a same-origin path in dev and returns parsed JSON', async () => {
    fetchMock.mockResolvedValueOnce(json([{ id: 1 }]));
    expect(await request(ROUTES.listProbes, { query: { session_id: 3, q: null } })).toEqual([
      { id: 1 },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/probes?session_id=3');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('sends an object body as JSON with the route method and params', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 9 }));
    await request(ROUTES.sendPushback, { params: { run_id: 4 }, body: { text: 'Why?' } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/runs/4/pushback');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"text":"Why?"}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('returns text for a non-JSON answer and undefined for an empty one', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('body { }', { headers: { 'Content-Type': 'text/css' } }),
    );
    expect(await request(ROUTES.getThemePreviewCss, { params: { name: 'x' } })).toBe('body { }');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await request(ROUTES.deleteRun, { params: { run_id: 1 } })).toBeUndefined();
  });

  it('throws ApiError with the JSON detail and the errors.ts sentence', async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: 'This study is already running.' }, 409));
    const err = (await request(ROUTES.getExperiment, { params: { experiment_id: 1 } }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.detail).toBe('This study is already running.');
    expect(err.friendly.message).toBe(ERROR_COPY.studyRunning);
  });

  it('joins FastAPI validation messages and truncates a long text body', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ detail: [{ msg: 'field required' }, { msg: 'too long' }] }, 422),
    );
    const v = (await request(ROUTES.createSession, { body: {} }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(v.detail).toBe('field required; too long');

    fetchMock.mockResolvedValueOnce(new Response('x'.repeat(5000), { status: 500 }));
    const t = (await request(ROUTES.listSessions).catch((e: unknown) => e)) as ApiError;
    expect(t.status).toBe(500);
    expect(t.detail).toHaveLength(2000);
  });

  it('never retries an HTTP status', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Internal error' }, 500));
    await expect(request(ROUTES.listSessions)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on a network TypeError and succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(json({ status: 'ok' }));
    expect(await request(ROUTES.health)).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry with status 0 and the unreachable sentence', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = (await request(ROUTES.health).catch((e: unknown) => e)) as ApiError;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(err.status).toBe(0);
    expect(err.friendly.message).toBe(ERROR_COPY.sidecarUnreachable);
  });

  it('does not retry an abort', async () => {
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(request(ROUTES.health)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('in the desktop app, uses the shell URL and re-resolves it after a TypeError', async () => {
    tauriState.inTauri = true;
    tauriState.urls = ['http://127.0.0.1:1111/', 'http://127.0.0.1:2222'];
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await request(ROUTES.getCapabilities);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'http://127.0.0.1:1111/api/settings/capabilities',
      'http://127.0.0.1:2222/api/settings/capabilities',
    ]);
    expect(sidecarUrl).toHaveBeenCalledTimes(2);

    // The address stays cached while requests succeed.
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await request(ROUTES.getCapabilities);
    expect(sidecarUrl).toHaveBeenCalledTimes(2);
  });
});

describe('download and pathFor', () => {
  it('returns the blob and the Content-Disposition file name', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('a,b', { headers: { 'Content-Disposition': 'attachment; filename="s.csv"' } }),
    );
    const got = await download(ROUTES.exportSession, {
      params: { session_id: 2 },
      query: { format: 'csv' },
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sessions/2/export?format=csv');
    expect(got.filename).toBe('s.csv');
    expect(await got.blob.text()).toBe('a,b');
  });

  it('accepts a path string built with pathFor', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x'));
    const path = pathFor(ROUTES.exportExperiment, {
      params: { experiment_id: 7 },
      query: { format: 'jsonl' },
    });
    await download(path);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/experiments/7/export?format=jsonl');
  });

  it('reads quoted, bare and RFC 5987 file names', () => {
    expect(filenameFrom('attachment; filename="a b.md"')).toBe('a b.md');
    expect(filenameFrom('attachment; filename=report.html')).toBe('report.html');
    expect(filenameFrom("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf")).toBe('résumé.pdf');
    expect(filenameFrom(null)).toBeNull();
    expect(filenameFrom('inline')).toBeNull();
  });
});
