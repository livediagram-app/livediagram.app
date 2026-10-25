// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useShowFollowersMyView } from './useShowFollowersMyView';

// docs/specs/012-collaboration/follow-me-viewport.md "Starting and stopping": a new follower lands on our view at once.
describe('useShowFollowersMyView', () => {
  it('publishes our view when someone starts following, and only then', () => {
    const publish = vi.fn();
    const { rerender } = renderHook(({ ids }) => useShowFollowersMyView(ids, publish), {
      initialProps: { ids: [] as string[] },
    });
    expect(publish).not.toHaveBeenCalled();
    rerender({ ids: ['peer-a'] });
    expect(publish).toHaveBeenCalledTimes(1);
    // The same followers on a later render (a new array, the same people): nothing new to show.
    rerender({ ids: ['peer-a'] });
    expect(publish).toHaveBeenCalledTimes(1);
    rerender({ ids: ['peer-a', 'peer-b'] });
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when the last follower stops', () => {
    const publish = vi.fn();
    const { rerender } = renderHook(({ ids }) => useShowFollowersMyView(ids, publish), {
      initialProps: { ids: ['peer-a'] as string[] },
    });
    expect(publish).toHaveBeenCalledTimes(1);
    rerender({ ids: [] });
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
