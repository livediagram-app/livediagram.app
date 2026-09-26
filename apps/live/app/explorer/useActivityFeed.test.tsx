// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityAction, ActivityThread } from '@livediagram/api-schema';

// The Activity page's one read, split three ways (docs/specs/013-workspace/activity-page.md §1), and the
// error-vs-empty distinction the inbox depends on.

const apiListActivity = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiListActivity }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useReturnToTab', () => ({ useReturnToTab: vi.fn() }));

import { useActivityFeed } from './useActivityFeed';

const place = {
  diagramId: 'd1',
  diagramName: 'Payments',
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
  onYourDiagram: false,
};

beforeEach(() => {
  apiListActivity.mockReset();
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
    });
    const { result } = renderHook(() => useActivityFeed('me'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assignedToMe.map((a) => a.id)).toEqual(['mine', 'self']);
    expect(result.current.youAssigned.map((a) => a.id)).toEqual(['theirs']);
    expect(result.current.threads).toHaveLength(1);
    expect(result.current.error).toBe(false);
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
});
