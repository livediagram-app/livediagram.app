// Random edits to a reference board, for the tests that check a carried-over render against one drawn afresh
// (docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached", "The Map draws what changed").
import {
  createFreehand,
  createPinnedArrow,
  createShape,
  isBoxed,
  layOutPages,
  type ArrowElement,
  type Element,
  type LaidOutPage,
} from '@livedesign/design';
import { buildReferenceBoard } from '../../e2e/perf/reference-board';

// mulberry32, so a failure replays.
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three pages in a row about the canvas origin, the first two with a fill of their own (dark) when `filled`: what an
// element is inked for, and what a chart sits on, follow the page it is on (page-content.ts, chart-ink.ts).
export function pagesOf(filled: boolean): LaidOutPage[] {
  const dark = { background: { fill: { kind: 'solid' as const, color: '#0f172a' } } };
  return layOutPages([
    { id: 'p1', orientation: 'landscape', ...(filled ? dark : {}) },
    { id: 'p2', orientation: 'portrait', ...(filled ? dark : {}) },
    { id: 'p3', orientation: 'landscape' },
  ]);
}

// What sits on the pages: a chart on the first, a card that moves under it and away (the chart's ground changes with
// no change to the chart), and a box pinned to the chart that moves from page to page (its arrow's page changes).
function pageBoard(): Element[] {
  const [p1, , p3] = pagesOf(true);
  return [
    // A light card on a dark page, so a chart over it is inked for another ground.
    {
      ...createShape('square', p1!.rect.x + 20, p1!.rect.y + 20),
      id: 'pg-card',
      width: 420,
      height: 300,
      fillColor: '#fef3c7',
    },
    {
      ...createShape('line-chart', p1!.rect.x + 60, p1!.rect.y + 60),
      id: 'pg-chart',
      width: 300,
      height: 200,
    },
    { ...createShape('square', p3!.rect.x + 80, p3!.rect.y + 80), id: 'pg-box' },
    { ...createPinnedArrow('pg-chart', 'e', 'pg-box', 'w'), id: 'pg-arrow' },
  ];
}

export function edit(els: Element[], rand: () => number, step: number): Element[] {
  if (rand() < 0.15) {
    // The pages: the card slid out from under the chart or back, or the box sent to another page.
    const [p1, p2, p3] = pagesOf(true);
    if (rand() < 0.5)
      return els.map((e) =>
        e.id === 'pg-card' && isBoxed(e)
          ? { ...e, x: e.x === p1!.rect.x + 20 ? p1!.rect.x + 400 : p1!.rect.x + 20 }
          : e,
      );
    const page = [p1, p2, p3][Math.floor(rand() * 3)]!;
    return els.map((e) =>
      e.id === 'pg-box' && isBoxed(e) ? { ...e, x: page.rect.x + 120, y: page.rect.y + 400 } : e,
    );
  }
  const boxes = els.filter((e) => isBoxed(e) && e.type !== 'freehand' && !e.id.startsWith('pg-'));
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const kind = rand();
  if (kind < 0.45) {
    // A drop: one box or two moved.
    const moved = new Set([pick(boxes).id, ...(rand() < 0.3 ? [pick(boxes).id] : [])]);
    return els.map((e) =>
      moved.has(e.id) && isBoxed(e)
        ? { ...e, x: e.x + (rand() - 0.5) * 600, y: e.y + (rand() - 0.5) * 600 }
        : e,
    );
  }
  if (kind < 0.6) {
    const id = pick(boxes).id;
    return els.map((e) => (e.id === id && isBoxed(e) ? { ...e, width: e.width * 1.8 } : e));
  }
  if (kind < 0.7)
    return [...els, { ...createShape('square', rand() * 3000, rand() * 2000), id: `new-${step}` }];
  if (kind < 0.8) {
    const at = { x: rand() * 3000, y: rand() * 2000 };
    const pts = Array.from({ length: 8 }, (_, k) => ({
      x: at.x + k * 10,
      y: at.y + Math.sin(k) * 20,
    }));
    return [...els, { ...createFreehand(pts, false), id: `ink-${step}` }];
  }
  if (kind < 0.88) {
    // A box with nothing pinned to it goes.
    const pinned = new Set(
      els.flatMap((e) =>
        e.type === 'arrow'
          ? [e.from, e.to].flatMap((end) => ('elementId' in end ? [end.elementId] : []))
          : [],
      ),
    );
    const free = boxes.filter((b) => !pinned.has(b.id));
    if (free.length === 0) return els;
    const id = pick(free).id;
    return els.filter((e) => e.id !== id);
  }
  if (kind < 0.94) {
    const a = pick(boxes);
    const b = pick(boxes);
    return a === b
      ? els
      : [
          ...els,
          { ...createPinnedArrow(a.id, 'e', b.id, 'w'), id: `arrow-${step}`, routeBehind: true },
        ];
  }
  // A restyled arrow.
  const arrows = els.filter((e): e is ArrowElement => e.type === 'arrow');
  const id = pick(arrows).id;
  return els.map((e) =>
    e.id === id ? ({ ...e, routeBehind: !(e as ArrowElement).routeBehind } as Element) : e,
  );
}

// The reference board with the page board beside it.
export const editBoard = (seed: number, size: number): Element[] => [
  ...buildReferenceBoard(seed, size),
  ...pageBoard(),
];
