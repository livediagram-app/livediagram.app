import { afterEach, describe, expect, it } from 'vitest';
import type { InsertionSlot } from './insert-between';
import { getPaletteDragSnap, setPaletteDragSnap } from './palette-drag-preview';
import { getInsertionSlot, setInsertionSlot, takeInsertionSlot } from './insertion-preview';

function slot(overrides: Partial<InsertionSlot> = {}): InsertionSlot {
  return {
    atX: 272,
    atY: 100,
    shiftDx: 272,
    shiftedIds: ['b', 'c'],
    leftId: 'a',
    rightId: 'b',
    spanTop: -40,
    spanBottom: 240,
    ...overrides,
  };
}

afterEach(() => {
  setInsertionSlot(null);
  setPaletteDragSnap(null);
});

describe('the insertion-slot channel', () => {
  it('publishes the slot the drag is offering', () => {
    setInsertionSlot(slot());
    expect(getInsertionSlot()?.atX).toBe(272);
  });

  it('ignores a re-resolved but identical offer, so the canvas stays still', () => {
    setInsertionSlot(slot());
    const published = getInsertionSlot();
    setInsertionSlot(slot());
    // Same value in, same object out: the setter bailed, so no subscriber
    // (every element view) was woken at dragover rate.
    expect(getInsertionSlot()).toBe(published);
    setInsertionSlot(slot({ shiftedIds: ['b', 'c', 'd'] }));
    expect(getInsertionSlot()).not.toBe(published);
  });

  it('is consumed by the drop, so the next drag cannot inherit it', () => {
    setInsertionSlot(slot());
    expect(takeInsertionSlot()?.atX).toBe(272);
    expect(getInsertionSlot()).toBeNull();
    expect(takeInsertionSlot()).toBeNull();
  });

  it('clears to nothing on the drag-end / escape / leave path', () => {
    setInsertionSlot(slot());
    setInsertionSlot(null);
    expect(getInsertionSlot()).toBeNull();
  });

  it('is independent of the alignment-snap channel', () => {
    setPaletteDragSnap({ dx: 4, dy: 2 });
    setInsertionSlot(slot());
    takeInsertionSlot();
    expect(getPaletteDragSnap()).toEqual({ dx: 4, dy: 2 });
  });
});
