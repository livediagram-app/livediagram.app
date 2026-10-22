import { afterEach, describe, expect, it } from 'vitest';
import {
  createElementGridTracker,
  createPinnedArrow,
  createShape,
  type Element,
} from '@livedesign/document';
import { cpuBudgetMs, cpuMsOf } from '@livedesign/vitest-config/cpu-time';
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
};
const moved = (dx: number) =>
  BOARD.map((el, i) =>
    i < DRAGGED ? ({ ...el, x: (el as { x: number }).x + dx } as Element) : el,
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
