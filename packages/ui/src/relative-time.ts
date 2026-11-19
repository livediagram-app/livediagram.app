// Relative-time wording for the editor's lists and rows (apps/editor/lib/relative-time.ts re-exports it and adds the
// share-link countdown and the shared clock), so "2 hours ago" reads the same in every list.

// The ladder both the verbose and the compact formatter walk. They agreed on
// every rung from one minute up — the same singular cases, the same
// 'yesterday' — and differed only in how they word seconds and plural
// minutes, so those two are arguments and everything else is shared. Written
// out twice, a later change to (say) the day boundary lands in one copy.
function relativeLadder(
  deltaMs: number,
  secs: (n: number) => string,
  mins: (n: number) => string,
): string {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return secs(seconds);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return mins(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function formatRelativeTime(deltaMs: number): string {
  return relativeLadder(
    deltaMs,
    (n) => `${n} secs ago`,
    (n) => `${n} mins ago`,
  );
}

// Verbose relative time elapsed since a past timestamp, at `now`: the instant from useRelativeNow()
// in a component, so render stays pure and every row on the page agrees.
export function relativeSince(timestamp: number, now: number): string {
  return formatRelativeTime(now - timestamp);
}

export function formatRelativeTimeShort(deltaMs: number): string {
  return relativeLadder(
    deltaMs,
    (n) => `${n}s ago`,
    (n) => `${n} min ago`,
  );
}

// Ultra-compact ("2m ago" / "3h ago" / "5d ago"), for the tiny rows: comment threads, the action popover and the
// Collaborate panel. Coarser than the others on purpose: no seconds and no "yesterday", since these timestamps are
// usually minutes-to-days old and the row has no room to spare.
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
