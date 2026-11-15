// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createElementGridTracker, createShape, type Element } from '@livediagram/document';
import { clearPeerPreview, resetDragPreviewForTests, setPeerPreview } from '@/lib/drag-preview';
import { buildArrowLinks } from '@/components/canvas/drag-affected-arrows';
import {
  LIVE_SIDE_FACES_MAX,
  createLayerPreviewStore,
  type LayerPreviewInputs,
  type LayerPreviewStore,
} from '@/hooks/canvas/useLayerDragPreview';
import { IsometricDepthLayer } from './IsometricDepthLayer';

// docs/specs/008-canvas/drag-preview.md "An element's isometric side faces ride with it": a collaborator viewing in
// Isometric sees each raised element's side faces move with its top while a peer drags, for a move of a few dozen
// elements (each rides its own offset) and a whole-board one (its layer carries one offset), and both go on release.

const NONE = { layout: null, knockouts: [] };
const tracker = createElementGridTracker();

function boardOf(n: number): Element[] {
  return Array.from({ length: n }, (_, i) =>
    createShape('square', (i % 40) * 140, Math.floor(i / 40) * 100),
  );
}

function inputsFor(board: readonly Element[]): LayerPreviewInputs {
  return {
    tabId: 't',
    ordered: board.map((element) => ({ element, layerOpacity: 1 })),
    drawnElements: board,
    elementIndex: new Map(board.map((el) => [el.id, el])),
    arrowLinks: buildArrowLinks(board),
    gridFor: (els) => tracker.gridFor(els),
    arrowLabels: { renderOf: () => NONE, labelRectOf: () => null, draftLayout: () => null },
    tabFinish: undefined,
    stackedIds: new Set(),
  };
}

// The canvas world as the page lays it out (CanvasWorldLayer): the depth layer and the element plane side by side
// under one parent, which is where the element layer's preview store writes the offsets.
// `depth: false` leaves the depth layer out until `mountDepth`, as when the view switches to Isometric mid-gesture.
function scene(board: readonly Element[], { depth = true }: { depth?: boolean } = {}) {
  const store = createLayerPreviewStore();
  const world = (withDepth: boolean, preview: LayerPreviewStore) => (
    <div data-iso="">
      {withDepth ? <IsometricDepthLayer elements={[...board]} preview={preview} /> : null}
      <div data-element-plane="" data-ride-plane="" className="absolute inset-0">
        {board.map((el) => (
          <div key={el.id} data-element-id={el.id} data-ride-id={el.id} />
        ))}
      </div>
    </div>
  );
  const view = render(world(depth, store));
  store.attachPlane(view.container.querySelector<HTMLElement>('[data-element-plane]'));
  const top = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!;
  const column = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-iso-column][data-ride-id="${id}"]`)!;
  const plane = (sel: string) => view.container.querySelector<HTMLElement>(sel)!;
  return {
    store,
    mountDepth: () => view.rerender(world(true, store)),
    top,
    column,
    depth: () => plane('[data-iso-depth]'),
    elements: () => plane('[data-element-plane]'),
  };
}

afterEach(() => resetDragPreviewForTests());

describe('isometric side faces during a peer drag', () => {
  it('shifts each column with its element for a 62-element drag, and puts it back on release', () => {
    const board = boardOf(62);
    const s = scene(board);
    const inputs = inputsFor(board);
    for (const dx of [10, 25, 60]) {
      setPeerPreview(
        'peer',
        't',
        board.map((el) => ({
          id: el.id,
          x: (el as { x: number }).x + dx,
          y: (el as { y: number }).y + 4,
        })),
      );
      s.store.update(inputs);
      for (const el of board) {
        expect(s.top(el.id).style.translate).toBe(`${dx}px 4px var(--ride-z, 0px)`);
        expect(s.column(el.id).style.translate).toBe(s.top(el.id).style.translate);
      }
    }
    // Below a plane's threshold nothing carries: each column holds its own offset.
    expect(s.depth().style.transform).toBe('');
    // The release: the peer's real change draws the board at its new place, and the offsets go in that render.
    clearPeerPreview('peer');
    const landed = board.map((el) => ({ ...el, x: (el as { x: number }).x + 60 }) as Element);
    s.store.update(inputsFor(landed));
    for (const el of board) expect(s.column(el.id).style.translate).toBe('');
  });

  it('carries a 1,200-element ride on the depth layer as one transform, like the element layer', () => {
    const board = boardOf(1200);
    const s = scene(board);
    const inputs = inputsFor(board);
    const ids = board.map((el) => el.id);
    setPeerPreview('peer', 't', [], { dx: 30, dy: -12, ids });
    s.store.update(inputs);
    expect(s.depth().style.transform).toBe('translate(30px, -12px)');
    expect(s.depth().style.transform).toBe(s.elements().style.transform);
    // Every column shares the layer's offset, so none is written on its own.
    const columns = [...s.depth().children] as HTMLElement[];
    expect(columns).toHaveLength(1200);
    expect(columns.filter((c) => c.style.translate !== '')).toEqual([]);
    setPeerPreview('peer', 't', [], { dx: 45, dy: -12 });
    s.store.update(inputs);
    expect(s.depth().style.transform).toBe('translate(45px, -12px)');
    clearPeerPreview('peer');
    s.store.update(inputsFor(board.map((el) => ({ ...el }))));
    expect(s.depth().style.transform).toBe('');
  });

  it('keeps a whole-board frame within budget with the side faces riding too', () => {
    const board = boardOf(1200);
    const s = scene(board);
    const inputs = inputsFor(board);
    const ids = board.map((el) => el.id);
    setPeerPreview('peer', 't', [], { dx: 1, dy: 0, ids });
    s.store.update(inputs);
    let dx = 1;
    const frame = () => {
      dx += 1;
      setPeerPreview('peer', 't', [], { dx, dy: 0 });
      s.store.update(inputs);
    };
    let best = Infinity;
    for (let i = 0; i < 5; i++) best = Math.min(best, cpuMsOf(frame));
    expect(s.depth().style.transform).toBe(`translate(${dx}px)`);
    expect(best).toBeLessThan(cpuBudgetMs(16));
  });
});

describe('isometric side faces during a peer resize', () => {
  const resizeAll = (board: readonly Element[], grow: number) =>
    board.map((el) => {
      const b = el as { x: number; y: number; width: number; height: number };
      return { id: el.id, x: b.x, y: b.y, width: b.width + grow, height: b.height + grow };
    });

  it('grows each column with its element mid-gesture for a small selection, and draws it as stored on release', () => {
    const board = boardOf(80);
    const resized = board.slice(0, 3);
    const s = scene(board);
    const inputs = inputsFor(board);
    const stored = (resized[0] as { width: number }).width;
    for (const grow of [10, 40]) {
      setPeerPreview('peer', 't', resizeAll(resized, grow));
      act(() => s.store.update(inputs));
      for (const el of resized) expect(s.column(el.id).style.width).toBe(`${stored + grow}px`);
    }
    // An element the resize leaves alone keeps its column.
    expect(s.column(board[10]!.id).style.width).toBe(`${stored}px`);
    // The release: the preview goes and the column draws from the document again.
    clearPeerPreview('peer');
    act(() => s.store.update(inputs));
    expect(s.column(resized[0]!.id).style.width).toBe(`${stored}px`);
  });

  it(`leaves the columns as stored past ${LIVE_SIDE_FACES_MAX} resized elements, and follows again below it`, () => {
    const board = boardOf(LIVE_SIDE_FACES_MAX + 20);
    const s = scene(board);
    const inputs = inputsFor(board);
    const stored = (board[0] as { width: number }).width;
    setPeerPreview('peer', 't', resizeAll(board.slice(0, LIVE_SIDE_FACES_MAX + 1), 30));
    act(() => s.store.update(inputs));
    expect(s.column(board[0]!.id).style.width).toBe(`${stored}px`);
    // Back under the cap mid-gesture (another collaborator's resize ends): the columns still resized follow.
    setPeerPreview('peer', 't', resizeAll(board.slice(0, LIVE_SIDE_FACES_MAX), 30));
    act(() => s.store.update(inputs));
    expect(s.column(board[0]!.id).style.width).toBe(`${stored + 30}px`);
    expect(s.column(board[LIVE_SIDE_FACES_MAX]!.id).style.width).toBe(`${stored}px`);
  });

  it(`keeps a frame of a ${LIVE_SIDE_FACES_MAX}-element resize within budget`, () => {
    const board = boardOf(1200);
    const s = scene(board);
    const inputs = inputsFor(board);
    const resized = board.slice(0, LIVE_SIDE_FACES_MAX);
    let grow = 0;
    const frame = () => {
      grow += 2;
      setPeerPreview('peer', 't', resizeAll(resized, grow));
      act(() => s.store.update(inputs));
    };
    frame();
    let best = Infinity;
    for (let i = 0; i < 5; i++) best = Math.min(best, cpuMsOf(frame));
    expect(s.column(resized[0]!.id).style.width).toBe(
      `${(resized[0] as { width: number }).width + grow}px`,
    );
    expect(best).toBeLessThan(cpuBudgetMs(16));
  });
});

describe('a depth layer that mounts mid-gesture', () => {
  it('shifts its columns to the live offset as it mounts, before any further message', () => {
    const board = boardOf(12);
    const s = scene(board, { depth: false });
    setPeerPreview(
      'peer',
      't',
      board.map((el) => ({
        id: el.id,
        x: (el as { x: number }).x + 25,
        y: (el as { y: number }).y,
      })),
    );
    s.store.update(inputsFor(board));
    expect(s.top(board[0]!.id).style.translate).toBe('25px 0px var(--ride-z, 0px)');
    // The view switches to Isometric while the peer holds still: no new message reaches the store.
    s.mountDepth();
    for (const el of board)
      expect(s.column(el.id).style.translate).toBe(s.top(el.id).style.translate);
  });

  it('carries a whole-board ride on a depth layer mounted mid-gesture', () => {
    const board = boardOf(400);
    const s = scene(board, { depth: false });
    setPeerPreview('peer', 't', [], { dx: 30, dy: 5, ids: board.map((el) => el.id) });
    s.store.update(inputsFor(board));
    s.mountDepth();
    expect(s.depth().style.transform).toBe('translate(30px, 5px)');
  });

  it('writes nothing when it mounts with no gesture in flight', () => {
    const board = boardOf(4);
    const s = scene(board, { depth: false });
    s.mountDepth();
    expect(s.column(board[0]!.id).style.translate).toBe('');
    expect(s.depth().style.transform).toBe('');
  });
});
