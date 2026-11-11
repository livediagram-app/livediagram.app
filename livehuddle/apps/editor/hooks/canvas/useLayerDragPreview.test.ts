import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSticky, retiredArrowEnds, type Element } from '@livehuddle/document';
import { applyOverlay, resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
import { buildRetiredArrowLinks } from '@/components/canvas/retired-arrow-links';
import { storedPinnedArrow } from '@/test/retired-elements';
import {
  createLayerPreviewStore,
  shownWithOverlay,
  type LayerPreviewInputs,
} from './useLayerDragPreview';

// docs/specs/008-canvas/drag-preview.md "The preview": each element reads its own part of the preview,
// and only the elements whose part changed are told.

const a = createSticky(0, 0);
const b = createSticky(400, 0);
const c = createSticky(0, 400);
// A stored arrow, retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4).
const ab = storedPinnedArrow('ab', a.id, 'e', b.id, 'w');
const BOARD: Element[] = [a, b, c, ab];
const ordered = BOARD.map((element) => ({ element, layerOpacity: 1 }));

function inputs(over: Partial<LayerPreviewInputs> = {}): LayerPreviewInputs {
  return {
    tabId: 't',
    ordered,
    drawnElements: BOARD,
    elementIndex: new Map(BOARD.map((el) => [el.id, el])),
    arrowLinks: buildRetiredArrowLinks(BOARD),
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
  it('tells only the reshaped element and the stored arrow pinned to it, and draws them from the preview', () => {
    const store = createLayerPreviewStore();
    const told = { a: vi.fn(), b: vi.fn(), c: vi.fn(), ab: vi.fn() };
    store.subscribe(a.id, told.a);
    store.subscribe(b.id, told.b);
    store.subscribe(c.id, told.c);
    store.subscribe(ab.id, told.ab);
    // A reshape, not a move: a move rides an offset instead (below).
    const movedA = { ...a, y: 40, width: 160 };
    setLocalPreview('t', [movedA, b, c, ab], BOARD);
    store.update(inputs());
    expect(told.a).toHaveBeenCalledTimes(1);
    expect(told.ab).toHaveBeenCalledTimes(1);
    expect(told.b).not.toHaveBeenCalled();
    expect(told.c).not.toHaveBeenCalled();
    expect(store.entryOf(a.id)?.element).toBe(movedA);
    // The arrow's ends worked out against the board as the preview has it: the pinned end follows.
    expect(store.entryOf(ab.id)?.ends).toEqual(retiredArrowEnds(ab as never, [movedA, b, c, ab]));
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
    setLocalPreview('t', [{ ...a, width: 121 }, b, c, ab], BOARD);
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
    setLocalPreview('t', [{ ...a, width: 121 }, b, c, ab], BOARD);
    store.update(base);
    told.mockClear();
    // The layer re-renders (a peer's cursor): a new object, the same fields.
    store.update({ ...base });
    expect(told).not.toHaveBeenCalled();
  });

  it('tells no one when the preview is rebuilt the same, as a peer’s is each frame', () => {
    const store = createLayerPreviewStore();
    const told = { a: vi.fn(), ab: vi.fn() };
    store.subscribe(a.id, told.a);
    store.subscribe(ab.id, told.ab);
    setLocalPreview('t', [{ ...a, width: 121 }, b, c, ab], BOARD);
    store.update(inputs());
    const kept = store.entryOf(a.id);
    told.a.mockClear();
    told.ab.mockClear();
    setLocalPreview('t', [{ ...a, width: 121 }, b, c, ab], BOARD);
    store.update(inputs());
    expect(told.a).not.toHaveBeenCalled();
    expect(told.ab).not.toHaveBeenCalled();
    expect(store.entryOf(a.id)).toBe(kept);
  });

  it('tells an element again when the preview ends, so it draws from the document', () => {
    const store = createLayerPreviewStore();
    const told = vi.fn();
    store.subscribe(a.id, told);
    setLocalPreview('t', [{ ...a, width: 121 }, b, c, ab], BOARD);
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

  it('draws no arrow ends when the board holds no links', () => {
    const store = createLayerPreviewStore();
    setLocalPreview('t', [{ ...a, width: 121 }, b, c, ab], BOARD);
    store.update(inputs({ arrowLinks: null }));
    expect(store.entryOf(ab.id)).toBeUndefined();
    expect((store.entryOf(a.id)?.element as { width: number } | undefined)?.width).toBe(121);
  });

  it('rides a move on a board without arrows', () => {
    const store = createLayerPreviewStore();
    setLocalPreview('t', [{ ...a, x: 30 }, { ...c, x: 30 }, b], [a, b, c]);
    store.update(
      inputs({
        drawnElements: [a, b, c],
        elementIndex: new Map([a, b, c].map((el) => [el.id, el])),
        arrowLinks: null,
      }),
    );
    expect(store.entryOf(a.id)).toBeUndefined();
    expect(store.entryOf(c.id)).toBeUndefined();
  });

  it('keeps moved elements out of its entries (they ride), and draws the stored arrow on them from its ends', () => {
    const store = createLayerPreviewStore();
    const told = { a: vi.fn(), ab: vi.fn() };
    store.subscribe(a.id, told.a);
    store.subscribe(ab.id, told.ab);
    setLocalPreview('t', [{ ...a, y: 9 }, { ...b, y: 9 }, c, ab], BOARD);
    store.update(inputs());
    expect(store.entryOf(a.id)).toBeUndefined();
    expect(store.entryOf(b.id)).toBeUndefined();
    expect(told.a).not.toHaveBeenCalled();
    // A stored arrow never rides: its ends follow the boxes it is pinned to.
    expect(store.entryOf(ab.id)?.ends?.from.y).toBe(
      retiredArrowEnds(ab as never, BOARD).from.y + 9,
    );
    expect(told.ab).toHaveBeenCalledTimes(1);
  });

  // docs/specs/002-project-scope/blueprints/element-engine.md D23: nothing throws when what a stored arrow is
  // pinned to goes; its loose end takes its other end's point (retiredArrowEnds).
  it('draws a stored arrow whose pinned box the preview removes, at its other end', () => {
    const store = createLayerPreviewStore();
    setLocalPreview('t', [b, c, ab], BOARD);
    expect(() => store.update(inputs())).not.toThrow();
    const ends = store.entryOf(ab.id)?.ends;
    expect(ends).toBeDefined();
    expect(ends!.from).toEqual(ends!.to);
  });

  it('stops telling an element once it unsubscribes', () => {
    const store = createLayerPreviewStore();
    const told = vi.fn();
    const off = store.subscribe(a.id, told);
    off();
    setLocalPreview('t', [{ ...a, width: 121 }, b, c, ab], BOARD);
    store.update(inputs());
    expect(told).not.toHaveBeenCalled();
  });
});
