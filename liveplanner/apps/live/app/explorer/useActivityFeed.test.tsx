// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityAction, ActivityCard, ActivityThread } from '@liveplanner/api-schema';

// The Inbox's one read, split three ways (docs/specs/013-workspace/inbox.md §1), and the
// error-vs-empty distinction the inbox depends on.

const apiListActivity = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiListActivity }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useReturnToTab', () => ({ useReturnToTab: vi.fn() }));
const readOfflineActivity = vi.hoisted(() => vi.fn());
vi.mock('@/lib/offline/offline-activity', () => ({ readOfflineActivity }));
vi.mock('@/lib/local-identity', () => ({ getGuestSelfId: () => 'guest-1' }));

const NO_LOCAL = { actions: [], threads: [], cards: [], cardThreads: [] };

import { useActivityFeed } from './useActivityFeed';

const place = {
  projectId: 'd1',
  projectName: 'Payments',
  teamId: null,
  via: 'own' as const,
  shareCode: null,
  tabId: 't1',
  tabName: 'Flow',
  elementLabel: 'Checkout',
};

function action(
  id: string,
  flags: { assignedToMe: boolean; createdByMe: boolean },
): ActivityAction {
  return {
    ...place,
    elementId: id,
    id,
    name: id,
    description: '',
    assignee: { userId: null, name: null },
    assigner: { id: 'x', name: null },
    createdAt: 1,
    updatedAt: 2,
    ...flags,
  };
}

const thread: ActivityThread = {
  ...place,
  elementId: 'e9',
  commentCount: 1,
  latest: { text: 'hi', authorName: 'A', authorColor: '#a', at: 3 },
  firstAt: 3,
  youCommented: true,
  onYourProject: false,
  mentionsYou: false,
};

function card(id: string, updatedAt: number): ActivityCard {
  return {
    projectId: 'd2',
    projectName: 'Roadmap',
    teamId: 'tm',
    via: 'team',
    shareCode: null,
    board: { tabId: 't2', tabName: 'Plan', elementId: 'b1', title: 'Sprint' },
    id,
    key: 1,
    type: 'task',
    title: id,
    status: 'todo',
    updatedAt,
  };
}

beforeEach(() => {
  apiListActivity.mockReset();
  readOfflineActivity.mockReset().mockResolvedValue(NO_LOCAL);
});

describe('useActivityFeed', () => {
  it('splits one read into assigned-to-you / you-assigned / threads, without double-listing a self-assignment', async () => {
    apiListActivity.mockResolvedValue({
      actions: [
        action('mine', { assignedToMe: true, createdByMe: false }),
        action('self', { assignedToMe: true, createdByMe: true }),
        action('theirs', { assignedToMe: false, createdByMe: true }),
      ],
      threads: [thread],
      cards: [],
    });
    const { result } = renderHook(() => useActivityFeed('me'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assignedToMe.map((a) => a.id)).toEqual(['mine', 'self']);
    expect(result.current.youAssigned.map((a) => a.id)).toEqual(['theirs']);
    expect(result.current.threads).toHaveLength(1);
    expect(result.current.error).toBe(false);
  });

  // docs/specs/013-workspace/inbox.md §1, §2.5: a Plan card's thread lists with the element threads,
  // newest comment first.
  it("merges Plan cards' threads into the threads, newest comment first", async () => {
    apiListActivity.mockResolvedValue({
      actions: [],
      threads: [{ ...thread, latest: { ...thread.latest, at: 5 } }],
      cards: [],
      cardThreads: [
        { id: 'it-new', latest: { text: 'n', authorName: 'A', authorColor: '#000', at: 9 } },
        { id: 'it-old', latest: { text: 'o', authorName: 'A', authorColor: '#000', at: 1 } },
      ],
    });
    const { result } = renderHook(() => useActivityFeed('me'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads.map((t) => [t.kind, t.latest.at])).toEqual([
      ['card', 9],
      ['thread', 5],
      ['card', 1],
    ]);
  });

  // docs/specs/013-workspace/inbox.md §1, §2.4: Plan cards on the reader share Assigned to You
  // with actions, newest change first, and count toward the sidebar badge through the same list.
  it('merges Plan cards into assigned-to-you, newest first', async () => {
    apiListActivity.mockResolvedValue({
      actions: [
        { ...action('older-action', { assignedToMe: true, createdByMe: false }), updatedAt: 2 },
        { ...action('theirs', { assignedToMe: false, createdByMe: true }), updatedAt: 9 },
      ],
      threads: [],
      cards: [card('new-card', 5), card('old-card', 1)],
    });
    const { result } = renderHook(() => useActivityFeed('me'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assignedToMe.map((r) => [r.kind, r.id])).toEqual([
      ['card', 'new-card'],
      ['action', 'older-action'],
      ['card', 'old-card'],
    ]);
    expect(result.current.youAssigned.map((a) => a.id)).toEqual(['theirs']);
  });

  // docs/specs/013-workspace/inbox.md §2.6: this browser's projects in This Browser list among the server's rows,
  // in the same order, marked local, and count toward the badge's list.
  it('merges rows in This Browser in among the server rows, marked local', async () => {
    apiListActivity.mockResolvedValue({
      actions: [{ ...action('cloud', { assignedToMe: true, createdByMe: false }), updatedAt: 2 }],
      threads: [],
      cards: [],
    });
    readOfflineActivity.mockResolvedValue({
      ...NO_LOCAL,
      actions: [
        { ...action('local', { assignedToMe: true, createdByMe: true }), updatedAt: 5 },
        { ...action('handed', { assignedToMe: false, createdByMe: true }), updatedAt: 1 },
      ],
      threads: [thread],
    });
    const { result } = renderHook(() => useActivityFeed('user_me'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(readOfflineActivity).toHaveBeenCalledWith(['user_me', 'guest-1']);
    expect(result.current.assignedToMe.map((r) => [r.id, r.local ?? false])).toEqual([
      ['local', true],
      ['cloud', false],
    ]);
    expect(result.current.youAssigned.map((a) => [a.id, a.local])).toEqual([['handed', true]]);
    expect(result.current.threads.map((t) => t.local)).toEqual([true]);
  });

  it('lists the server rows alone when the offline store fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    apiListActivity.mockResolvedValue({
      actions: [action('cloud', { assignedToMe: true, createdByMe: false })],
      threads: [],
      cards: [],
    });
    readOfflineActivity.mockRejectedValue(new Error('no IndexedDB'));
    const { result } = renderHook(() => useActivityFeed('me'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(false);
    expect(result.current.assignedToMe.map((r) => r.id)).toEqual(['cloud']);
    expect(warn).toHaveBeenCalledWith('[inbox] offline-read-failed', expect.any(Error));
    warn.mockRestore();
  });

  it('reports a failed read as an error, not as an empty inbox', async () => {
    apiListActivity.mockResolvedValue(null);
    const { result } = renderHook(() => useActivityFeed('me'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.assignedToMe).toEqual([]);
  });

  it('retry re-reads and clears the error', async () => {
    apiListActivity.mockResolvedValueOnce(null).mockResolvedValueOnce({
      actions: [action('a', { assignedToMe: true, createdByMe: false })],
      threads: [],
      cards: [],
    });
    const { result } = renderHook(() => useActivityFeed('me'));
    await waitFor(() => expect(result.current.error).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBe(false));
    expect(result.current.assignedToMe).toHaveLength(1);
  });

  it('does not read without an owner', () => {
    const { result } = renderHook(() => useActivityFeed(null));
    expect(apiListActivity).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it('loads afresh for a new owner, ignoring a late answer for the previous one', async () => {
    let answerFirst: (v: unknown) => void = () => {};
    apiListActivity
      .mockImplementationOnce(() => new Promise((r) => (answerFirst = r)))
      .mockResolvedValueOnce({
        actions: [action('b1', { assignedToMe: true, createdByMe: false })],
        threads: [],
        cards: [],
      });
    const { result, rerender } = renderHook(({ owner }) => useActivityFeed(owner), {
      initialProps: { owner: 'guest' },
    });
    rerender({ owner: 'user_1' });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => answerFirst({ actions: [], threads: [thread], cards: [] }));
    expect(result.current.assignedToMe.map((a) => a.id)).toEqual(['b1']);
    expect(result.current.threads).toEqual([]);
  });
});
