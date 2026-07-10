import { describe, expect, it } from 'vitest';
import type { ShapeElement } from '@livediagram/diagram';
import { applyRevert, coalesceDiff, diffElements } from './change-log';

// Helper — every test wants a basic shape element with a stable id.
const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

describe('diffElements', () => {
  it('returns null when nothing changed', () => {
    const a = shape('a');
    expect(diffElements([a], [a])).toBeNull();
  });

  it('detects a pure add → kind: add, before=null, after=element', () => {
    const a = shape('a');
    const result = diffElements([], [a]);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('add');
    expect(result!.elementIds).toEqual(['a']);
    expect(result!.beforeState['a']).toBeNull();
    expect(result!.afterState['a']).toEqual(a);
  });

  it('detects a pure delete → kind: delete, before=element, after=null', () => {
    const a = shape('a');
    const result = diffElements([a], []);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('delete');
    expect(result!.beforeState['a']).toEqual(a);
    expect(result!.afterState['a']).toBeNull();
  });

  it('detects an edit → kind: edit, before+after both populated', () => {
    const before = shape('a', { label: 'old' });
    const after = shape('a', { label: 'new' });
    const result = diffElements([before], [after]);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('edit');
    expect(result!.beforeState['a']).toEqual(before);
    expect(result!.afterState['a']).toEqual(after);
  });

  it('mixed (add + delete + edit) collapses to kind: edit', () => {
    const beforeKeep = shape('keep', { label: 'old' });
    const afterKeep = shape('keep', { label: 'new' });
    const result = diffElements([beforeKeep, shape('gone')], [afterKeep, shape('fresh')]);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('edit');
    // All three touched ids should be present.
    expect(new Set(result!.elementIds)).toEqual(new Set(['keep', 'gone', 'fresh']));
  });
});

describe('summary labelling', () => {
  it('names an edited table by kind, not by a stray label (no "Edited \'C\'")', () => {
    // A table's content lives in `cells`; its `label` should never drive
    // the activity summary (it leaked the cell text "C" before the fix).
    const before = {
      id: 't',
      type: 'table' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      cells: [['B']],
      label: 'C',
    };
    const after = { ...before, cells: [['C']] };
    const result = diffElements([before], [after]);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('Edited cells in a Table');
    expect(result!.summary).not.toContain("'C'");
  });
});

describe('coalesceDiff', () => {
  it('merges two consecutive moves into one entry spanning first-before to last-after', () => {
    const start = shape('a');
    const mid = shape('a', { x: 50 });
    const end = shape('a', { x: 120 });
    // First gesture logged start → mid; the follow-up diff is mid → end.
    const first = diffElements([start], [mid])!;
    const followUp = diffElements([mid], [end])!;
    const merged = coalesceDiff(first.beforeState, followUp.afterState);
    expect(merged).not.toBeNull();
    expect(merged!.summary).toBe('Moved a Square');
    expect(merged!.beforeState['a']).toEqual(start);
    expect(merged!.afterState['a']).toEqual(end);
  });

  it('returns null when the span nets out to no change (moved away and back)', () => {
    const start = shape('a');
    const mid = shape('a', { x: 50 });
    const first = diffElements([start], [mid])!;
    const backHome = diffElements([mid], [start])!;
    expect(coalesceDiff(first.beforeState, backHome.afterState)).toBeNull();
  });

  it('drops the element that returned home but keeps the one that moved on', () => {
    const a1 = shape('a');
    const b1 = shape('b');
    const a2 = shape('a', { x: 40 });
    const b2 = shape('b', { x: 40 });
    const b3 = shape('b', { x: 90 });
    const first = diffElements([a1, b1], [a2, b2])!;
    const followUp = diffElements([a2, b2], [a1, b3])!; // a back home, b moves on
    const merged = coalesceDiff(first.beforeState, followUp.afterState);
    expect(merged).not.toBeNull();
    expect(merged!.elementIds).toEqual(['b']);
    expect(merged!.summary).toBe('Moved a Square');
  });
});

describe('applyRevert', () => {
  it('reverts a delete by re-adding the element', () => {
    // Original change: deleted 'a'. Before = a, After = null.
    const a = shape('a');
    const next = applyRevert([], { a });
    expect(next).toEqual([a]);
  });

  it('reverts an add by removing the element', () => {
    // Original change: added 'a'. Before = null, After = a.
    const a = shape('a');
    const next = applyRevert([a], { a: null });
    expect(next).toEqual([]);
  });

  it('reverts an edit by swapping the matched element', () => {
    const before = shape('a', { label: 'old' });
    const current = shape('a', { label: 'new' });
    const next = applyRevert([current], { a: before });
    expect(next).toEqual([before]);
  });

  it('leaves unrelated elements untouched', () => {
    const a = shape('a');
    const b = shape('b');
    // Revert only targets 'a' — 'b' stays put in its current state.
    const next = applyRevert([a, b], { a: null });
    expect(next).toEqual([b]);
  });

  it('a previously-deleted element gets re-added at the end of the list', () => {
    // current has 'b' only; before state says 'a' existed. Revert re-adds 'a'.
    const a = shape('a');
    const b = shape('b');
    const next = applyRevert([b], { a });
    expect(next).toEqual([b, a]);
  });
});
