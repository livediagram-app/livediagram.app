// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarBindings } from '../bindings';
import { useAvatarStatus } from './useAvatarStatus';

// The product's telemetry reaches the package through its bindings.
vi.mock('../bindings', () => ({ avatarBindings: { track: vi.fn() } }));
const { track } = avatarBindings;
beforeEach(() => vi.mocked(track).mockClear());

// docs/specs/008-canvas/avatar-mode.md "Status"
describe('useAvatarStatus', () => {
  it('counts a pick only when it changes the status', () => {
    const { result } = renderHook(() => useAvatarStatus(true));
    act(() => result.current[1](null));
    expect(track).not.toHaveBeenCalled();
    act(() => result.current[1]('focus'));
    act(() => result.current[1]('focus'));
    expect(track).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe('focus');
  });

  it('clears the status on leaving the mode', () => {
    const { result, rerender } = renderHook(({ on }) => useAvatarStatus(on), {
      initialProps: { on: true },
    });
    act(() => result.current[1]('away'));
    rerender({ on: false });
    expect(result.current[0]).toBeNull();
  });
});
