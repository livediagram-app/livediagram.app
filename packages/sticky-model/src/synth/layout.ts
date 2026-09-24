import { paperColour, pickPaper, type PaperName } from './palette';
import type { Rgb, RotatedRect } from './raster';
import type { Rng } from './rng';

// Where the notes go on a synthetic wall. What matters is not realism of the
// whole but the LOCAL arrangements that break the classical detector: notes
// flush against each other, lapped over each other in columns and rows, 2x2
// blocks of the same colour, small actor pads beside big notes, and plenty of
// lone notes so a lone note is never mistaken for a pair.

export type NoteSpec = RotatedRect & { id: number; paper: PaperName; colour: Rgb };

type Spacing = 'gap' | 'flush' | 'lap';

function spacingOf(rng: Rng): { mode: Spacing; step: number } {
  const r = rng.next();
  if (r < 0.35) return { mode: 'gap', step: rng.range(0.06, 0.8) };
  if (r < 0.7) return { mode: 'flush', step: rng.range(-0.03, 0.02) };
  return { mode: 'lap', step: rng.range(-0.35, -0.05) };
}

function noteShape(rng: Rng, size: number): { w: number; h: number } {
  const s = size * rng.range(0.9, 1.1);
  const r = rng.next();
  if (r < 0.14) return { w: s * rng.range(1.4, 1.8), h: s };
  if (r < 0.22) return { w: s * rng.range(0.5, 0.7), h: s * rng.range(0.9, 1.05) };
  return { w: s * rng.range(0.93, 1.07), h: s * rng.range(0.93, 1.07) };
}

// Each note turns about its own centre, so only a lone note may turn far; a
// row turned that way would come apart at the seams.
function tilt(rng: Rng, alone: boolean): number {
  return alone && rng.chance(0.3) ? rng.range(-0.3, 0.3) : rng.range(-0.035, 0.035);
}

type Cell = { cx: number; cy: number; w: number; h: number };

// A group's notes as offsets from its origin, before rotation and jitter.
function groupCells(rng: Rng, size: number): Cell[] {
  const kind = rng.next();
  const cells: Cell[] = [];
  const place = (cols: number, rows: number, sx: number, sy: number) => {
    const shape = noteShape(rng, size);
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const w = shape.w * rng.range(0.97, 1.03);
        const h = shape.h * rng.range(0.97, 1.03);
        cells.push({
          cx: i * shape.w * (1 + sx) + rng.gauss() * 0.04 * size,
          cy: j * shape.h * (1 + sy) + rng.gauss() * 0.04 * size,
          w,
          h,
        });
      }
    }
  };
  if (kind < 0.3) {
    cells.push({ cx: 0, cy: 0, ...noteShape(rng, size) });
  } else if (kind < 0.55) {
    place(rng.int(2, 6), 1, spacingOf(rng).step, 0);
  } else if (kind < 0.75) {
    place(1, rng.int(2, 4), 0, spacingOf(rng).step);
  } else if (kind < 0.92) {
    place(rng.int(2, 3), rng.int(2, 3), spacingOf(rng).step, spacingOf(rng).step);
  } else {
    // A small pad (actors) beside a normal note: two sizes on one wall.
    const main = noteShape(rng, size);
    cells.push({ cx: 0, cy: 0, ...main });
    const small = size * rng.range(0.45, 0.7);
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i += 1) {
      cells.push({
        cx: main.w / 2 + small * (0.5 + i * rng.range(0.9, 1.3)),
        cy: rng.range(-0.3, 0.3) * main.h,
        w: small * rng.range(0.55, 1),
        h: small,
      });
    }
  }
  return cells;
}

// Some walls carry a second, much smaller pad in whole groups (a column of
// small notes, notes seen small through a window), so the model never learns
// that every note on a wall is the same size.
const SECOND_PAD_CHANCE = 0.2;
const SECOND_PAD_SHARE = 0.35;
const SECOND_PAD_SCALE: [number, number] = [0.25, 0.42];

export function layoutNotes(rng: Rng, width: number, height: number, size: number): NoteSpec[] {
  const notes: NoteSpec[] = [];
  const secondPad = rng.chance(SECOND_PAD_CHANCE) ? size * rng.range(...SECOND_PAD_SCALE) : null;
  const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const target = rng.range(0.12, 0.55) * width * height;
  let covered = 0;
  for (let attempt = 0; attempt < 200 && covered < target; attempt += 1) {
    const groupSize = secondPad !== null && rng.chance(SECOND_PAD_SHARE) ? secondPad : size;
    const cells = groupCells(rng, groupSize);
    const minX = Math.min(...cells.map((c) => c.cx - c.w / 2));
    const maxX = Math.max(...cells.map((c) => c.cx + c.w / 2));
    const minY = Math.min(...cells.map((c) => c.cy - c.h / 2));
    const maxY = Math.max(...cells.map((c) => c.cy + c.h / 2));
    // Groups may hang off the frame: a note cut by the photo's edge is real.
    const ox = rng.range(-minX - (maxX - minX) * 0.3, width - maxX + (maxX - minX) * 0.3);
    const oy = rng.range(-minY - (maxY - minY) * 0.3, height - maxY + (maxY - minY) * 0.3);
    const margin = groupSize * rng.range(0.1, 0.6);
    const box = {
      x0: ox + minX - margin,
      y0: oy + minY - margin,
      x1: ox + maxX + margin,
      y1: oy + maxY + margin,
    };
    if (taken.some((t) => box.x0 < t.x1 && box.x1 > t.x0 && box.y0 < t.y1 && box.y1 > t.y0))
      continue;
    taken.push(box);
    const oneColour = rng.chance(0.65);
    const groupPaper = pickPaper(rng);
    const groupTilt = tilt(rng, cells.length === 1);
    const order = cells.map((c, i) => ({
      c,
      key: rng.chance(0.7) ? i : rng.next() * cells.length,
    }));
    order.sort((a, b) => a.key - b.key);
    for (const { c } of order) {
      const paper = oneColour ? groupPaper : pickPaper(rng);
      notes.push({
        id: notes.length + 1,
        cx: ox + c.cx,
        cy: oy + c.cy,
        w: c.w,
        h: c.h,
        angle: groupTilt + rng.range(-0.02, 0.02),
        paper,
        colour: paperColour(rng, paper),
      });
      covered += c.w * c.h;
    }
  }
  return notes;
}

// Notes outside the arrangement: fallen on the floor, stuck on at an angle,
// on a window. Turned up to 45 degrees either way, centred wherever `where`
// allows (anywhere by default).
export function looseNotes(
  rng: Rng,
  width: number,
  height: number,
  size: number,
  firstId: number,
  where: (x: number, y: number) => boolean = () => true,
): NoteSpec[] {
  const notes: NoteSpec[] = [];
  const count = rng.int(1, 8);
  for (let tries = 0; tries < 60 && notes.length < count; tries += 1) {
    const cx = rng.range(0, width);
    const cy = rng.range(0, height);
    if (!where(cx, cy)) continue;
    const paper = pickPaper(rng);
    notes.push({
      id: firstId + notes.length,
      cx,
      cy,
      ...noteShape(rng, size * rng.range(0.6, 1.1)),
      angle: rng.range(-Math.PI / 4, Math.PI / 4),
      paper,
      colour: paperColour(rng, paper),
    });
  }
  return notes;
}
