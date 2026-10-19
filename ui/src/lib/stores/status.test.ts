import { beforeEach, describe, expect, it, vi } from 'vitest';
import { status } from './status.svelte';

beforeEach(() => {
  for (const id of Object.keys(status.jobs)) status.clearProgress(id);
  for (const e of [...status.errors]) status.dismissError(e.id);
});

describe('status store', () => {
  it('shows the newest job and keeps a job in place across updates', () => {
    status.progress('batch:1', {
      label: 'Running probes',
      completed: 0,
      total: 10,
      route: '/probe',
    });
    status.progress('statrun:1', {
      label: 'Repeat runs',
      completed: 0,
      total: 5,
      route: '/studies/repeat',
    });
    expect(status.current?.id).toBe('statrun:1');
    status.progress('batch:1', {
      label: 'Running probes',
      completed: 4,
      total: 10,
      failed: 1,
      route: '/probe',
    });
    expect(status.current?.id).toBe('statrun:1');
    status.clearProgress('statrun:1');
    expect(status.current).toMatchObject({ id: 'batch:1', completed: 4, failed: 1 });
    status.clearProgress('batch:1');
    expect(status.current).toBeNull();
  });

  it('keeps the cancel hook', async () => {
    const cancel = vi.fn();
    status.progress('batch:2', { label: 'x', completed: 0, total: 1, route: '/probe', cancel });
    await status.current?.cancel?.();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('posts and dismisses errors, newest last', () => {
    const first = status.error('First');
    status.error('Second', 'raw text');
    expect(status.lastError).toMatchObject({ message: 'Second', details: 'raw text' });
    status.dismissError(status.lastError!.id);
    expect(status.lastError).toMatchObject({ id: first, message: 'First', details: null });
  });

  it('keeps only the newest five errors', () => {
    for (let i = 0; i < 8; i++) status.error(`e${i}`);
    expect(status.errors.map((e) => e.message)).toEqual(['e3', 'e4', 'e5', 'e6', 'e7']);
  });

  it('keeps one notice; a newer notice survives clearing an older id', () => {
    const first = status.note('Loaded 3 probes');
    expect(status.notice).toMatchObject({ id: first, message: 'Loaded 3 probes' });
    const second = status.note('Deleted 1.');
    status.clearNotice(first);
    expect(status.notice).toMatchObject({ id: second, message: 'Deleted 1.' });
    status.clearNotice(second);
    expect(status.notice).toBeNull();
  });
});

describe('status busy', () => {
  it('is busy while a tracked request is pending', async () => {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const a = status.track(new Promise<void>((r) => (resolve = r)));
    const b = status.track(new Promise<void>((_, r) => (reject = r)));
    expect(status.busy).toBe(true);
    resolve();
    await a;
    expect(status.busy).toBe(true);
    reject(new Error('x'));
    await expect(b).rejects.toThrow('x');
    await Promise.resolve();
    expect(status.busy).toBe(false);
    expect(status.pending).toBe(0);
  });
});
