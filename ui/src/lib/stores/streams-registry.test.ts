import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '$lib/api/endpoints';
import type { StreamHandlers } from '$lib/api/streams';
import { status } from './status.svelte';
import { StreamsRegistry, type StreamOpener } from './streams-registry.svelte';

/** A fake `openStream` that ends when the test says so, or when aborted. */
function fakeOpener() {
  const calls: { handlers: StreamHandlers; signal: AbortSignal; end: () => void }[] = [];
  const opener: StreamOpener = (_route, _opts, handlers, signal) =>
    new Promise<void>((resolve) => {
      let ended = false;
      const end = (aborted = false) => {
        if (ended) return;
        ended = true;
        handlers.done?.({ aborted });
        resolve();
      };
      signal?.addEventListener('abort', () => end(true));
      calls.push({ handlers, signal: signal!, end: () => end(false) });
    });
  return { opener, calls };
}

const ROUTE = ROUTES.rateExperiment;
const meta = (id: string, extra: object = {}) => ({
  id,
  route: '/probe',
  label: 'Running',
  ...extra,
});

beforeEach(() => {
  for (const id of Object.keys(status.jobs)) status.clearProgress(id);
});

describe('streams registry', () => {
  it('registers a stream, feeds the status strip and drops it on done', async () => {
    const { opener, calls } = fakeOpener();
    const reg = new StreamsRegistry(opener);
    const done = vi.fn();
    const p = reg.open(meta('batch:1', { total: 3 }), ROUTE, {}, { on: () => {}, done });
    expect(reg.isOpen('batch:1')).toBe(true);
    expect(status.current).toMatchObject({
      id: 'batch:1',
      total: 3,
      completed: 0,
      route: '/probe',
    });

    reg.report('batch:1', { completed: 2, failed: 1 });
    expect(status.current).toMatchObject({ completed: 2, failed: 1, total: 3 });

    calls[0].end();
    await p;
    expect(done).toHaveBeenCalledWith({ aborted: false });
    expect(reg.isOpen('batch:1')).toBe(false);
    expect(reg.entries['batch:1']).toBeUndefined();
    expect(status.current).toBeNull();
  });

  it('keeps one stream per id: reopening aborts the old one and keeps the new entry', async () => {
    const { opener, calls } = fakeOpener();
    const reg = new StreamsRegistry(opener);
    const firstDone = vi.fn();
    const first = reg.open(meta('batch:2'), ROUTE, {}, { on: () => {}, done: firstDone });
    const second = reg.open(meta('batch:2', { label: 'Again' }), ROUTE, {}, { on: () => {} });
    await first;
    expect(calls[0].signal.aborted).toBe(true);
    expect(firstDone).toHaveBeenCalledWith({ aborted: true });
    expect(reg.isOpen('batch:2')).toBe(true);
    expect(status.current).toMatchObject({ id: 'batch:2', label: 'Again' });
    calls[1].end();
    await second;
    expect(reg.isOpen('batch:2')).toBe(false);
  });

  it("cancel runs the route's cancel, then aborts", async () => {
    const { opener, calls } = fakeOpener();
    const reg = new StreamsRegistry(opener);
    const order: string[] = [];
    const cancel = vi.fn(async () => {
      order.push(calls[0].signal.aborted ? 'after-abort' : 'before-abort');
    });
    const p = reg.open(meta('batch:3', { cancel }), ROUTE, {}, { on: () => {} });
    await status.current?.cancel?.();
    await p;
    expect(cancel).toHaveBeenCalledOnce();
    expect(order).toEqual(['before-abort']);
    expect(calls[0].signal.aborted).toBe(true);
    expect(status.current).toBeNull();
  });

  it('aborts even when the route cancel fails', async () => {
    const { opener, calls } = fakeOpener();
    const reg = new StreamsRegistry(opener);
    const p = reg.open(
      meta('batch:4', {
        cancel: () => Promise.reject(new Error('nope')),
      }),
      ROUTE,
      {},
      { on: () => {} },
    );
    await expect(reg.cancel('batch:4')).rejects.toThrow('nope');
    await p;
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('passes events through and shows the newest stream', async () => {
    const { opener, calls } = fakeOpener();
    const reg = new StreamsRegistry(opener);
    const on = vi.fn();
    const a = reg.open(meta('a'), ROUTE, {}, { on });
    const b = reg.open(meta('b'), ROUTE, {}, { on: () => {} });
    calls[0].handlers.on('progress', { completed: 1 });
    expect(on).toHaveBeenCalledWith('progress', { completed: 1 });
    expect(reg.newest?.id).toBe('b');
    expect(status.current?.id).toBe('b');
    calls[1].end();
    await b;
    expect(status.current?.id).toBe('a');
    calls[0].end();
    await a;
  });
});
