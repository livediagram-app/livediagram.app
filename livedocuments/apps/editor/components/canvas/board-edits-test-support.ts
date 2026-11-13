// Random edits to a reference board, for the tests that check a carried-over render against one drawn afresh
// (docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached", "The Map draws what changed").
import {
  createFreehand,
  createPinnedArrow,
  createShape,
  createSticky,
  isBoxed,
  type ArrowElement,
  type Element,
  type LaidOutPage,
} from '@livedocuments/document';
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

// Two pages under the board, the second with a dark fill of its own, so the elements on it are inked for it and its
// charts read what they sit on (elementPageSurfaces, chartPageGrounds).
export function boardPages(dark = true): LaidOutPage[] {
  return [
    {
      id: 'p-1',
      orientation: 'landscape',
      index: 0,
      rect: { x: 0, y: 0, width: 2800, height: 2700 },
    },
    {
      id: 'p-2',
      orientation: 'landscape',
      index: 1,
      rect: { x: 2900, y: 0, width: 2860, height: 2700 },
      ...(dark ? { background: { fill: { kind: 'solid' as const, color: '#111827' } } } : {}),
    },
  ];
}

// A chart or two on the dark page, one over a note, so a chart's ground is another element (recoloured by `edit`).
function charts(): Element[] {
  return [
    { ...createSticky(3200, 400), id: 'c-under', width: 600, height: 500 },
    { ...createShape('pie-chart', 3300, 500), id: 'c-pie' },
    { ...createShape('bar-chart', 4200, 1600), id: 'c-bar' },
  ];
}

export function edit(els: Element[], rand: () => number, step: number): Element[] {
  if (rand() < 0.1) {
    // The note under the pie recoloured: the pie's ground changes, and nothing about the pie itself.
    return els.map((e) =>
      e.id === 'c-under' && e.type === 'sticky'
        ? { ...e, fillColor: e.fillColor === '#fde68a' ? '#1e3a8a' : '#fde68a' }
        : e,
    );
  }
  const boxes = els.filter((e) => isBoxed(e) && e.type !== 'freehand');
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
    return [...els, { ...createShape('square', rand() * 5000, rand() * 2400), id: `new-${step}` }];
  if (kind < 0.8) {
    const at = { x: rand() * 5000, y: rand() * 2400 };
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

// The reference board with charts on its dark page.
export const editBoard = (seed: number, size: number): Element[] => [
  ...buildReferenceBoard(seed, size),
  ...charts(),
];
