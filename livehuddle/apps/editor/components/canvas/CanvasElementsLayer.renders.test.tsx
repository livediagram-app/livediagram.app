// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { memo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { storedPinnedArrow } from '@/test/retired-elements';

// docs/specs/008-canvas/canvas-performance.md: an element view renders only for its own changes. A
// Canvas render that changes no element, no selection and no zoom renders no element view; a zoom
// renders none (only the counter-scaled parts inside them, through the zoom context); a selection
// change renders the elements it touches; a move renders what moved and the stored arrows pinned to it.
//
// The views are replaced by counting stubs wrapped in the REAL memo comparison, so the counts are
// what production memo lets through. Runs without the React Compiler, so it holds whether or not the
// compiler memoises the parent.

const renders = {
  boxed: new Map<string, number>(),
  arrow: new Map<string, number>(),
};
const bump = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
const drawnAs = new Map<string, Element>();

vi.mock('./BoxedElementView', () => ({
  BoxedElementView: memo(function BoxedStub({ element }: { element: Element }) {
    bump(renders.boxed, element.id);
    drawnAs.set(element.id, element);
    // A mark where the view mounts, so a test can see where each boxed element is drawn.
    return <span data-boxed-stub={element.id} data-ride-id={element.id} />;
  }),
}));
// A stored arrow's view (RetiredArrowView), counted through its real memo comparison.
vi.mock('./RetiredArrowView', async (importOriginal) => {
  const real = await importOriginal<typeof import('./RetiredArrowView')>();
  return {
    ...real,
    RetiredArrowView: memo(function ArrowStub({
      arrow,
    }: Parameters<typeof real.retiredArrowViewPropsEqual>[0]) {
      bump(renders.arrow, arrow.id);
      return <svg data-retired-arrow={arrow.id} />;
    }, real.retiredArrowViewPropsEqual),
  };
});
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// Each element's slot in the list: its count shows whether a layer render walked the board.
const slotRenders = { count: 0 };
vi.mock('./PreviewedElement', async (importOriginal) => {
  const real = await importOriginal<typeof import('./PreviewedElement')>();
  return {
    PreviewedElement: (props: Parameters<typeof real.PreviewedElement>[0]) => {
      slotRenders.count += 1;
      return real.PreviewedElement(props);
    },
  };
});
// The grips layer is re-created on every layer render, so its count is the layer's.
const layerRenders = { count: 0 };
vi.mock('@/components/canvas/SelectionGripsLayer', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/canvas/SelectionGripsLayer')>();
  return {
    ...real,
    SelectionGripsLayer: (props: Parameters<typeof real.SelectionGripsLayer>[0]) => {
      layerRenders.count += 1;
      return real.SelectionGripsLayer(props);
    },
  };
});
import { clearLocalPreview, resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
import { buildLargeSelectionBoard } from '@/e2e/perf/large-selection-board';
import { createPeerMotion } from '@/lib/peer-motion';

const { CanvasElementsLayer } = await import('./CanvasElementsLayer');
const { createSelectionStore } = await import('@liveworkspace/workbench/lib/selection-store');
const { SelectionStoreProvider } =
  await import('@liveworkspace/workbench/hooks/canvas/useSelectionStore');
let store = createSelectionStore();

const a = createShape('square', 0, 0);
const b = createShape('square', 400, 0);
const c = createShape('square', 0, 400);
const ab = storedPinnedArrow('ab', a.id, 'e', b.id, 'w');
const BOARD: Element[] = [a, b, c, ab];

const STABLE = {
  chairSitters: () => [],
  selfParticipant: { id: 'me', name: 'Me', color: '#000000' },
  settings: {},
  peers: {
    motion: createPeerMotion(),
    livePresenceById: new Map(),
    selfId: 'me',
    activeId: 't1',
    tabFocus: new Map(),
  },
  remoteSelectionsByElement: new Map(),
  selectionInput: {
    elements: BOARD,
    editingId: null,
    isPaintMode: false,
    readOnly: false,
  },
};

// What one editor render hands the layer: the same data and every handler a fresh closure, as the
// editor mints them per render.
function layerProps(over: { elements?: Element[]; zoom?: number } = {}) {
  const fresh = () => vi.fn();
  return {
    ...STABLE,
    elements: over.elements ?? BOARD,
    activeTabId: 't',
    viewportZoom: over.zoom ?? 1,
    editingId: null,
    readOnly: false,
    isPaintMode: false,
    canvasTool: 'select',
    drawDrag: null,
    onOpenElementSettings: fresh(),
    onEnterPortal: fresh(),
    handleArrowSelect: fresh(),
    handleElementClick: fresh(),
    handleElementContextSelect: fresh(),
    onBeginDrag: fresh(),
    onBeginEdit: fresh(),
    onCommitLabel: fresh(),
    onCancelEdit: fresh(),
  } as unknown as Parameters<typeof CanvasElementsLayer>[0];
}

const counts = () => ({
  boxed: [...renders.boxed.values()].reduce((n, v) => n + v, 0),
  arrows: [...renders.arrow.values()].reduce((n, v) => n + v, 0),
});

function mount(first = layerProps()) {
  store = createSelectionStore();
  const view = render(<CanvasElementsLayer {...first} />, {
    wrapper: ({ children }) => (
      <SelectionStoreProvider store={store}>{children}</SelectionStoreProvider>
    ),
  });
  renders.boxed.clear();
  renders.arrow.clear();
  layerRenders.count = 0;
  slotRenders.count = 0;
  return view;
}

afterEach(() => {
  renders.boxed.clear();
  renders.arrow.clear();
});

describe('element views render only for their own changes', () => {
  it('renders no element view for an editor render that changes nothing they show', () => {
    const { rerender } = mount();
    rerender(<CanvasElementsLayer {...layerProps()} />);
    expect(counts()).toEqual({ boxed: 0, arrows: 0 });
  });

  // docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved": a press or a release
  // renders the editor (a drag begins or ends), and that must not walk the board's elements.
  it('walks no element slot for an editor render that changes nothing they show', () => {
    const { rerender } = mount();
    rerender(<CanvasElementsLayer {...layerProps()} />);
    rerender(<CanvasElementsLayer {...layerProps()} />);
    expect(slotRenders.count).toBe(0);
  });

  it('walks the element slots again when an element changes', () => {
    const { rerender } = mount();
    const moved = BOARD.map((el) => (el.id === c.id ? { ...el, x: 40 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: moved })} />);
    expect(slotRenders.count).toBe(BOARD.length);
  });

  it('renders no element view for a zoom', () => {
    const { rerender } = mount();
    rerender(<CanvasElementsLayer {...layerProps({ zoom: 2 })} />);
    expect(counts()).toEqual({ boxed: 0, arrows: 0 });
  });

  it('renders only the elements a selection change touches', () => {
    mount();
    act(() => store.setSelectedId(a.id));
    expect([...renders.boxed.keys()]).toEqual([a.id]);
    act(() => store.setSelectedId(b.id));
    expect([...renders.boxed.keys()].sort()).toEqual([a.id, b.id].sort());
    expect(counts().arrows).toBe(0);
  });

  it('does not render the layer itself for a selection change', () => {
    mount();
    act(() => store.setSelectedId(a.id));
    act(() => store.setMultiSelectedIds(new Set([a.id, b.id])));
    act(() => store.setSelection({ selectedId: null, multiSelectedIds: new Set() }));
    expect(layerRenders.count).toBe(0);
  });

  // Its card reads the selection itself (the boxed view inside it), so the arrow's own view stays put.
  it('renders no arrow view when the arrow itself is selected', () => {
    mount();
    act(() => store.setSelectedId(ab.id));
    expect(counts().arrows).toBe(0);
  });

  it('renders only the moved element among the boxed views', () => {
    const { rerender } = mount();
    const moved = BOARD.map((el) => (el.id === c.id ? { ...el, x: 40 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: moved })} />);
    expect([...renders.boxed.keys()]).toEqual([c.id]);
  });
});

describe('stored arrow views render only for their own changes', () => {
  it('renders the arrow on a moved element and no other', () => {
    const { rerender } = mount();
    const movedC = BOARD.map((el) => (el.id === c.id ? { ...el, x: 40 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: movedC })} />);
    expect(counts().arrows).toBe(0);
    const movedA = movedC.map((el) => (el.id === a.id ? { ...el, y: 40 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: movedA })} />);
    expect([...renders.arrow.keys()]).toEqual([ab.id]);
  });
});

// docs/specs/008-canvas/drag-preview.md: while a gesture lasts the layer draws from its preview, and
// redraws only what the preview changes.
describe('drawing a drag preview', () => {
  afterEach(() => resetDragPreviewForTests());

  it('draws a reshaped element where the preview has it, and redraws it and its arrow only', () => {
    mount();
    const movedA = { ...a, y: 40, width: 160 };
    act(() =>
      setLocalPreview(
        't',
        BOARD.map((el) => (el.id === a.id ? movedA : el)),
        BOARD,
      ),
    );
    expect([...renders.boxed.keys()]).toEqual([a.id]);
    expect(drawnAs.get(a.id)).toBe(movedA);
    expect([...renders.arrow.keys()]).toEqual([ab.id]);
  });

  // docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved": a preview frame renders
  // neither the layer nor any element it leaves alone.
  it('does not render the layer itself for a preview frame', () => {
    mount();
    for (const y of [10, 20, 30])
      act(() =>
        setLocalPreview(
          't',
          BOARD.map((el) => (el.id === a.id ? { ...a, y, width: 120 + y } : el)),
          BOARD,
        ),
      );
    expect(layerRenders.count).toBe(0);
    expect([...renders.boxed.keys()]).toEqual([a.id]);
    expect(renders.boxed.get(a.id)).toBe(3);
    expect((drawnAs.get(a.id) as { y: number } | undefined)?.y).toBe(30);
  });

  it('lists an element the preview adds, after its neighbour, and drops one it removes', () => {
    const { container } = mount();
    const copy = { ...c, id: 'copy-of-c', x: 80 };
    act(() =>
      setLocalPreview(
        't',
        [a, b, c, copy, ab].filter((el) => el.id !== b.id),
        BOARD,
      ),
    );
    expect(drawnAs.get(copy.id)).toBe(copy);
    expect(renders.boxed.has(b.id)).toBe(false);
    expect(container.querySelectorAll('[data-retired-arrow]').length).toBe(1);
    // The copy moving on renders it alone; the list holds.
    const before = layerRenders.count;
    const moved = { ...copy, x: 120 };
    act(() => setLocalPreview('t', [a, c, moved, ab], BOARD));
    expect(layerRenders.count).toBe(before);
    expect(drawnAs.get(copy.id)).toBe(moved);
  });

  it('ignores a preview for another tab', () => {
    mount();
    act(() =>
      setLocalPreview(
        'other',
        BOARD.map((el) => (el.id === a.id ? { ...a, y: 40 } : el)),
        BOARD,
      ),
    );
    expect(counts()).toEqual({ boxed: 0, arrows: 0 });
  });

  it('draws the document again once the preview ends', () => {
    mount();
    act(() =>
      setLocalPreview(
        't',
        BOARD.map((el) => (el.id === a.id ? { ...a, y: 40 } : el)),
        BOARD,
      ),
    );
    act(() => resetDragPreviewForTests());
    expect(drawnAs.get(a.id)).toBe(a);
  });
});

// docs/specs/008-canvas/drag-preview.md "Moves ride an offset": a move renders no element view; each moved node
// carries the offset, and only the stored arrows pinned to what moved redraw.
describe('a move riding an offset', () => {
  afterEach(() => resetDragPreviewForTests());

  const shifted = (els: readonly Element[], ids: ReadonlySet<string>, dx: number, dy: number) =>
    els.map((el) =>
      ids.has(el.id) && 'x' in el && 'y' in el ? { ...el, x: el.x + dx, y: el.y + dy } : el,
    );
  const translateOf = (root: ParentNode, id: string) =>
    [...root.querySelectorAll<HTMLElement | SVGElement>(`[data-ride-id="${id}"]`)].map(
      (n) => n.style.translate,
    );

  it('renders no moved element, shifts its nodes, and redraws the stored arrow pinned to it', () => {
    const { container } = mount();
    for (const k of [1, 2, 3])
      act(() => setLocalPreview('t', shifted(BOARD, new Set([a.id, c.id]), 10 * k, 5 * k), BOARD));
    expect(counts().boxed).toBe(0);
    expect(layerRenders.count).toBe(0);
    expect(translateOf(container, a.id)).toEqual(['30px 15px']);
    expect(translateOf(container, c.id)).toEqual(['30px 15px']);
    expect(translateOf(container, b.id)).toEqual(['']);
    // ab is pinned to a (moved): its end follows, frame by frame, worked out against the preview.
    expect([...renders.arrow.keys()]).toEqual([ab.id]);
    expect(renders.arrow.get(ab.id)).toBe(3);
  });

  it('leaves a stored arrow alone when what moves is not what it is pinned to', () => {
    mount();
    act(() => setLocalPreview('t', shifted(BOARD, new Set([c.id]), 7, 0), BOARD));
    expect(counts()).toEqual({ boxed: 0, arrows: 0 });
  });

  it('drops the offsets in the paint the released board is drawn in', () => {
    const { container, rerender } = mount();
    const next = shifted(BOARD, new Set([a.id]), 12, 0);
    act(() => setLocalPreview('t', next, BOARD));
    expect(translateOf(container, a.id)).toEqual(['12px 0px']);
    act(() => {
      clearLocalPreview('landed');
      rerender(<CanvasElementsLayer {...layerProps({ elements: next })} />);
    });
    expect(translateOf(container, a.id)).toEqual(['']);
    expect(drawnAs.get(a.id)).toBe(next[0]);
  });

  it('drops the offsets by the next frame when a cancel writes nothing', async () => {
    const { container } = mount();
    act(() => setLocalPreview('t', shifted(BOARD, new Set([a.id]), 12, 0), BOARD));
    act(() => clearLocalPreview('cancelled'));
    // Held until the next frame, so a release's write lands in the same paint.
    expect(translateOf(container, a.id)).toEqual(['12px 0px']);
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(translateOf(container, a.id)).toEqual(['']);
  });

  // docs/specs/008-canvas/drag-preview.md "A very large move rides as one layer": the element plane carries it,
  // and no element node is written.
  it('renders no element view for a whole 1,770-element selection moving, and its layer carries it', () => {
    const large = buildLargeSelectionBoard();
    const all = new Set(large.map((el) => el.id));
    const { container } = mount(layerProps({ elements: large }));
    for (const k of [1, 2, 3, 4, 5])
      act(() => setLocalPreview('t', shifted(large, all, 4 * k, 2 * k), large));
    expect(counts()).toEqual({ boxed: 0, arrows: 0 });
    expect(slotRenders.count).toBe(0);
    expect(layerRenders.count).toBe(0);
    const plane = container.querySelector<HTMLElement>('[data-element-plane]')!;
    expect(plane.style.transform).toBe('translate(20px, 10px)');
    expect(translateOf(container, large[0]!.id)).toEqual(['']);
    expect(translateOf(container, large.at(-1)!.id)).toEqual(['']);
  });
});

// docs/specs/008-canvas/canvas-performance.md "The canvas's cursor stays off the elements": every
// element sits in the plane that stops the canvas's cursor (globals.css [data-element-plane]).
describe('the element plane', () => {
  it('holds every element, and nothing else the layer draws', () => {
    const { container } = mount();
    const plane = container.querySelector('[data-element-plane]');
    expect(plane).not.toBeNull();
    expect(plane!.className).toBe('contents');
    // Every element: the three boxed ones and the stored arrow, none of them outside it.
    expect(plane!.querySelectorAll('[data-boxed-stub]').length).toBe(3);
    expect(container.querySelectorAll('[data-boxed-stub]').length).toBe(3);
    expect(plane!.querySelectorAll('[data-retired-arrow]').length).toBe(1);
    expect(container.querySelectorAll('[data-element-plane]').length).toBe(1);
    expect(plane!.querySelector('[data-selection-grips]')).toBeNull();
  });
});
