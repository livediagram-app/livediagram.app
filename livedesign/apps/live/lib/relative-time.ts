// Relative-time formatting shared by the footer save indicator, the
// Explorer's "Your designs" list, and the Explorer's Inbox rows.
// Kept here so every surface reads identically — previously each
// surface had its own slightly different copy.
//
// Four formatters, coarsening as the space they have to fit shrinks:
//   formatRelativeTime         — verbose ("2 mins ago"), reached through
//                                relativeSince by every list row.
//   formatRelativeTimeShort    — compact ("2 min ago"), Inbox rows.
//   formatRelativeTimeCompact  — ultra-compact ("2m ago"), comment threads.
//   formatTimeLeftCompact      — the forward-looking countdown ("6d left")
//                                for expiring share links (docs/specs/013-workspace/share-link-expiry.md).
// The first two share their ladder, in @livedesign/ui (relative-time.ts).

// The verbose, short and compact ladders (and relativeSince) live in @livedesign/ui, so the landing page's
// Welcome back tiles (docs/specs/019-marketing/returning-visitor.md) read exactly as the app's rows do.
export {
  formatRelativeTime,
  formatRelativeTimeCompact,
  formatRelativeTimeShort,
  relativeSince,
} from '@livedesign/ui';

// Forward-looking compact countdown ("6d left" / "3h left"), used by
// the Share dialog's expiring-link rows (docs/specs/013-workspace/share-link-expiry.md). Zero or negative
// deltas read as 'expired' so a row that lapses while the dialog is
// open degrades to the truth without a refetch.
export function formatTimeLeftCompact(deltaMs: number): string {
  if (deltaMs <= 0) return 'expired';
  const minutes = Math.ceil(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.ceil(hours / 24);
  return `${days}d left`;
}

// The clock relative-time strings read (one shared 30 s tick, so every row on a page agrees): one copy for every
// editor, in @liveworkspace/workbench, which the shared surfaces read too.
export { RELATIVE_TICK_MS, useRelativeNow } from '@liveworkspace/workbench/lib/relative-now';
