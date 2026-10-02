// The reference board (docs/specs/008-canvas/canvas-performance.md "The reference board"): one
// synthetic board, built from a seed, so every run of the performance probe measures the same thing
// and no user content is involved. 1,000 elements in the mix real boards have, spread over four
// screens by three, every arrow pinned between two shapes and routed behind boxes as drawn.

import {
  createFreehand,
  createPath,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Anchor,
  type Element,
  type ShapeKind,
} from '@livediagram/document';

// docs/specs/008-canvas/blueprints/DEFAULTS.md D65.
export const REFERENCE_SEED = 1;
export const REFERENCE_COUNT = 1000;
// Four 1440 px screens wide, three 900 px screens high.
export const REFERENCE_AREA = { width: 5760, height: 2700 };

// The spec's mix, as shares of the board.
const MIX = [
  ['shape', 0.4],
  ['arrow', 0.3],
  ['freehand', 0.1],
  ['text', 0.1],
  ['path', 0.05],
  ['sticky', 0.05],
] as const;
type Kind = (typeof MIX)[number][0];

const SHAPE_KINDS: ShapeKind[] = ['square', 'circle', 'diamond', 'cylinder'];
const SIDES: Anchor[] = ['n', 'e', 's', 'w'];

// mulberry32: a small, well-mixed 32-bit PRNG, the same numbers on every machine.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildReferenceBoard(seed = REFERENCE_SEED, count = REFERENCE_COUNT): Element[] {
  const rand = prng(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  // Exact counts per kind, interleaved by a seeded shuffle so paint order mixes them as a board does.
  const kinds: Kind[] = MIX.flatMap(([kind, share]) =>
    Array.from({ length: Math.round(count * share) }, () => kind),
  );
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  const shapeIds = kinds.flatMap((kind, i) => (kind === 'shape' ? [`ref-${i}`] : []));
  // A top-left that keeps a box of this size inside the area.
  const at = (w: number, h: number) => ({
    x: Math.round(rand() * (REFERENCE_AREA.width - w)),
    y: Math.round(rand() * (REFERENCE_AREA.height - h)),
  });

  return kinds.map((kind, i): Element => {
    const id = `ref-${i}`;
    switch (kind) {
      case 'shape': {
        const shape = createShape(pick(SHAPE_KINDS), 0, 0);
        return { ...shape, ...at(shape.width, shape.height), id, label: `Step ${i}` };
      }
      case 'arrow': {
        const from = pick(shapeIds);
        let to = pick(shapeIds);
        while (to === from) to = pick(shapeIds);
        return { ...createPinnedArrow(from, pick(SIDES), to, pick(SIDES)), id };
      }
      case 'freehand': {
        const { x, y } = at(220, 120);
        const points = Array.from({ length: 24 }, (_, k) => ({
          x: x + k * 9,
          y: y + 60 + Math.sin(k / 3 + rand()) * 50,
        }));
        return { ...createFreehand(points, false), id };
      }
      case 'text': {
        const text = createText(0, 0);
        return { ...text, ...at(text.width, text.height), id, label: `Note ${i}` };
      }
      case 'path': {
        const { x, y } = at(160, 120);
        const closed = i % 2 === 1;
        const corners = [
          { x, y },
          { x: x + 160, y: y + 20 },
          { x: x + 120, y: y + 120 },
          { x: x + 20, y: y + 90 },
        ].map((p) => ({ ...p, mode: 'corner' as const }));
        const path = createPath(corners, closed);
        return { ...path, id, ...(closed ? { fillColor: '#bfdbfe' } : {}) };
      }
      case 'sticky': {
        const sticky = createSticky(0, 0);
        return { ...sticky, ...at(sticky.width, sticky.height), id, label: `Idea ${i}` };
      }
    }
  });
}
