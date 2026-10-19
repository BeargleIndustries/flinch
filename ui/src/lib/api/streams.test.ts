// The SSE parser and openStream (brief 10.4, plan I2).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { ROUTES } from './endpoints';
import { openStream, SseParser } from './streams';

function collect(chunks: string[]): [string, string][] {
  const out: [string, string][] = [];
  const p = new SseParser((name, data) => out.push([name, data]));
  for (const c of chunks) p.push(c);
  p.end();
  return out;
}

describe('SseParser', () => {
  it('dispatches named events', () => {
    expect(collect(['event: started\ndata: {"total":2}\n\nevent: complete\ndata: {}\n\n'])).toEqual(
      [
        ['started', '{"total":2}'],
        ['complete', '{}'],
      ],
    );
  });

  it('names a block without event: "message"', () => {
    expect(collect(['data: {"a":1}\n\n'])).toEqual([['message', '{"a":1}']]);
  });

  it('does not carry an event name into the next block', () => {
    expect(collect(['event: progress\ndata: 1\n\ndata: 2\n\n'])).toEqual([
      ['progress', '1'],
      ['message', '2'],
    ]);
  });

  it('joins multi-line data with newlines', () => {
    expect(collect(['event: x\ndata: line 1\ndata: line 2\n\n'])).toEqual([
      ['x', 'line 1\nline 2'],
    ]);
  });

  it('keeps state across chunks split anywhere', () => {
    const text =
      'event: progress\ndata: {"completed":1,"total":3}\n\nevent: complete\ndata: {"ok":true}\n\n';
    const whole = collect([text]);
    for (let size = 1; size <= 7; size++) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
      expect(collect(chunks), `chunk size ${size}`).toEqual(whole);
    }
    expect(collect(['eve', 'nt: pro', 'gress\nda', 'ta: {"n"', ':1}\n', '\n'])).toEqual([
      ['progress', '{"n":1}'],
    ]);
  });

  it('accepts CRLF and CR line ends, a CRLF split across reads included', () => {
    expect(collect(['event: a\r\ndata: 1\r\n\r\n'])).toEqual([['a', '1']]);
    expect(collect(['event: a\r', '\ndata: 1\r', '\n\r', '\n'])).toEqual([['a', '1']]);
    expect(collect(['event: a\rdata: 1\r\r'])).toEqual([['a', '1']]);
  });

  it('ignores comments, id and retry, and an empty block', () => {
    expect(collect([': keep-alive\n\nid: 4\nretry: 10\nevent: x\ndata: y\n\n\n\n'])).toEqual([
      ['x', 'y'],
    ]);
  });

  it('drops a block cut off by the end of the stream', () => {
    expect(collect(['event: a\ndata: 1\n\nevent: b\ndata: {"part'])).toEqual([['a', '1']]);
  });

  it('keeps the value after the first colon, minus one leading space', () => {
    expect(collect(['data:  two spaces: kept\n\n'])).toEqual([['message', ' two spaces: kept']]);
  });
});

/**
 * A streaming Response whose body yields `chunks`, then stays open when `hang`
 * is set. Like a real fetch, aborting `signal` errors the body.
 */
function sseResponse(chunks: string[], hang = false, signal?: AbortSignal | null): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      if (!hang) controller.close();
      signal?.addEventListener('abort', () =>
        controller.error(new DOMException('The operation was aborted.', 'AbortError')),
      );
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function recorder() {
  const events: [string, unknown][] = [];
  const errors: unknown[] = [];
  const done: { aborted: boolean }[] = [];
  return {
    events,
    errors,
    done,
    handlers: {
      on: (name: string, data: unknown) => events.push([name, data]),
      error: (e: unknown) => errors.push(e),
      done: (info: { aborted: boolean }) => done.push(info),
    },
  };
}

describe('openStream', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs the JSON body to the route and parses each event', async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse(['event: started\ndata: {"batch_id":3,', '"total":1}\n\n', 'data: "hi"\n\n']),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = recorder();
    await openStream(
      ROUTES.runBatch,
      { params: { session_id: 5 }, body: { probe_ids: [1] } },
      r.handlers,
    );
    expect(r.events).toEqual([
      ['started', { batch_id: 3, total: 1 }],
      ['message', 'hi'],
    ]);
    expect(r.errors).toEqual([]);
    expect(r.done).toEqual([{ aborted: false }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/sessions/5/batch');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"probe_ids":[1]}');
  });

  it('passes an error event to on() like any other', async () => {
    vi.stubGlobal('fetch', async () => sseResponse(['event: error\ndata: {"error":"boom"}\n\n']));
    const r = recorder();
    await openStream(ROUTES.startStatRun, { params: { session_id: 1 } }, r.handlers);
    expect(r.events).toEqual([['error', { error: 'boom' }]]);
    expect(r.errors).toEqual([]);
  });

  it('reports an HTTP error as an ApiError, then done', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ detail: 'This study is already running.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const r = recorder();
    await openStream(ROUTES.startExperiment, { params: { experiment_id: 2 } }, r.handlers);
    expect(r.errors).toHaveLength(1);
    const err = r.errors[0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.detail).toBe('This study is already running.');
    expect(r.done).toEqual([{ aborted: false }]);
  });

  it('stops on abort and reports done with aborted, not an error', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) =>
      sseResponse(['event: progress\ndata: {"completed":1}\n\n'], true, init.signal),
    );
    const controller = new AbortController();
    const r = recorder();
    const p = openStream(
      ROUTES.runBatch,
      { params: { session_id: 1 } },
      {
        ...r.handlers,
        on: (name, data) => {
          r.handlers.on(name, data);
          controller.abort();
        },
      },
      controller.signal,
    );
    await p;
    expect(r.events).toEqual([['progress', { completed: 1 }]]);
    expect(r.errors).toEqual([]);
    expect(r.done).toEqual([{ aborted: true }]);
  });

  it('reports done with aborted when the signal is already aborted', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return sseResponse([]);
    });
    const controller = new AbortController();
    controller.abort();
    const r = recorder();
    await openStream(ROUTES.runBatch, { params: { session_id: 1 } }, r.handlers, controller.signal);
    expect(r.errors).toEqual([]);
    expect(r.done).toEqual([{ aborted: true }]);
  });

  it('retries once on a network TypeError, then reports status 0', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = recorder();
    await openStream(ROUTES.runBatch, { params: { session_id: 1 } }, r.handlers);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((r.errors[0] as ApiError).status).toBe(0);
    expect(r.done).toEqual([{ aborted: false }]);
  });
});
