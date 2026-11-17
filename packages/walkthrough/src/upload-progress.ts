// A walkthrough's media upload as the save card shows it (liveworkspace/docs/specs/006-media/walkthroughs.md, each
// app's 012-collaboration walkthroughs.md "Save"): how much has gone, and about how long is left at the speed so far.
// A ten-minute recording is up to 40 MB, so on a slow uplink it can take minutes; fetch reports no bytes sent, so the
// media part goes through the app's funnel with `uploadProgress` (XMLHttpRequest underneath).

export type UploadProgress = (sent: number, total: number) => void;

/** The media upload so far: bytes sent of the whole, and the time left (null until it can be worked out). */
export type WalkthroughUpload = { sent: number; total: number; leftMs: number | null };

// How long the media must have been going before the time left is guessed: the first progress events come in a
// burst as the browser fills its send buffer, which would promise a speed the connection doesn't have.
export const ESTIMATE_AFTER_MS = 1_000;
// How often, at most, the save card is drawn again while the upload goes, unless the whole percentage moved.
export const PROGRESS_EVERY_MS = 500;

/** The upload at `elapsedMs` since the media began, with the time left at the average speed since then. */
export function uploadEstimate(sent: number, total: number, elapsedMs: number): WalkthroughUpload {
  const known = elapsedMs >= ESTIMATE_AFTER_MS && sent > 0;
  return {
    sent,
    total,
    leftMs: known ? Math.max(0, ((total - sent) * elapsedMs) / sent) : null,
  };
}

/** The whole percentage sent, 0 to 100. */
export function uploadPercent({ sent, total }: Pick<WalkthroughUpload, 'sent' | 'total'>): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((sent / total) * 100));
}

/** Whether the save card should be drawn again for `next` (the percentage moved, or a while has passed). */
export function uploadMoved(
  last: { percent: number; at: number } | null,
  percent: number,
  at: number,
): boolean {
  return last === null || percent !== last.percent || at - last.at >= PROGRESS_EVERY_MS;
}

/** Megabytes as the save card says them, one decimal place. */
export function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** "About 2 minutes left", "About 40 seconds left", "Less than 5 seconds left". */
export function formatTimeLeft(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 5) return 'Less than 5 seconds left';
  const fives = Math.round(seconds / 5) * 5;
  if (fives < 60) return `About ${fives} seconds left`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'About 1 minute left' : `About ${minutes} minutes left`;
}
