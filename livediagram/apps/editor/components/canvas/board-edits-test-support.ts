// Random edits to a reference board, for the tests that check a carried-over render against one drawn afresh
// (docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached", "The Map draws what changed").
import {
  createFreehand,
  createPinnedArrow,
  createShape,
  isBoxed,
  MIND_CONNECTOR_LOOK,
  type ArrowElement,
  type Element,
} from '@livediagram/document';
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

// A mind map beside the board, whose connectors a finish may route from the map's shape: a root, three children, their
// children and one more level, so a root's flow reaches connectors no pin of the root leads to.
function mindMap(): Element[] {
  const node = (id: string, x: number, y: number, parent?: string): Element => ({
    ...createShape('mind-node', 4000 + x, y),
    id,
    width: 250,
    height: 80,
    ...(parent ? { mindParentId: parent } : {}),
  });
  const link = (id: string, from: string, to: string): Element => ({
    ...createPinnedArrow(from, 'e', to, 'w'),
    id,
    ...MIND_CONNECTOR_LOOK,
  });
  const out: Element[] = [node('m-root', 0, 300)];
  for (let i = 0; i < 3; i++) {
    out.push(node(`m-${i}`, 314, i * 300, 'm-root'), link(`ml-${i}`, 'm-root', `m-${i}`));
    for (let j = 0; j < 2; j++) {
      out.push(
        node(`m-${i}-${j}`, 628, i * 300 + j * 98, `m-${i}`),
        link(`ml-${i}-${j}`, `m-${i}`, `m-${i}-${j}`),
      );
    }
    // A third level, out of reach of a root change by its pins alone.
    out.push(
      node(`m-${i}-0-0`, 942, i * 300, `m-${i}-0`),
      link(`ml-${i}-0-0`, `m-${i}-0`, `m-${i}-0-0`),
    );
  }
  return out;
}

export function edit(els: Element[], rand: () => number, step: number): Element[] {
  if (rand() < 0.15) {
    // The mind map: a node moved, or the root's flow switched (every connector in it reroutes).
    if (rand() < 0.5) {
      const id = `m-${Math.floor(rand() * 3)}`;
      return els.map((e) => (e.id === id && isBoxed(e) ? ({ ...e, y: e.y + 140 } as Element) : e));
    }
    return els.map((e) =>
      e.id === 'm-root'
        ? ({
            ...e,
            mindFlow: (e as { mindFlow?: string }).mindFlow === 'bubble' ? undefined : 'bubble',
          } as Element)
        : e,
    );
  }
  const boxes = els.filter((e) => isBoxed(e) && e.type !== 'freehand' && !e.id.startsWith('m-'));
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const kind = rand();
  if (kind < 0.45) {
    // A drop: one box or two moved.
    const moved = new Set([pick(boxes).id, ...(rand() < 0.3 ? [pick(boxes).id] : [])]);
    return els.map((e) =>
      moved.has(e.id) && isBoxed(e)
        ? ({ ...e, x: e.x + (rand() - 0.5) * 600, y: e.y + (rand() - 0.5) * 600 } as Element)
        : e,
    );
  }
  if (kind < 0.6) {
    const id = pick(boxes).id;
    return els.map((e) =>
      e.id === id && isBoxed(e) ? ({ ...e, width: e.width * 1.8 } as Element) : e,
    );
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

// The reference board with a mind map beside it.
export const editBoard = (seed: number, size: number): Element[] => [
  ...(buildReferenceBoard(seed, size) as Element[]),
  ...mindMap(),
];
