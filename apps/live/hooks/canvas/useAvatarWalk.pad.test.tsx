// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarPadCore, createShape, type Element } from '@livediagram/document';
import { DEFAULT_AVATAR_CONFIG } from '@/lib/avatar-config';
import type { AvatarPoint } from '@/lib/avatar-walk';
import { track } from '@/lib/telemetry';
import { useAvatarWalk } from './useAvatarWalk';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/009-elements/avatar-pad.md "Starting on the pad": entering Avatar mode on a tab with a pad puts the
// character on it, over a button's spawn, and brings the view to it when it is off screen.

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

function setup({
  elements,
  spawnAt = null,
}: {
  elements: Element[];
  spawnAt?: AvatarPoint | null;
}) {
  // An 800x600 view onto the canvas, at its origin, zoom 1.
  const main = { getBoundingClientRect: () => rect(0, 0, 800, 600) } as HTMLElement;
  const wrapper = { getBoundingClientRect: () => rect(0, 0, 4000, 4000) } as HTMLDivElement;
  const setViewportOffset = vi.fn();
  const spawnAtRef = { current: spawnAt };
  const hook = renderHook(
    ({ active, els }: { active: boolean; els: Element[] }) =>
      useAvatarWalk({
        active,
        config: DEFAULT_AVATAR_CONFIG,
        onToggleGender: vi.fn(),
        elements: els,
        mainRef: { current: main },
        wrapperRef: { current: wrapper },
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        setViewportOffset,
        spawnAtRef,
      }),
    { initialProps: { active: false, els: elements } },
  );
  return { ...hook, setViewportOffset, spawnAtRef };
}

const pad = (id: string, x: number, y: number): Element => ({
  ...createShape('avatar-pad', x, y),
  id,
});

beforeEach(() => vi.mocked(track).mockClear());

describe('useAvatarWalk entering on an Avatar Pad', () => {
  it('starts on the pad, leaves an on-screen view alone and counts the arrival', () => {
    const near = pad('near', 100, 100);
    const { result, rerender, setViewportOffset } = setup({ elements: [near] });
    rerender({ active: true, els: [near] });
    expect(result.current.pos).toEqual(avatarPadCore(near as never));
    expect(result.current.facing).toBe('down');
    expect(setViewportOffset).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'AvatarPadArrival');
  });

  it('brings the view to a pad that is off screen, zoom untouched', () => {
    const far = pad('far', 3000, 2000);
    const { result, rerender, setViewportOffset } = setup({ elements: [far] });
    rerender({ active: true, els: [far] });
    const core = avatarPadCore(far as never);
    expect(result.current.pos).toEqual(core);
    expect(setViewportOffset).toHaveBeenCalledWith({ x: 400 - core.x, y: 300 - core.y });
  });

  it('wins over a Selection Mode button, and spends the button spawn', () => {
    const lobby = pad('lobby', 100, 100);
    const { result, rerender, spawnAtRef } = setup({
      elements: [lobby],
      spawnAt: { x: 600, y: 500 },
    });
    rerender({ active: true, els: [lobby] });
    expect(result.current.pos).toEqual(avatarPadCore(lobby as never));
    expect(spawnAtRef.current).toBeNull();
  });

  it('starts on the pad nearest the view’s centre', () => {
    const a = pad('a', 0, 0);
    const b = pad('b', 340, 260);
    const { result, rerender } = setup({ elements: [a, b] });
    rerender({ active: true, els: [a, b] });
    expect(result.current.pos).toEqual(avatarPadCore(b as never));
  });

  it('never moves a character already walking when a pad is added or moved', () => {
    const { result, rerender } = setup({ elements: [], spawnAt: { x: 200, y: 200 } });
    rerender({ active: true, els: [] });
    expect(result.current.pos).toEqual({ x: 200, y: 200 });
    rerender({ active: true, els: [pad('new', 500, 400)] });
    expect(result.current.pos).toEqual({ x: 200, y: 200 });
    expect(track).not.toHaveBeenCalled();
  });

  it('every entry starts on the pad, even after a detour', () => {
    const lobby = pad('lobby', 100, 100);
    const { result, rerender } = setup({ elements: [lobby] });
    rerender({ active: true, els: [lobby] });
    act(() => result.current.teleportTo({ x: 300, y: 300 }));
    rerender({ active: false, els: [lobby] });
    rerender({ active: true, els: [lobby] });
    expect(result.current.pos).toEqual(avatarPadCore(lobby as never));
  });

  it('without a pad, keeps the button spawn first', () => {
    const { result, rerender } = setup({ elements: [], spawnAt: { x: 600, y: 500 } });
    rerender({ active: true, els: [] });
    expect(result.current.pos).toEqual({ x: 600, y: 500 });
  });
});
