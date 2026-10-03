// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The sidebar's unread badge (docs/specs/013-workspace/timeline.md §2.5, §8.2): reading Home or the
// feed clears it, and a count still in flight when it was cleared must not draw it back.

const { apiTimelineUnread } = vi.hoisted(() => ({ apiTimelineUnread: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiTimelineUnread }));

import { useTimelineUnread } from './useTimelineUnread';

describe('useTimelineUnread', () => {
  it('shows the count it reads', async () => {
    apiTimelineUnread.mockResolvedValue(4);
    const { result } = renderHook(() => useTimelineUnread('owner'));
    await waitFor(() => expect(result.current.count).toBe(4));
  });

  it('keeps a clear when the count lands after it', async () => {
    let resolve: (n: number) => void = () => {};
    apiTimelineUnread.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useTimelineUnread('owner'));
    act(() => result.current.clear());
    await act(async () => resolve(7));
    expect(result.current.count).toBe(0);
  });
});
