import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createElementGridTracker,
  createPinnedArrow,
  createShape,
  type Element,
} from '@livedesign/document';
import { applyOverlay, resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
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
    },
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

  it('places chained and leading adds as applyOverlay does, so drawn and selected order agree', () => {
    const one = { ...c, id: 'one' };
    const two = { ...c, id: 'two' };
    const first = { ...c, id: 'first' };
    const overlay = {
      tabId: 't',
      changed: new Map(),
      removed: new Set<string>(),
      added: [
        { el: first, after: null },
        { el: one, after: a.id },
        { el: two, after: 'one' },
      ],
    };
    const shown = shownWithOverlay(ordered, overlay).map((o) => o.element.id);
    expect(shown).toEqual(applyOverlay(BOARD, overlay).map((el) => el.id));
    expect(shown).toEqual(['first', a.id, 'one', 'two', b.id, c.id, ab.id]);
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

  it('derives nothing again for a fresh inputs object holding the same fields', () => {
    const store = createLayerPreviewStore();
    const told = vi.fn();
    store.subscribe(a.id, told);
    store.subscribe(ab.id, told);
    const base = inputs();
    setLocalPreview('t', [{ ...a, y: 1 }, b, c, ab], BOARD);
    store.update(base);
    told.mockClear();
    // The layer re-renders (a peer's cursor): a new object, a new gridFor closure, the same fields.
    store.update({ ...base, gridFor: (els) => tracker.gridFor(els) });
    expect(told).not.toHaveBeenCalled();
  });

  it('tells no one when the preview is rebuilt the same, as a peer’s is each frame', () => {
    const store = createLayerPreviewStore();
    const told = { a: vi.fn(), ab: vi.fn() };
    store.subscribe(a.id, told.a);
    store.subscribe(ab.id, told.ab);
    setLocalPreview('t', [{ ...a, y: 1 }, b, c, ab], BOARD);
    store.update(inputs());
    const kept = store.entryOf(a.id);
    told.a.mockClear();
    told.ab.mockClear();
    setLocalPreview('t', [{ ...a, y: 1 }, b, c, ab], BOARD);
    store.update(inputs());
    expect(told.a).not.toHaveBeenCalled();
    expect(told.ab).not.toHaveBeenCalled();
    expect(store.entryOf(a.id)).toBe(kept);
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

describe('a previewed arrow with a label', () => {
  it('lays its label out against the board as the preview shows it, keeping the others it cuts', () => {
    const labelled = { ...ab, label: 'Yes' } as Element;
    const board = [a, b, c, labelled];
    const kept = { x: 0, y: 0, width: 1, height: 1 };
    const own = { x: 5, y: 5, width: 2, height: 2 };
    const placed = { x: 9, y: 9, width: 3, height: 3 };
    const draftLayout = vi.fn(() => ({ knockout: placed }));
    const store = createLayerPreviewStore();
    const movedA = { ...a, y: 40 };
    setLocalPreview('t', [movedA, b, c, labelled], board);
    store.update(
      inputs({
        ordered: board.map((element) => ({ element, layerOpacity: 1 })),
        drawnElements: board,
        elementIndex: new Map(board.map((el) => [el.id, el])),
        arrowLinks: buildArrowLinks(board),
        arrowLabels: {
          renderOf: () => ({ layout: { knockout: own }, knockouts: [kept, own] }),
          labelRectOf: () => null,
          draftLayout,
        } as unknown as LayerPreviewInputs['arrowLabels'],
      }),
    );
    expect(draftLayout).toHaveBeenCalledWith(labelled, 'Yes', [movedA, b, c, labelled]);
    expect(store.entryOf(ab.id)?.label?.knockouts).toEqual([kept, placed]);
  });
});
