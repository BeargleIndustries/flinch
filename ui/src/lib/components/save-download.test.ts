// saveDownload (brief 5.6, plan R10): the server's file name, cancel passes
// through untouched, and a failed write becomes the R10 sentence.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  filename: 'flinch-a-2026-10-19.json' as string | null,
  save: vi.fn(async (_blob: Blob, _name: string): Promise<string | null> => null),
}));

vi.mock('$lib/api/client', () => ({
  download: vi.fn(async () => ({ blob: new Blob(['{}']), filename: state.filename })),
}));
vi.mock('$lib/stores/status.svelte', () => ({
  status: { track: <T>(p: Promise<T>) => p },
}));
vi.mock('$lib/tauri', () => ({
  SAVE_CANCELLED: 'Save cancelled.',
  saveFile: (blob: Blob, name: string) => state.save(blob, name),
}));

import { ERROR_COPY } from '$lib/copy/errors-copy';
import { friendlyError } from '$lib/errors';
import { isSaveCancelled, saveDownload } from './save-download';

beforeEach(() => {
  state.filename = 'flinch-a-2026-10-19.json';
  state.save.mockReset();
  state.save.mockImplementation(async () => null);
});

describe('saveDownload', () => {
  it('saves under the name the server sent, else the fallback', async () => {
    await expect(saveDownload('/x', 'fallback.json')).resolves.toBeNull();
    expect(state.save.mock.calls[0][1]).toBe('flinch-a-2026-10-19.json');
    state.filename = null;
    await saveDownload('/x', 'fallback.json');
    expect(state.save.mock.calls[1][1]).toBe('fallback.json');
  });

  it('resolves to the desktop path written', async () => {
    state.save.mockImplementation(async () => 'C:\\Users\\me\\Downloads\\a.json');
    await expect(saveDownload('/x', 'f')).resolves.toBe('C:\\Users\\me\\Downloads\\a.json');
  });

  it('passes a closed save dialog through as a cancel', async () => {
    state.save.mockImplementation(async () => {
      throw new Error('Save cancelled.');
    });
    const err = await saveDownload('/x', 'f').catch((e: unknown) => e);
    expect(isSaveCancelled(err)).toBe(true);
  });

  it('reports a failed write with the R10 sentence', async () => {
    state.save.mockImplementation(async () => {
      throw new Error('forbidden path: D:\\elsewhere\\a.json');
    });
    const err = await saveDownload('/x', 'f').catch((e: unknown) => e);
    expect(isSaveCancelled(err)).toBe(false);
    expect(friendlyError(err).message).toBe(ERROR_COPY.saveOutsideScope);
  });
});
