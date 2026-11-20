// The Inbox's data (useInbox.ts): the host's Offline rows are read again, alone, when the host says they
// changed (`subscribeLocal`, the Explorer page hearing the app's snapshot); the index is not asked again. A row done
// from the pane stays out after a reload while the index still lists it (Work Tracker 1316).
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxThread } from '@liveworkspace/index-client';
import type { InboxEntry } from '../explorer/inbox/sections';
import { createFakeIndex } from '../test/fakeClient';
import type { InboxHost, InboxLocalRows } from '../types';
import { useInbox } from './useInbox';

const thread = (id: string, latestAt: number): InboxThread => ({
  app: 'liveplanner',
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
  latestAuthorName: 'Me',
  latestAuthorColor: '#000',
  mentionsYou: false,
  youCommented: true,
  onYourItem: true,
  firstAt: latestAt,
  latestAt,
});

describe('useInbox', () => {
  it("reads the host's rows again, and only them, when the host says they changed", async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('server', 1));
    let local: InboxLocalRows = { actions: [], threads: [] };
    const listeners = new Set<() => void>();
    const host: InboxHost = {
      localRows: vi.fn(() => Promise.resolve(local)),
      subscribeLocal: (onChange) => {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
    };
    const { result, unmount } = renderHook(() =>
      useInbox(index.client, 'liveplanner', 'app', host),
    );
    await waitFor(() => expect(result.current.data?.threads).toHaveLength(1));
    const asked = index.calls.filter((c) => c.method === 'inbox').length;

    local = { actions: [], threads: [thread('offline', 5)] };
    act(() => listeners.forEach((l) => l()));
    await waitFor(() =>
      expect(result.current.data?.threads.map((t) => [t.itemId, t.local ?? false])).toEqual([
        ['offline', true],
        ['server', false],
      ]),
    );
    expect(index.calls.filter((c) => c.method === 'inbox')).toHaveLength(asked);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("reads the host's rows again when it reads for someone else (the person settled after the first read)", async () => {
    const index = createFakeIndex();
    const nobody: InboxHost = { localRows: () => Promise.resolve({ actions: [], threads: [] }) };
    const guest: InboxHost = {
      localRows: () => Promise.resolve({ actions: [], threads: [thread('offline', 5)] }),
    };
    const { result, rerender } = renderHook(
      ({ host }) => useInbox(index.client, 'liveplanner', 'app', host),
      { initialProps: { host: nobody } },
    );
    await waitFor(() => expect(result.current.data?.threads).toEqual([]));
    const asked = index.calls.filter((c) => c.method === 'inbox').length;
    rerender({ host: guest });
    await waitFor(() =>
      expect(result.current.data?.threads.map((t) => t.itemId)).toEqual(['offline']),
    );
    // The same host again reads nothing more, and the index is not asked again.
    rerender({ host: guest });
    expect(index.calls.filter((c) => c.method === 'inbox')).toHaveLength(asked);
  });
});

const entryOf = (t: InboxThread): InboxEntry => ({
  key: `t:${t.itemId}`,
  kind: 'Thread',
  forMe: false,
  row: t,
  at: t.latestAt,
});

// The owner's report (Work Tracker 1316, 2026-11-19): "I click "Resolve" to each and they disapear, but when I reload
// the page they are still there". The app wrote the resolve; the index lists the thread open until the app's next
// push (an outbox drained at most once a minute), and the hold on the row lived in the page alone.
describe('a row done from the pane, then the Inbox read again', () => {
  beforeEach(() => localStorage.clear());

  it('stays out after a reload while the index still lists it, and comes back once it changes', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a', 10), thread('b', 20));
    const open = () =>
      renderHook(() => useInbox(index.client, 'liveplanner', 'app', undefined, true, 'user_me'));
    const first = open();
    await waitFor(() => expect(first.result.current.data?.threads).toHaveLength(2));
    act(() => first.result.current.settle(entryOf(index.inbox.threads[0]!)));
    expect(first.result.current.data?.threads.map((t) => t.itemId)).toEqual(['b']);
    first.unmount();

    // The reload: a new page reads the index, which still lists the thread as it was.
    const reloaded = open();
    await waitFor(() => expect(reloaded.result.current.data).not.toBeNull());
    expect(reloaded.result.current.data?.threads.map((t) => t.itemId)).toEqual(['b']);
    reloaded.unmount();

    // A new reply after: the row is news again.
    index.inbox.threads[0] = thread('a', 30);
    const replied = open();
    await waitFor(() =>
      expect(replied.result.current.data?.threads.map((t) => t.itemId).sort()).toEqual(['a', 'b']),
    );
    replied.unmount();
  });

  it('holds it for this page alone when signed out', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a', 10));
    const open = () => renderHook(() => useInbox(index.client, 'liveplanner', 'app'));
    const first = open();
    await waitFor(() => expect(first.result.current.data?.threads).toHaveLength(1));
    act(() => first.result.current.settle(entryOf(index.inbox.threads[0]!)));
    act(() => first.result.current.settle(entryOf(index.inbox.threads[0]!)));
    expect(first.result.current.data?.threads).toEqual([]);
    first.unmount();
    const reloaded = open();
    await waitFor(() => expect(reloaded.result.current.data?.threads).toHaveLength(1));
  });
});
