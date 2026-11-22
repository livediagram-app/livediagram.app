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
// The first two share their ladder, in @liveknowledge/ui (relative-time.ts).

// The verbose, short and compact ladders (and relativeSince) live in @liveknowledge/ui.
export {
  formatRelativeTime,
  formatRelativeTimeCompact,
  formatRelativeTimeShort,
  relativeSince,
} from '@liveknowledge/ui';

// The clock relative-time strings read (one shared 30 s tick, so every row on a page agrees): one copy for every
// editor, in @liveworkspace/workbench, which the shared surfaces read too.
export { RELATIVE_TICK_MS, useRelativeNow } from '@liveworkspace/workbench/lib/relative-now';
