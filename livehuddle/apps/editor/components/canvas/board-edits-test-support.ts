// Random edits to a reference board, for the tests that check a carried-over render against one drawn afresh
// (docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached", "The Map draws what changed").
import { createShape, isBoxed, isRetiredArrow, type Element } from '@livehuddle/document';
import { buildReferenceBoard } from '../../e2e/perf/reference-board';
import { storedArrow, storedPinnedArrow } from '../../test/retired-elements';

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

const ANCHORS = ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw'] as const;

// The stored arrows a board saved before the element engine's part 4 holds
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"): pinned between boxes, with free ends, and
// one with an end on another arrow, so a box moving reaches an arrow no pin of it leads to.
function storedArrows(boxes: readonly Element[], rand: () => number, count: number): Element[] {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const out: Element[] = [];
  for (let i = 0; i < count; i++) {
    const a = pick(boxes);
    const b = pick(boxes);
    out.push(storedPinnedArrow(`sa-${i}`, a.id, pick(ANCHORS), b.id, pick(ANCHORS)));
  }
  out.push(storedArrow('sa-free', { x: 100, y: 100 }, { x: 900, y: 400 }));
  out.push({
    ...storedArrow('sa-on-arrow', { x: 0, y: 0 }, { x: 0, y: 0 }),
    from: { kind: 'on-arrow', arrowId: 'sa-0', t: 0.5 },
    to: { kind: 'pinned', elementId: pick(boxes).id, anchor: 'n' },
  } as unknown as Element);
  return out;
}

export function edit(els: Element[], rand: () => number, step: number): Element[] {
  const boxes = els.filter(isBoxed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const kind = rand();
  if (kind < 0.15) {
    // A drop onto another box: its centre on the other's, so under Sketch the one beneath becomes a backdrop.
    const moved = pick(boxes);
    const buttons = boxes.filter((b) => b.id.startsWith('mb-'));
    const onto = buttons.length > 0 && rand() < 0.5 ? pick(buttons) : pick(boxes);
    const cx = onto.x + onto.width / 2 - moved.width / 2;
    const cy = onto.y + onto.height / 2 - moved.height / 2;
    return els.map((e) => (e === moved ? { ...e, x: cx, y: cy } : e));
  }
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
    return [...els, { ...createShape('room', rand() * 3000, rand() * 2000), id: `new-${step}` }];
  if (kind < 0.8) {
    // A box goes, pinned arrows and all left dangling (an end that does not resolve takes the other's point).
    const id = pick(boxes).id;
    return els.filter((e) => e.id !== id);
  }
  if (kind < 0.88) {
    const a = pick(boxes);
    const b = pick(boxes);
    return [...els, storedPinnedArrow(`arrow-${step}`, a.id, pick([...ANCHORS]), b.id, 'w')];
  }
  if (kind < 0.94) {
    // A stored arrow re-pinned at another anchor (as an import or an old client might).
    const arrows = els.filter(isRetiredArrow);
    const id = pick(arrows).id;
    return els.map((e) =>
      e.id === id && isRetiredArrow(e) && e.to.kind === 'pinned'
        ? { ...e, to: { ...e.to, anchor: pick([...ANCHORS]) } }
        : e,
    );
  }
  // A label changed (a box's or a stored arrow's), which the Map leaves out.
  const id = pick(els).id;
  return els.map((e) => (e.id === id ? { ...e, label: `Edited ${step}` } : e));
}

// The reference board with stored arrows among its boxes, and a few Mode Buttons: the shapes Sketch hatches, which turn
// solid as a backdrop when something above them sits on them (sketch-backdrop.ts).
export const editBoard = (
  seed: number,
  size: number,
  arrows = Math.round(size / 10),
): Element[] => {
  // The buttons first, beneath the board, so a box dropped on one sits on it.
  const board = [
    ...Array.from({ length: 6 }, (_, i) => ({
      ...createShape('mode-button', 300 + i * 700, 200 + (i % 3) * 800),
      id: `mb-${i}`,
    })),
    ...buildReferenceBoard(seed, size),
  ];
  return [...board, ...storedArrows(board, prng(seed * 7 + 1), arrows)];
};
