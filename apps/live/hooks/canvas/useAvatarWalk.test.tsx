// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '@/lib/avatar-config';
import { useAvatarWalk } from './useAvatarWalk';

// Leaving Avatar mode (docs/specs/008-canvas/avatar-mode.md) drops whatever the character was doing and
// vacates its chair, and tells peers to drop it.

function setup(onPresence = vi.fn()) {
  const hook = renderHook(
    ({ active }: { active: boolean }) =>
      useAvatarWalk({
        active,
        config: DEFAULT_AVATAR_CONFIG,
        onToggleGender: vi.fn(),
        elements: [],
        mainRef: { current: null },
        wrapperRef: { current: null },
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        setViewportOffset: vi.fn(),
        onPresence,
      }),
    { initialProps: { active: true } },
  );
  return { ...hook, onPresence };
}

describe('useAvatarWalk leaving the mode', () => {
  it('vacates the chair, stands still and tells peers', () => {
    const { result, rerender, onPresence } = setup();
    act(() => result.current.sitOn('chair-1', { x: 10, y: 10 }, 'down'));
    expect(result.current.seatedOn).toBe('chair-1');
    onPresence.mockClear();

    rerender({ active: false });
    expect(result.current.seatedOn).toBeNull();
    expect(result.current.walking).toBe(false);
    expect(result.current.lift).toBe(0);
    expect(result.current.wave).toBeNull();
    expect(result.current.pose).toBeNull();
    expect(onPresence).toHaveBeenCalledWith(null);
  });

  it('comes back unseated', () => {
    const { result, rerender } = setup();
    act(() => result.current.sitOn('chair-1', { x: 10, y: 10 }, 'down'));
    rerender({ active: false });
    rerender({ active: true });
    expect(result.current.seatedOn).toBeNull();
  });
});
