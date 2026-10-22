// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarPadCore, createShape, type Element, type ShapeElement } from '@livediagram/document';
import { AVATAR_PAD_ARRIVAL_MS } from '@/lib/avatar-pad';
import type { AvatarPoint } from '@/lib/avatar-walk';
import { useAvatarPadArrivals } from './useAvatarPadArrivals';

// docs/specs/009-elements/avatar-pad.md "The arrival": derived on each screen from the positions everyone publishes.

const pad = { ...createShape('avatar-pad', 100, 100), id: 'pad' } as ShapeElement;
const core = avatarPadCore(pad);
type Peer = { id: string; color: string; avatar: { x: number; y: number } };

function setup(elements: Element[] = [pad]) {
  return renderHook(
    ({ self, peers }: { self: AvatarPoint | null; peers: Peer[] }) =>
      useAvatarPadArrivals({ self, selfColor: '#0ea5e9', peers, elements }),
    { initialProps: { self: null as AvatarPoint | null, peers: [] as Peer[] } },
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAvatarPadArrivals', () => {
  it('beams you in when you appear on a pad, then clears the beam', () => {
    const { result, rerender } = setup();
    expect(result.current).toEqual([]);
    rerender({ self: core, peers: [] });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({ personId: 'self', padId: 'pad', color: '#0ea5e9' });
    act(() => {
      vi.advanceTimersByTime(AVATAR_PAD_ARRIVAL_MS + 1);
    });
    expect(result.current).toEqual([]);
  });

  it('beams a peer in when they first appear on a pad, once', () => {
    const { result, rerender } = setup();
    const ann: Peer = { id: 'ann', color: '#f43f5e', avatar: core };
    rerender({ self: null, peers: [ann] });
    expect(result.current.map((a) => a.personId)).toEqual(['ann']);
    // Walking about (a new packet, same people) starts nothing new.
    rerender({ self: null, peers: [{ ...ann, avatar: { x: core.x + 1, y: core.y } }] });
    expect(result.current).toHaveLength(1);
  });

  it('starts nothing for somebody appearing off a pad, or on a tab without one', () => {
    const off = setup();
    off.rerender({ self: { x: 0, y: 0 }, peers: [] });
    expect(off.result.current).toEqual([]);
    const bare = setup([]);
    bare.rerender({ self: core, peers: [] });
    expect(bare.result.current).toEqual([]);
  });

  it('beams you in again on the next entry', () => {
    const { result, rerender } = setup();
    rerender({ self: core, peers: [] });
    act(() => {
      vi.advanceTimersByTime(AVATAR_PAD_ARRIVAL_MS + 1);
    });
    rerender({ self: null, peers: [] });
    rerender({ self: core, peers: [] });
    expect(result.current).toHaveLength(1);
  });
});
