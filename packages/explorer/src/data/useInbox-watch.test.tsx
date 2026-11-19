// The Inbox list hearing the page's watch (useInbox.ts, inbox-notices.md "The Explorer's Inbox listens too"): under
// All a newer answer becomes the list with no read of its own; under this app's filter, an answer whose rows for the
// app differ reads the list again, and one that differs only in another app's rows reads nothing.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InboxThread } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import { inboxWatchFor } from '../inbox-notices/watch';
import { useInbox } from './useInbox';

const thread = (id: string, app: InboxThread['app'] = 'liveplanner'): InboxThread => ({
  app,
  itemId: id,
  itemTitle: id,
  itemTeamId: null,
  tabId: 't1',
  tabName: 'Plan',
  elementId: 'e1',
  elementLabel: 'Shape',
  card: null,
  resolved: false,
  commentCount: 1,
  latestText: 'Hi',
  latestAuthorName: 'Bo',
  latestAuthorColor: '#000',
  mentionsYou: false,
  youCommented: true,
  onYourItem: true,
  firstAt: 1,
  latestAt: 1,
});

const reads = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => c.method === 'inbox').length;

describe('useInbox and the watch', () => {
  it('takes a newer answer as the list under All, with no read of its own', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a'));
    const { result } = renderHook(() => useInbox(index.client, 'liveplanner', 'all'));
    await waitFor(() => expect(result.current.data?.threads).toHaveLength(1));
    const before = reads(index);
    index.inbox.threads.push(thread('b', 'livediagram'));
    const stop = inboxWatchFor(index.client).subscribe(() => {}, { readNow: true });
    await waitFor(() => expect(result.current.data?.threads).toHaveLength(2));
    // The watch's read alone.
    expect(reads(index)).toBe(before + 1);
    stop();
  });

  it('under this app, reads again only when this app’s rows differ', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a'));
    const { result } = renderHook(() => useInbox(index.client, 'liveplanner', 'app'));
    await waitFor(() => expect(result.current.data?.threads).toHaveLength(1));
    const before = reads(index);
    index.inbox.threads.push(thread('elsewhere', 'livediagram'));
    const first = inboxWatchFor(index.client).subscribe(() => {}, { readNow: true });
    await waitFor(() => expect(reads(index)).toBe(before + 1));
    expect(result.current.data?.threads).toHaveLength(1);
    first();

    const other = createFakeIndex();
    other.inbox.threads.push(thread('a'));
    const second = renderHook(() => useInbox(other.client, 'liveplanner', 'app'));
    await waitFor(() => expect(second.result.current.data?.threads).toHaveLength(1));
    const was = reads(other);
    other.inbox.threads.push(thread('b'));
    const stop = inboxWatchFor(other.client).subscribe(() => {}, { readNow: true });
    await waitFor(() => expect(second.result.current.data?.threads).toHaveLength(2));
    // The watch's read, and the list's own read again.
    expect(reads(other)).toBe(was + 2);
    stop();
  });

  it('hears nothing while off', async () => {
    const index = createFakeIndex();
    renderHook(() => useInbox(index.client, 'livehuddle', 'all', undefined, false));
    const stop = inboxWatchFor(index.client).subscribe(() => {}, { readNow: true });
    await waitFor(() => expect(reads(index)).toBe(1));
    stop();
  });
});
