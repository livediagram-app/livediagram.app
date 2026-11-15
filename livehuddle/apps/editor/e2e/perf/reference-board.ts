// The reference Space (docs/specs/008-canvas/canvas-performance.md "The reference board"): one synthetic office,
// built from a seed, so every run of the performance probe measures the same thing and no user content is involved.
// 1,000 elements laid out as a real Space is: 96 rooms on a 12 by 8 grid over four screens by three, each with its
// door, a rug, two desks with their chairs, a sofa, a plant and a sticky note, and the first 40 named by a text label
// (Work Tracker 649: measured on a Space of rooms and furniture rather than shapes scattered at random).

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

// The office: a grid of rooms, each in its cell with a corridor's gap round it.
export const ROOM_COLUMNS = 12;
export const ROOM_ROWS = 8;
const CELL = {
  width: REFERENCE_AREA.width / ROOM_COLUMNS,
  height: REFERENCE_AREA.height / ROOM_ROWS,
};
const GAP = 32;
// The rooms named by a text label, so the board holds exactly REFERENCE_COUNT elements.
const LABELLED_ROOMS = REFERENCE_COUNT - ROOM_COLUMNS * ROOM_ROWS * 10;

/** The furniture kinds the probe drags (a piece, the commonest thing moved in a Space). */
export const FURNITURE_KINDS: readonly ShapeKind[] = ['desk', 'chair', 'sofa', 'plant'];

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

/** The reference Space, or its first `count` elements (a smaller office for a unit test's seeded edits). */
export function buildReferenceBoard(seed = REFERENCE_SEED, count = REFERENCE_COUNT): Element[] {
  const rand = prng(seed);
  const out: Element[] = [];
  const add = (el: Element) => out.push({ ...el, id: `ref-${out.length}` });
  // A piece of `kind` at a seeded spot inside the box (x, y, w, h), kept wholly inside it.
  const piece = (kind: ShapeKind, x: number, y: number, w: number, h: number) => {
    const s = createShape(kind, 0, 0);
    add({
      ...s,
      x: Math.round(x + rand() * Math.max(0, w - s.width)),
      y: Math.round(y + rand() * Math.max(0, h - s.height)),
    });
  };
  for (let row = 0; row < ROOM_ROWS; row++)
    for (let col = 0; col < ROOM_COLUMNS; col++) {
      const n = row * ROOM_COLUMNS + col;
      const x = Math.round(col * CELL.width + GAP / 2);
      const y = Math.round(row * CELL.height + GAP / 2);
      const width = Math.round(CELL.width - GAP);
      const height = Math.round(CELL.height - GAP);
      add({ ...createShape('room', 0, 0), x, y, width, height, label: `Room ${n + 1}` });
      const door = createShape('door', 0, 0);
      add({
        ...door,
        x: Math.round(x + width / 2 - door.width / 2),
        y: Math.round(y + height - door.height / 2),
      });
      add({
        ...createShape('rug', 0, 0),
        x: x + 24,
        y: y + 40,
        width: Math.round(width / 2),
        height: Math.round(height / 2),
      });
      // The work half (left) and the lounge half (right) of the room, inset from its walls.
      const half = width / 2 - 24;
      const inner = height - 48;
      for (let d = 0; d < 2; d++) {
        piece('desk', x + 16, y + 16 + (d * inner) / 2, half, inner / 2);
        piece('chair', x + 16, y + 16 + (d * inner) / 2, half, inner / 2);
      }
      piece('sofa', x + width / 2, y + 16, half, inner / 2);
      piece('plant', x + width / 2, y + 16 + inner / 2, half, inner / 2);
      // A small note on the wall, clear of the sofa (a default sticky covers a quarter of the room).
      const sticky = { ...createSticky(0, 0), width: 96, height: 96 };
      add({
        ...sticky,
        x: Math.round(x + width - sticky.width - 16),
        y: Math.round(y + 16),
        label: `Idea ${n + 1}`,
      });
      if (n < LABELLED_ROOMS) {
        const text = createText(0, 0);
        add({ ...text, x: x + 16, y: y + height - text.height - 16, label: `Team ${n + 1}` });
      }
    }
  return out.slice(0, count);
}
