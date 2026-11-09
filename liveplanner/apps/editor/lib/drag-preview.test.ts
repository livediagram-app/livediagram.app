// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type Element } from '@liveplanner/project';
import {
  applyOverlay,
  clearLocalPreview,
  clearPeerPreview,
  dragPreviewFor,
  localPreview,
  resetDragPreviewForTests,
  setLocalPreview,
  setPeerPreview,
  useDragPreview,
} from './drag-preview';

// docs/specs/008-canvas/drag-preview.md "The preview".

const a = createShape('square', 0, 0);
const b = createShape('square', 200, 0);
const c = createShape('square', 400, 0);
const doc: Element[] = [a, b, c];
const ids = (els: readonly Element[]) => els.map((e) => e.id);

afterEach(() => resetDragPreviewForTests());

describe('the local preview', () => {
  it('holds what a gesture changed, by identity', () => {
    const movedB = { ...b, x: 250 };
    setLocalPreview('t', [a, movedB, c], doc);
    const o = localPreview()!;
    expect([...o.changed.keys()]).toEqual([b.id]);
    expect(o.changed.get(b.id)).toBe(movedB);
    expect(o.removed.size).toBe(0);
    expect(o.added).toEqual([]);
  });

  it('records what a gesture added after its neighbour, and what it removed', () => {
    const copy = { ...a, id: 'copy' };
    setLocalPreview('t', [a, copy, b], doc);
    const o = localPreview()!;
    expect(o.added).toEqual([{ el: copy, after: a.id }]);
    expect([...o.removed]).toEqual([c.id]);
  });

  it('is gone once cleared', () => {
    setLocalPreview('t', [a, { ...b, x: 9 }, c], doc);
    clearLocalPreview();
    expect(localPreview()).toBeNull();
  });
});

describe('applyOverlay', () => {
  it('replaces, drops and inserts, keeping the order', () => {
    const movedB = { ...b, x: 250 };
    const copy = { ...a, id: 'copy' };
    setLocalPreview('t', [copy, a, movedB], doc);
    const out = applyOverlay(doc, localPreview()!);
    expect(ids(out)).toEqual(['copy', a.id, b.id]);
    expect(out[2]).toBe(movedB);
  });

  it('keeps changes made beneath it, and skips an element deleted beneath it', () => {
    const movedB = { ...b, x: 250 };
    setLocalPreview('t', [a, movedB, c], doc);
    const peerMovedC = { ...c, y: 99 };
    expect(applyOverlay([a, peerMovedC], localPreview()!)).toEqual([a, peerMovedC]);
    expect(applyOverlay([a, b, peerMovedC], localPreview()!)).toEqual([a, movedB, peerMovedC]);
  });

  it('puts an addition whose neighbour is gone at the end', () => {
    const copy = { ...a, id: 'copy' };
    setLocalPreview('t', [a, copy, b, c], doc);
    expect(ids(applyOverlay([b, c], localPreview()!))).toEqual([b.id, c.id, 'copy']);
  });
});

describe('useDragPreview', () => {
  it('follows the local preview for its tab only', () => {
    const { result } = renderHook(() => useDragPreview('t', doc));
    expect(result.current).toBeNull();
    act(() => setLocalPreview('t', [a, { ...b, x: 1 }, c], doc));
    expect(result.current?.changed.has(b.id)).toBe(true);
    act(() => setLocalPreview('other', [a, { ...b, x: 2 }, c], doc));
    expect(result.current).toBeNull();
  });

  it('resolves peer patches against the elements drawn, beneath the local preview', () => {
    const { result } = renderHook(() => useDragPreview('t', doc));
    act(() =>
      setPeerPreview('p1', 't', [
        { id: b.id, x: 7 },
        { id: c.id, x: 8 },
        { id: 'gone', x: 1 },
      ]),
    );
    expect(result.current!.changed.get(c.id)).toEqual({ ...c, x: 8 });
    expect(result.current!.changed.has('gone')).toBe(false);
    const localB = { ...b, x: 9 };
    act(() => setLocalPreview('t', [a, localB, c], doc));
    expect(result.current!.changed.get(b.id)).toBe(localB);
    act(() => {
      clearLocalPreview();
      clearPeerPreview('p1');
    });
    expect(result.current).toBeNull();
  });

  it('ignores a peer preview for another tab', () => {
    const { result } = renderHook(() => useDragPreview('t', doc));
    act(() => setPeerPreview('p1', 'other', [{ id: b.id, x: 7 }]));
    expect(result.current).toBeNull();
  });

  it('keeps one merged object until something changes', () => {
    const { result, rerender } = renderHook(() => useDragPreview('t', doc));
    act(() => setLocalPreview('t', [a, { ...b, x: 1 }, c], doc));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('several readers', () => {
  it('gives each reader a stable preview, whatever elements each draws', () => {
    const other: Element[] = [a, b];
    const first = renderHook(() => useDragPreview('t', doc));
    const second = renderHook(() => useDragPreview('t', other));
    act(() => setPeerPreview('p1', 't', [{ id: b.id, x: 7 }]));
    const one = first.result.current;
    const two = second.result.current;
    first.rerender();
    second.rerender();
    expect(first.result.current).toBe(one);
    expect(second.result.current).toBe(two);
  });
});

// docs/specs/008-canvas/drag-preview.md "A dragged element keeps its look": the gesture works on the stored board,
// every reader draws the board as seen (here, a light theme's colours in the dark half).
describe('a dragged element keeps its look', () => {
  const LIGHT = { fillColor: '#e0e7ff', strokeColor: '#4338ca' };
  const DARK = { fillColor: '#2e3240', strokeColor: '#9eaafd' };
  const stored = { ...createShape('square', 0, 0), ...LIGHT } as Element;
  const drawn = { ...stored, ...DARK } as Element;
  const seen = (el: Element): Element =>
    (el as { fillColor?: string }).fillColor === LIGHT.fillColor ? { ...el, ...DARK } : el;

  it('hands every reader the moved element in its drawn colours, and keeps the stored ones to write', () => {
    const moved = { ...stored, x: 50 } as Element;
    setLocalPreview('t', [moved], [stored]);
    const board = [drawn];
    const o = dragPreviewFor('t', board)!;
    expect(o.changed.get(stored.id)).toEqual({ ...drawn, x: 50 });
    expect(localPreview()!.changed.get(stored.id)).toBe(moved);
    // The same object for the same board until the preview changes.
    expect(dragPreviewFor('t', board)).toBe(o);
  });

  it('keeps a colour the gesture set itself', () => {
    setLocalPreview('t', [{ ...stored, x: 5, fillColor: '#ff0000' } as Element], [stored]);
    expect(dragPreviewFor('t', [drawn])!.changed.get(stored.id)).toEqual({
      ...drawn,
      x: 5,
      fillColor: '#ff0000',
    });
  });

  it('draws an added element through the projection the reader gives', () => {
    const copy = { ...stored, id: 'copy' };
    setLocalPreview('t', [stored, copy], [stored]);
    expect(dragPreviewFor('t', [drawn], seen)!.added[0]!.el).toEqual({ ...copy, ...DARK });
    expect(dragPreviewFor('t', [drawn])!.added[0]!.el).toBe(copy);
  });

  it("lays ours, drawn, over a collaborator's", () => {
    const other = { ...createShape('square', 300, 0), ...LIGHT } as Element;
    const otherDrawn = { ...other, ...DARK } as Element;
    setPeerPreview('peer', 't', [{ id: other.id, x: 320 }]);
    setLocalPreview('t', [{ ...stored, x: 9 } as Element, other], [stored, other]);
    const o = dragPreviewFor('t', [drawn, otherDrawn])!;
    expect(o.changed.get(stored.id)).toEqual({ ...drawn, x: 9 });
    expect(o.changed.get(other.id)).toEqual({ ...otherDrawn, x: 320 });
  });
});
