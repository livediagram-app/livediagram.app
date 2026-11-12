// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createElementGridTracker, createShape, type Element } from '@livediagram/document';
import { clearPeerPreview, resetDragPreviewForTests, setPeerPreview } from '@/lib/drag-preview';
import { buildArrowLinks } from '@/components/canvas/drag-affected-arrows';
import {
  createLayerPreviewStore,
  type LayerPreviewInputs,
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
function scene(board: readonly Element[]) {
  const view = render(
    <div data-iso="">
      <IsometricDepthLayer elements={[...board]} />
      <div data-element-plane="" data-ride-plane="" className="absolute inset-0">
        {board.map((el) => (
          <div key={el.id} data-element-id={el.id} data-ride-id={el.id} />
        ))}
      </div>
    </div>,
  );
  const store = createLayerPreviewStore();
  store.attachPlane(view.container.querySelector<HTMLElement>('[data-element-plane]'));
  const top = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!;
  const column = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-iso-column][data-ride-id="${id}"]`)!;
  const plane = (sel: string) => view.container.querySelector<HTMLElement>(sel)!;
  return {
    store,
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
    expect(s.depth().style.transform).toBe(`translate(${dx}px, 0px)`);
    expect(best).toBeLessThan(cpuBudgetMs(16));
  });
});
