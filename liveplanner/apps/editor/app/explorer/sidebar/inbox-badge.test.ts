import { describe, expect, it } from 'vitest';
import { inboxBadge } from './inbox-badge';

// docs/specs/013-workspace/inbox.md §1: the Inbox row always counts what is waiting on the reader.
const feed = (assigned: number, over: { loading?: boolean; error?: boolean } = {}) => ({
  assignedToMe: Array.from({ length: assigned }, () => ({})),
  loading: false,
  error: false,
  ...over,
});

describe('inboxBadge', () => {
  it('counts the open items assigned to the reader', () => {
    expect(inboxBadge(feed(3))).toBe(3);
  });

  it('shows 0 when nothing is waiting', () => {
    expect(inboxBadge(feed(0))).toBe(0);
  });

  it('shows nothing while the Inbox loads or after it failed, never a false 0', () => {
    expect(inboxBadge(feed(0, { loading: true }))).toBeUndefined();
    expect(inboxBadge(feed(0, { error: true }))).toBeUndefined();
  });
});
