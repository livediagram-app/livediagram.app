import { afterEach, describe, expect, it } from 'vitest';
import {
  createElementGridTracker,
  createPinnedArrow,
  createShape,
  type Element,
} from '@livedesign/design';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { resetDragPreviewForTests, setLocalPreview } from '@/lib/drag-preview';
import { buildArrowLinks } from '@/components/canvas/drag-affected-arrows';
import { createLayerPreviewStore, type LayerPreviewInputs } from './useLayerDragPreview';

// docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved": the layer's preview store runs on every
// pointer frame of a drag. 2,000 boxes, an arrow from each to its neighbour, 20 of them dragged: one frame's update,
// fastest of five after warm-up.
const N = 2000;
const DRAGGED = 20;
const boxes = Array.from({ length: N }, (_, i) => ({
  ...createShape('square', (i % 50) * 160, Math.floor(i / 50) * 120),
  id: `b${i}`,
}));
const arrows = boxes
  .slice(1)
  .map((b, i) => ({ ...createPinnedArrow(boxes[i]!.id, 'e', b.id, 'w'), id: `a${i}` }));
const BOARD = [...boxes, ...arrows];
const tracker = createElementGridTracker();
const inputs: LayerPreviewInputs = {
  tabId: 't',
  ordered: BOARD.map((element) => ({ element, layerOpacity: 1 })),
  drawnElements: BOARD,
  elementIndex: new Map(BOARD.map((el) => [el.id, el])),
  arrowLinks: buildArrowLinks(BOARD),
  gridFor: (els) => tracker.gridFor(els),
  arrowLabels: {
    renderOf: () => ({ layout: null, knockouts: [] }),
    labelRectOf: () => null,
    draftLayout: () => null,
  },
  stackedIds: new Set(),
};
const moved = (dx: number, dragged = DRAGGED) =>
  BOARD.map((el, i) =>
    i < dragged ? ({ ...el, x: (el as { x: number }).x + dx } as Element) : el,
  );

afterEach(() => resetDragPreviewForTests());

describe('the layer preview store’s frame', () => {
  it('updates a 20-element drag on a 4,000-element board within budget, each frame', () => {
    const store = createLayerPreviewStore();
    let dx = 0;
    const frame = () => {
      dx += 3;
      setLocalPreview('t', moved(dx), BOARD);
      store.update({ ...inputs });
    };
    for (let i = 0; i < 3; i++) frame();
    let best = Infinity;
    for (let i = 0; i < 5; i++) best = Math.min(best, cpuMsOf(frame));
    if (process.env.PERF_LOG) console.log(`preview frame ${best.toFixed(2)} ms`);
    expect(best).toBeLessThan(cpuBudgetMs(16));
  });

  // A very large move (docs/specs/008-canvas/canvas-performance.md "Dragging a very large selection"): half the
  // board's boxes, and all of them. The moved boxes' crossings where they were are found once a gesture, the fans
  // are placed again only where they read what moved, and a move that rides whole builds no preview board.
  const BIG_DRAGS = [1000, 2000];
  for (const dragged of BIG_DRAGS)
    it(`updates a ${dragged.toLocaleString('en')}-box drag on a 4,000-element board within budget, each frame`, () => {
      const store = createLayerPreviewStore();
      let dx = 0;
      const frame = () => {
        dx += 3;
        setLocalPreview('t', moved(dx, dragged), BOARD);
        store.update({ ...inputs });
      };
      for (let i = 0; i < 3; i++) frame();
      let best = Infinity;
      for (let i = 0; i < 5; i++) best = Math.min(best, cpuMsOf(frame));
      if (process.env.PERF_LOG)
        console.log(`preview frame, ${dragged} dragged ${best.toFixed(2)} ms`);
      // Measured 3.3 to 5.5 ms here and 5.8 to 9.5 ms under coverage on an M-series Mac (7 to 7.6 ms before the
      // crossings and fans were kept per gesture), and 18 to 27 ms on CI's shared runners under coverage. The budget
      // is the spec's own, "A drag frame's arrow work": at most 16 ms of CPU, 48 ms on CI.
      expect(best).toBeLessThan(cpuBudgetMs(16));
    });

  // A union resize of every box (docs/specs/008-canvas/canvas-performance.md "A frame's arrow work is linear in what
  // moved"): nothing rides, so every arrow re-routes, each asking the moved boxes' grid for what cuts it. Scanning
  // every moved box for every arrow took about half a second a frame here.
  it('updates a union resize of all 2,000 boxes on a 4,000-element board within budget, each frame', () => {
    const store = createLayerPreviewStore();
    let grow = 0;
    const frame = () => {
      grow += 2;
      const resized = BOARD.map((el) => ('width' in el ? { ...el, width: el.width + grow } : el));
      setLocalPreview('t', resized, BOARD);
      store.update({ ...inputs });
    };
    for (let i = 0; i < 3; i++) frame();
    let best = Infinity;
    for (let i = 0; i < 5; i++) best = Math.min(best, cpuMsOf(frame));
    if (process.env.PERF_LOG) console.log(`union resize frame ${best.toFixed(2)} ms`);
    expect(best).toBeLessThan(cpuBudgetMs(60));
  });

  it('does no work when the layer re-renders mid-drag with nothing changed', () => {
    const store = createLayerPreviewStore();
    setLocalPreview('t', moved(3), BOARD);
    store.update({ ...inputs });
    // A peer's cursor, a timer tick: the layer renders again with a fresh inputs object.
    const again = () => store.update({ ...inputs, gridFor: (els) => tracker.gridFor(els) });
    for (let i = 0; i < 3; i++) again();
    let best = Infinity;
    for (let i = 0; i < 5; i++) best = Math.min(best, cpuMsOf(again));
    if (process.env.PERF_LOG) console.log(`idle layer render ${best.toFixed(3)} ms`);
    expect(best).toBeLessThan(cpuBudgetMs(1));
  });
});
