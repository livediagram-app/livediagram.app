// The Inbox's data (useInbox.ts): the host's This Browser rows are read again, alone, when the host says they
// changed (`subscribeLocal`, the Explorer page hearing the app's snapshot); the index is not asked again.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InboxThread } from '@liveworkspace/index-client';
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
});
