// The Snapshots dialog's words (liveworkspace/docs/specs/014-snapshots/snapshots.md "In the editor"; blueprint SN26).

import { formatRelativeTime } from '@liveworkspace/ui/relative-time';
import { AUTOMATION_AUTHOR_ID, type SnapshotSummary } from '../wire';

/** A snapshot's time as a label, `15 Nov, 14:32`, in the viewer's locale. */
export function snapshotTime(at: number, locale?: string): string {
  const date = new Date(at);
  const day = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** What the row is called: its name, else its time. */
export function snapshotTitle(snapshot: SnapshotSummary, locale?: string): string {
  return snapshot.name ?? `Snapshot of ${snapshotTime(snapshot.createdAt, locale)}`;
}

/** Bytes as KB or MB, one decimal under 10. */
export function snapshotSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) {
    const n = Math.max(1, kb);
    return `${n < 10 ? n.toFixed(1) : Math.round(n)} KB`;
  }
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Who took it: "You" for the viewer, their name otherwise, "Someone" for none, "Automation · <rule>" for a rule
 *  (liveworkspace/docs/specs/018-automations/automations.md "Who may do what"). */
export function snapshotAuthor(snapshot: SnapshotSummary, viewerId: string | null): string {
  if (!snapshot.author) return 'Someone';
  if (snapshot.author.id === AUTOMATION_AUTHOR_ID) {
    return snapshot.author.name ? `Automation · ${snapshot.author.name}` : 'Automation';
  }
  if (viewerId !== null && snapshot.author.id === viewerId) return 'You';
  return snapshot.author.name || 'Someone';
}

/** When a snapshot on a tier that keeps them for a time is dropped: "Kept until 27 Nov". */
export function snapshotKeptUntil(expiresAt: number, locale?: string): string {
  const day = new Date(expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `Kept until ${day}`;
}

/** The row's second line: who, how long ago, how big, and until when where the owner's tier keeps it for a time. */
export function snapshotMeta(
  snapshot: SnapshotSummary,
  viewerId: string | null,
  now: number,
  locale?: string,
): string {
  const ago = formatRelativeTime(Math.max(0, now - snapshot.createdAt));
  const meta = `${snapshotAuthor(snapshot, viewerId)} · ${ago} · ${snapshotSize(snapshot.bytes)}`;
  return snapshot.expiresAt === undefined
    ? meta
    : `${meta} · ${snapshotKeptUntil(snapshot.expiresAt, locale)}`;
}

/** The quiet line under the snapshots of an item whose owner's tier keeps them for a time (snapshots.md "With Pro
 *  on"). The server said the days; only Free keeps them for a time. `keeper` is the tier that keeps them: Pro, or Pro
 *  for Teams for a team's own people, as every other notice on a team's item names it. */
export function retentionSentence(days: number, keeper = 'Pro'): string {
  return `Free keeps snapshots for ${days === 1 ? '1 day' : `${days} days`}. ${keeper} keeps them forever.`;
}

/** The same line for anyone who cannot act on the owner's tier (a collaborator, a signed-out visitor): how long
 *  snapshots last here, with no tier named, since a collaborator is never told the owner's tier. */
export function othersRetentionSentence(days: number): string {
  return `Snapshots here are kept for ${days === 1 ? '1 day' : `${days} days`}.`;
}
