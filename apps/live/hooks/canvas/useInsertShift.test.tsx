// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { InsertionSlot } from '@/lib/insert-between';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { setInsertionNoteDragActive, setInsertionSlot } from '@/lib/insertion-preview';
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
    setInsertionNoteDragActive(false);
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

  // The second entry point: a note already on the board. It has no palette
  // preview to derive "a drag is in hand" from, so it says so itself — else
  // the board would snap shut rather than ease when the slot closes.
  it('keeps the easing mounted for a drag of a note already on the board', () => {
    const { result } = renderHook(() => useInsertShift());
    act(() => setInsertionNoteDragActive(true));
    expect(result.current.animates).toBe(true);
    act(() => setInsertionSlot(SLOT));
    expect(result.current.xFor('c')).toBe(272);
    act(() => setInsertionSlot(null));
    expect(result.current.animates).toBe(true);
    act(() => setInsertionNoteDragActive(false));
    expect(result.current.animates).toBe(false);
  });
});
