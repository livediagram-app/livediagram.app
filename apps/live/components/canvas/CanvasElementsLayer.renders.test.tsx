// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { memo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinnedArrow, createShape, type Element } from '@livediagram/document';

// docs/specs/008-canvas/canvas-performance.md: an element view renders only for its own changes. A
// Canvas render that changes no element, no selection and no zoom renders no element view; a zoom
// renders none (only the counter-scaled parts inside them, through the zoom context); a selection
// change renders the elements it touches; a move renders what moved and the arrows on it.
//
// The views are replaced by counting stubs wrapped in the REAL memo comparison, so the counts are
// what production memo lets through. Runs without the React Compiler, so it holds whether or not the
// compiler memoises the parent.

const renders = {
  boxed: new Map<string, number>(),
  arrow: new Map<string, number>(),
  frame: new Map<string, number>(),
};
const bump = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
const drawnAs = new Map<string, Element>();

vi.mock('./BoxedElementView', () => ({
  BoxedElementView: memo(function BoxedStub({ element }: { element: Element }) {
    bump(renders.boxed, element.id);
    drawnAs.set(element.id, element);
    return null;
  }),
}));
vi.mock('./ArrowView', async (importOriginal) => {
  const real = await importOriginal<typeof import('./ArrowView')>();
  return {
    ...real,
    ArrowView: memo(function ArrowStub({ arrow }: Parameters<typeof real.arrowViewPropsEqual>[0]) {
      bump(renders.arrow, arrow.id);
      return null;
    }, real.arrowViewPropsEqual),
  };
});
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// Each arrow's free-arrow frame slot, counted through its real memo comparison.
vi.mock('./selection-aware-views', async (importOriginal) => {
  const real = await importOriginal<typeof import('./selection-aware-views')>();
  type FrameProps = Parameters<typeof real.FreeArrowFrame>[0];
  return {
    ...real,
    FreeArrowFrame: memo(function FrameStub(props: FrameProps) {
      bump(renders.frame, props.arrow.id);
      return null;
    }),
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
import { resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';

const { CanvasElementsLayer } = await import('./CanvasElementsLayer');
const { createSelectionStore } = await import('@/lib/selection-store');
const { SelectionStoreProvider } = await import('@/hooks/canvas/useSelectionStore');
let store = createSelectionStore();

const a = createShape('square', 0, 0);
const b = createShape('square', 400, 0);
const c = createShape('square', 0, 400);
const ab = createPinnedArrow(a.id, 'e', b.id, 'w');
const BOARD: Element[] = [a, b, c, ab];

const NONE = { layout: null, knockouts: [] };
const STABLE = {
  arrowLabels: { renderOf: () => NONE, labelRectOf: () => null, draftLayout: () => null },
  collab: { selfKey: 'me', participants: [] },
  chairSitters: () => [],
  selfParticipant: { id: 'me', name: 'Me', color: '#000000' },
  settings: {},
  remoteCursors: [],
  remoteSelectionsByElement: new Map(),
  laserTrails: [],
  selectionInput: {
    elements: BOARD,
    editingId: null,
    isPaintMode: false,
    tabLocked: false,
    readOnly: false,
  },
};

// What one editor render hands the layer: the same data, every handler a fresh closure, the panel
// action bags fresh objects, as the editor mints them per render.
function layerProps(over: { elements?: Element[]; zoom?: number } = {}) {
  const fresh = () => vi.fn();
  return {
    ...STABLE,
    elements: over.elements ?? BOARD,
    activeTabId: 't',
    viewportZoom: over.zoom ?? 1,
    editingId: null,
    hasArrows: true,
    readOnly: false,
    tabLocked: false,
    isPaintMode: false,
    canvasTool: 'select',
    drawDrag: null,
    quickRingOpen: null,
    setQuickRingOpen: fresh(),
    commentSelfId: 'me',
    commentPanelActions: { add: fresh(), remove: fresh(), resolve: fresh(), unresolve: fresh() },
    actionSelfId: 'me',
    actionPanelActions: { configure: fresh(), complete: fresh(), reopen: fresh() },
    onPauseTimer: fresh(),
    onResumeTimer: fresh(),
    onResetTimer: fresh(),
    onClearTimer: fresh(),
    onSetTimerDuration: fresh(),
    onSetSessionConfig: fresh(),
    onOpenElementSettings: fresh(),
    onEnterPortal: fresh(),
    onFireReaction: fresh(),
    onReactionBurstDone: fresh(),
    handleArrowSelect: fresh(),
    handleElementClick: fresh(),
    handleElementContextSelect: fresh(),
    onBeginDrag: fresh(),
    onBeginEdit: fresh(),
    onCommitLabel: fresh(),
    onCancelEdit: fresh(),
    onBeginEndpointDrag: fresh(),
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
  renders.frame.clear();
  layerRenders.count = 0;
  return view;
}

afterEach(() => {
  renders.boxed.clear();
  renders.arrow.clear();
  renders.frame.clear();
});

describe('element views render only for their own changes', () => {
  it('renders no element view for an editor render that changes nothing they show', () => {
    const { rerender } = mount();
    rerender(<CanvasElementsLayer {...layerProps()} />);
    expect(counts()).toEqual({ boxed: 0, arrows: 0 });
  });

  it('renders no element view, and no arrow frame slot, for a zoom', () => {
    const { rerender } = mount();
    rerender(<CanvasElementsLayer {...layerProps({ zoom: 2 })} />);
    expect(counts()).toEqual({ boxed: 0, arrows: 0 });
    expect(renders.frame.size).toBe(0);
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

  it('renders an arrow view when the arrow itself is selected', () => {
    mount();
    act(() => store.setSelectedId(ab.id));
    expect([...renders.arrow.keys()]).toEqual([ab.id]);
  });

  it('renders only the moved element among the boxed views', () => {
    const { rerender } = mount();
    const moved = BOARD.map((el) => (el.id === c.id ? { ...el, x: 40 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: moved })} />);
    expect([...renders.boxed.keys()]).toEqual([c.id]);
  });
});

describe('arrow views render only for their own changes', () => {
  it('renders the arrow on a moved element and no other', () => {
    const { rerender } = mount();
    const movedC = BOARD.map((el) => (el.id === c.id ? { ...el, x: 40 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: movedC })} />);
    expect(counts().arrows).toBe(0);
    const movedA = movedC.map((el) => (el.id === a.id ? { ...el, y: 40 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: movedA })} />);
    expect([...renders.arrow.keys()]).toEqual([ab.id]);
  });

  it('renders an arrow when a box moves into its path', () => {
    const { rerender } = mount();
    // c slides up between a and b, across the arrow: the arrow now breaks around it.
    const across = BOARD.map((el) => (el.id === c.id ? { ...el, x: 200, y: 0 } : el));
    rerender(<CanvasElementsLayer {...layerProps({ elements: across })} />);
    expect([...renders.arrow.keys()]).toEqual([ab.id]);
  });
});

// docs/specs/008-canvas/drag-preview.md: while a gesture lasts the layer draws from its preview, and
// redraws only what the preview changes.
describe('drawing a drag preview', () => {
  afterEach(() => resetDragPreviewForTests());

  it('draws the moved element where the preview has it, and redraws it and its arrow only', () => {
    mount();
    const movedA = { ...a, y: 40 };
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
