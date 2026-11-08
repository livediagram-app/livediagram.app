// The reference board (docs/specs/008-canvas/canvas-performance.md "The reference board"): one
// synthetic board, built from a seed, so every run of the performance probe measures the same thing
// and no user content is involved. 1,000 elements of the kinds livehuddle makes, spread over four
// screens by three. (Its arrows, pen strokes and paths left with the element engine's part 4,
// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine".)

import {
  createShape,
  createSticky,
  createText,
  type Element,
  type ShapeKind,
} from '@livehuddle/document';

// docs/specs/008-canvas/blueprints/DEFAULTS.md D65.
export const REFERENCE_SEED = 1;
export const REFERENCE_COUNT = 1000;
// Four 1440 px screens wide, three 900 px screens high.
export const REFERENCE_AREA = { width: 5760, height: 2700 };

// The spec's mix, as shares of the board.
const MIX = [
  ['shape', 0.6],
  ['text', 0.25],
  ['sticky', 0.15],
] as const;
type Kind = (typeof MIX)[number][0];

const SHAPE_KINDS: ShapeKind[] = ['square', 'circle', 'diamond', 'cylinder'];

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
      case 'text': {
        const text = createText(0, 0);
        return { ...text, ...at(text.width, text.height), id, label: `Note ${i}` };
      }
      case 'sticky': {
        const sticky = createSticky(0, 0);
        return { ...sticky, ...at(sticky.width, sticky.height), id, label: `Idea ${i}` };
      }
    }
  });
}
