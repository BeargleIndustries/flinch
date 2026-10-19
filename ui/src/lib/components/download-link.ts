// DownloadLink's result line (brief 5.6): "Saved to {path}" in the desktop app,
// "Downloaded" in dev, shown for 3 s.

export const DOWNLOAD_MESSAGE_MS = 3000;

/** `savedTo` is the path the desktop app wrote, or null when the browser downloaded it. */
export function savedMessage(savedTo: string | null): string {
  return savedTo ? `Saved to ${savedTo}` : 'Downloaded';
}
