// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { InsertionSlot } from '@/lib/insert-between';
import { setInsertionSlot, setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { useInsertShift } from './useInsertShift';

const SLOT: InsertionSlot = {
  atX: 272,
  atY: 100,
  shiftDx: 272,
  shiftedIds: ['b', 'c'],
  leftId: 'a',
  rightId: 'b',
  spanTop: -40,
  spanBottom: 240,
};

afterEach(() => {
  act(() => {
    setInsertionSlot(null);
    setPaletteDragPreview(null);
  });
});

describe('useInsertShift', () => {
  it('moves nothing while no slot is open', () => {
    const { result } = renderHook(() => useInsertShift());
    expect(result.current.xFor('b')).toBeUndefined();
    expect(result.current.animates).toBe(false);
  });

  it('offsets exactly the elements the slot moves', () => {
    const { result } = renderHook(() => useInsertShift());
    act(() => setInsertionSlot(SLOT));
    expect(result.current.xFor('a')).toBeUndefined();
    expect(result.current.xFor('b')).toBe(272);
    expect(result.current.xFor('c')).toBe(272);
  });

  it('keeps the easing mounted for the whole drag, so the slot closes smoothly', () => {
    const { result } = renderHook(() => useInsertShift());
    act(() => setPaletteDragPreview({ kind: 'square', width: 200, height: 200 }));
    expect(result.current.animates).toBe(true);
    // Slot closed, drag still in hand: the transition must outlive the offset.
    act(() => setInsertionSlot(SLOT));
    act(() => setInsertionSlot(null));
    expect(result.current.animates).toBe(true);
    expect(result.current.xFor('b')).toBeUndefined();
  });
});
