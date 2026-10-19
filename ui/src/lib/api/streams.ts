// Server-Sent Events over fetch (brief 10.4, plan I2): the one parser for the
// sidecar's `event: {name}` + `data: {json}` blocks, and `openStream` for the
// POST routes marked `stream` in endpoints.ts. The registry that shows open
// streams in the status strip is stores/streams-registry.svelte.ts (T15).
import { ApiError, errorFrom, initFor, pathFor, sidecarFetch, type Query } from './client';
import type { StreamRoute } from './endpoints';

/**
 * Incremental SSE parser. Feed it decoded text in any chunking; it calls
 * `onEvent(name, data)` for each block ended by a blank line. A block without
 * `event:` is named `message`; several `data:` lines join with '\n'; LF, CRLF
 * and CR line ends are all accepted; `:` comment lines and `id:`/`retry:` are
 * ignored. A block cut off by the end of the stream is dropped.
 */
export class SseParser {
  #buffer = '';
  #event: string | null = null;
  #data: string[] = [];
  readonly #onEvent: (name: string, data: string) => void;

  constructor(onEvent: (name: string, data: string) => void) {
    this.#onEvent = onEvent;
  }

  push(chunk: string): void {
    const buf = this.#buffer + chunk;
    let start = 0;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c !== '\n' && c !== '\r') continue;
      // A CR at the very end may be the first half of a CRLF split across reads.
      if (c === '\r' && i + 1 === buf.length) break;
      const line = buf.slice(start, i);
      if (c === '\r' && buf[i + 1] === '\n') i++;
      start = i + 1;
      this.#line(line);
    }
    this.#buffer = buf.slice(start);
  }

  /** The stream ended: a trailing CR still ends its line; an unfinished block is dropped. */
  end(): void {
    if (this.#buffer.endsWith('\r')) this.#line(this.#buffer.slice(0, -1));
    this.#buffer = '';
    this.#event = null;
    this.#data = [];
  }

  #line(line: string): void {
    if (line === '') {
      if (this.#data.length > 0) this.#onEvent(this.#event ?? 'message', this.#data.join('\n'));
      this.#event = null;
      this.#data = [];
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.#event = value;
    else if (field === 'data') this.#data.push(value);
  }
}

export interface StreamHandlers {
  /** One event: its name and its data, parsed as JSON (the raw text when it is not JSON). */
  on(name: string, data: unknown): void;
  /** Always called last, once: the stream ended, failed or was aborted. */
  done?(info: { aborted: boolean }): void;
  /** The request failed (an `ApiError` for an HTTP status or no answer) or a handler threw. */
  error?(err: unknown): void;
}

export interface StreamOptions {
  params?: Record<string, string | number>;
  query?: Query;
  /** Sent as JSON. */
  body?: unknown;
}

function parseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function isAbort(e: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (e instanceof Error && e.name === 'AbortError');
}

/**
 * POSTs to a stream route and feeds its events to `handlers` until the stream
 * ends or `signal` aborts. Resolves after `handlers.done`; never rejects.
 * A JSON event named `error` reaches `handlers.on` like any other.
 */
export async function openStream(
  route: StreamRoute,
  opts: StreamOptions,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let aborted = false;
  try {
    const res = await sidecarFetch(pathFor(route, opts), {
      ...initFor(route, { body: opts.body ?? {}, signal }),
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    });
    if (!res.ok) throw await errorFrom(res);
    if (!res.body) throw new ApiError(res.status, 'The stream had no body.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser((name, data) => handlers.on(name, parseData(data)));
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.push(decoder.decode());
      parser.end();
    } catch (e) {
      reader.cancel().catch(() => {});
      throw e;
    }
  } catch (e) {
    if (isAbort(e, signal)) aborted = true;
    else handlers.error?.(e instanceof TypeError ? new ApiError(0, e.message) : e);
  }
  handlers.done?.({ aborted });
}
