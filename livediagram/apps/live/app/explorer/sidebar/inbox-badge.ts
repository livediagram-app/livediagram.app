// The Inbox row's pill (docs/specs/013-workspace/inbox.md §1): how many open actions and Plan cards
// are assigned to the reader, shown at 0 too, so an empty Inbox reads as done. Nothing while the
// Inbox is loading or failed to load: a 0 there would claim a clear Inbox nobody has read.
export function inboxBadge(feed: {
  assignedToMe: readonly unknown[];
  loading: boolean;
  error: boolean;
}): number | undefined {
  if (feed.loading || feed.error) return undefined;
  return feed.assignedToMe.length;
}
