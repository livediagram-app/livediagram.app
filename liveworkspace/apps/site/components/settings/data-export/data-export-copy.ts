// Settings › Your Data's words (liveworkspace/docs/specs/010-site/site.md "Settings", Your Data): what a row says for
// each state of an export, its size and dates, and why an emailed link was refused. Pure, so each reads the same in the
// panel and its tests.
import type { ExportLinkRefusal, ExportView } from '@liveworkspace/data-export';
import { formatDate } from '@/lib/account-api';

/** The state a row draws: an export's own, with a lapsed ready one read as expired. */
export type RowState = 'none' | 'running' | 'ready' | 'failed' | 'expired';

export function rowStateOf(view: ExportView | null, now: number): RowState {
  if (!view) return 'none';
  if (view.status === 'ready' && (!view.downloadUrl || (view.expiresAt ?? 0) <= now))
    return 'expired';
  return view.status;
}

/** A size as people read it: `840 KB`, `12.4 MB`, `1.2 GB`. */
export function readableSize(bytes: number): string {
  if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  if (bytes < 1000 * 1000 * 1000) return `${(bytes / 1000 / 1000).toFixed(1)} MB`;
  return `${(bytes / 1000 / 1000 / 1000).toFixed(1)} GB`;
}

/** What a running export is doing now. */
export function phaseLine(view: ExportView): string {
  switch (view.phase) {
    case 'items':
      return `Adding items: ${view.itemsDone} of ${view.itemsTotal}`;
    case 'images':
      return `Adding images: ${view.imagesDone} of ${view.imagesTotal}`;
    case 'finishing':
      return 'Finishing';
    default:
      return 'Finding everything to add';
  }
}

/** A ready export's facts: its size, when it was made and when its link lapses. */
export function readyLine(view: ExportView): string {
  const parts = [readableSize(view.bytes)];
  if (view.finishedAt) parts.push(`made ${formatDate(view.finishedAt)}`);
  if (view.expiresAt) parts.push(`the link works until ${formatDate(view.expiresAt)}`);
  return parts.join(' · ');
}

/** What was left out of a ready export, or null for nothing. */
export function leftOutLine(view: ExportView): string | null {
  const notes: string[] = [];
  if (view.leftOut > 0)
    notes.push(
      `It reached the size limit, so ${view.leftOut} item${view.leftOut === 1 ? ' was' : 's were'} left out.`,
    );
  if (view.problems > 0)
    notes.push(
      `${view.problems} item${view.problems === 1 ? '' : 's'} couldn’t be read; the README inside names ${view.problems === 1 ? 'it' : 'them'}.`,
    );
  return notes.length > 0 ? notes.join(' ') : null;
}

/** Why the emailed link didn't open, as the redirect to Settings names it. */
export const REFUSALS: Record<ExportLinkRefusal, string> = {
  expired: 'That download link has lapsed. Make a new download below.',
  'other-account':
    'That download link is for a different account, or it was changed. Sign in as the account it was sent to.',
  missing: 'That download isn’t there any more: a newer one has replaced it.',
};

/** What to say when starting one is refused. */
export function startError(error: string): string {
  switch (error) {
    case 'export_running':
      return 'A download you started is still being made. Wait for it to finish, then make another.';
    case 'not_team_admin':
      return 'Only the team’s admins can download its data.';
    case 'export_unavailable':
      return 'Downloads aren’t available right now. Try again later.';
    default:
      return '';
  }
}
