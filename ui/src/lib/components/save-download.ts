// DownloadLink's `onDownload` for sidecar file routes (brief 5.6, 10.3, 10.6):
// `download(path)` with the server's file name, then `saveFile`. In the
// browser that is a blob download resolving to null ("Downloaded"); in the
// desktop app a save dialog that opens in Downloads, resolving to the path
// written ("Saved to {path}").
//
// Closing the save dialog rejects with SAVE_CANCELLED, which DownloadLink
// treats as nothing happened. Any other failure while writing the file is a
// folder outside the app's file scope (plan R10, A7), reported with the R10
// sentence. A failed request keeps its own error (friendlyError words it).
import { download } from '$lib/api/client';
import { ERROR_COPY } from '$lib/copy/errors-copy';
import { status } from '$lib/stores/status.svelte';
import { SAVE_CANCELLED, saveFile } from '$lib/tauri';

export async function saveDownload(path: string, fallbackName: string): Promise<string | null> {
  const { blob, filename } = await status.track(download(path));
  try {
    return await saveFile(blob, filename ?? fallbackName);
  } catch (e) {
    if (isSaveCancelled(e)) throw e;
    throw new Error(ERROR_COPY.saveOutsideScope, { cause: e });
  }
}

/** The save dialog was closed without choosing a file. */
export function isSaveCancelled(e: unknown): boolean {
  return e instanceof Error && e.message === SAVE_CANCELLED;
}
