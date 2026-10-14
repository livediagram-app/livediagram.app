import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createElementGridTracker,
  createPinnedArrow,
  createShape,
  type Element,
} from '@livediagram/document';
import { resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
import { buildArrowLinks } from '@/components/canvas/drag-affected-arrows';
import {
  createLayerPreviewStore,
  shownWithOverlay,
  type LayerPreviewInputs,
} from './useLayerDragPreview';

// docs/specs/008-canvas/drag-preview.md "The preview": each element reads its own part of the preview,
// and only the elements whose part changed are told.

const a = createShape('square', 0, 0);
const b = createShape('square', 400, 0);
const c = createShape('square', 0, 400);
const ab = createPinnedArrow(a.id, 'e', b.id, 'w');
const BOARD: Element[] = [a, b, c, ab];
const ordered = BOARD.map((element) => ({ element, layerOpacity: 1 }));
const NONE = { layout: null, knockouts: [] };
const tracker = createElementGridTracker();

function inputs(over: Partial<LayerPreviewInputs> = {}): LayerPreviewInputs {
  return {
    tabId: 't',
    ordered,
    drawnElements: BOARD,
    elementIndex: new Map(BOARD.map((el) => [el.id, el])),
    arrowLinks: buildArrowLinks(BOARD),
    gridFor: (els) => tracker.gridFor(els),
    arrowLabels: {
      renderOf: () => NONE,
      labelRectOf: () => null,
      draftLayout: () => null,
    } as unknown as LayerPreviewInputs['arrowLabels'],
    tabFinish: undefined,
    ...over,
  };
}

afterEach(() => resetDragPreviewForTests());

describe('shownWithOverlay', () => {
  it('swaps changed elements, drops removed ones and puts added ones after their neighbour', () => {
    const movedA = { ...a, x: 9 };
    const copy = { ...c, id: 'copy' };
    const orphan = { ...c, id: 'orphan' };
    const shown = shownWithOverlay(ordered, {
      changed: new Map([[a.id, movedA]]),
      removed: new Set([b.id]),
      added: [
        { el: copy, after: c.id },
        { el: orphan, after: 'gone' },
      ],
    });
    expect(shown.map((o) => o.element)).toEqual([movedA, c, copy, ab, orphan]);
  });

  it('keeps the listed elements when the preview only adds and removes', () => {
    const shown = shownWithOverlay(ordered, { removed: new Set(), added: [] });
    expect(shown.map((o) => o.element)).toEqual(BOARD);
  });
});

describe('the layer preview store', () => {
  it('tells only the moved element and the arrows on it, and draws them from the preview', () => {
    const store = createLayerPreviewStore();
    const told = { a: vi.fn(), b: vi.fn(), c: vi.fn(), ab: vi.fn() };
    store.subscribe(a.id, told.a);
    store.subscribe(b.id, told.b);
    store.subscribe(c.id, told.c);
    store.subscribe(ab.id, told.ab);
    const movedA = { ...a, y: 40 };
    setLocalPreview('t', [movedA, b, c, ab], BOARD);
    store.update(inputs());
    expect(told.a).toHaveBeenCalledTimes(1);
    expect(told.ab).toHaveBeenCalledTimes(1);
    expect(told.b).not.toHaveBeenCalled();
    expect(told.c).not.toHaveBeenCalled();
    expect(store.entryOf(a.id)?.element).toBe(movedA);
    expect(store.entryOf(ab.id)?.geometry).toBeDefined();
    expect(store.entryOf(c.id)).toBeUndefined();
    expect(store.structure()).toBeNull();
  });

  it('does nothing for the same preview over the same inputs, or with no preview', () => {
    const store = createLayerPreviewStore();
    const told = vi.fn();
    store.subscribe(a.id, told);
    const same = inputs();
    store.update(same);
    expect(told).not.toHaveBeenCalled();
    setLocalPreview('t', [{ ...a, y: 1 }, b, c, ab], BOARD);
    store.update(same);
    store.update(same);
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('tells an element again when the preview ends, so it draws from the document', () => {
    const store = createLayerPreviewStore();
    const told = vi.fn();
    store.subscribe(a.id, told);
    setLocalPreview('t', [{ ...a, y: 1 }, b, c, ab], BOARD);
    store.update(inputs());
    resetDragPreviewForTests();
    store.update(inputs());
    expect(told).toHaveBeenCalledTimes(2);
    expect(store.entryOf(a.id)).toBeUndefined();
  });

  it('changes its structure only when the preview adds or removes something new', () => {
    const store = createLayerPreviewStore();
    const told = vi.fn();
    store.subscribeStructure(told);
    const copy = { ...c, id: 'copy' };
    setLocalPreview('t', [...BOARD, copy], BOARD);
    store.update(inputs());
    const first = store.structure();
    expect(first?.added.map((x) => x.el.id)).toEqual(['copy']);
    setLocalPreview('t', [...BOARD, { ...copy, x: 50 }], BOARD);
    store.update(inputs());
    expect(store.structure()).toBe(first);
    expect(told).toHaveBeenCalledTimes(1);
    expect((store.entryOf('copy')?.element as { x: number } | undefined)?.x).toBe(50);
  });

  it('draws no arrow geometry on a board without arrows', () => {
    const store = createLayerPreviewStore();
    setLocalPreview('t', [{ ...a, y: 1 }, b, c, ab], BOARD);
    store.update(inputs({ elementIndex: null, arrowLinks: null }));
    expect(store.entryOf(ab.id)).toBeUndefined();
    expect((store.entryOf(a.id)?.element as { y: number } | undefined)?.y).toBe(1);
  });

  it('stops telling an element once it unsubscribes', () => {
    const store = createLayerPreviewStore();
    const told = vi.fn();
    const off = store.subscribe(a.id, told);
    off();
    setLocalPreview('t', [{ ...a, y: 1 }, b, c, ab], BOARD);
    store.update(inputs());
    expect(told).not.toHaveBeenCalled();
  });
});
