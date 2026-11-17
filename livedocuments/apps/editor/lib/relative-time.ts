// Relative-time formatting shared by the footer save indicator, the
// Explorer's "Your documents" list, and the Explorer's Inbox rows.
// Kept here so every surface reads identically — previously each
// surface had its own slightly different copy.
//
// Four formatters, coarsening as the space they have to fit shrinks:
//   formatRelativeTime         — verbose ("2 mins ago"), reached through
//                                relativeSince by every list row.
//   formatRelativeTimeShort    — compact ("2 min ago"), Inbox rows.
//   formatRelativeTimeCompact  — ultra-compact ("2m ago"), comment threads.
// The first two share their ladder, in @livedocuments/ui (relative-time.ts).

// The verbose and short ladders (and relativeSince) live in @livedocuments/ui.
export { formatRelativeTime, formatRelativeTimeShort, relativeSince } from '@livedocuments/ui';

// Ultra-compact ("2m ago" / "3h ago" / "5d ago"), used in the comment
// thread where each row is tiny. Coarser than the others on purpose: no
// seconds and no "yesterday", since comment timestamps are usually
// minutes-to-days old and the row has no room to spare.
export function formatRelativeTimeCompact(deltaMs: number): string {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// The clock relative-time strings read (one shared 30 s tick, so every row on a page agrees): one copy for every
// editor, in @liveworkspace/workbench, which the shared surfaces read too.
export { RELATIVE_TICK_MS, useRelativeNow } from '@liveworkspace/workbench/lib/relative-now';
