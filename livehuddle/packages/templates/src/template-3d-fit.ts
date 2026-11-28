// Templates made for 3D (docs/specs/007-editor/templates-by-mode.md "Made for 3D"): a pure layout check every
// template's tabs must pass, judged where the 3D view stands each piece (its model on its footprint at its facing,
// docs/specs/008-canvas/3d-engine.md "Block models"), not where its old flat drawing's box lay. The owner, 2026-11-27:
// "items against walls, facing the right way etc, not too tight spaces". Pure: no React, no DOM. Test-only: nothing
// shipped imports it.
//
// The rules, each issue naming its rule:
// - `wall`: a piece that belongs against a wall stands with its back on a wall's face, facing into the room; a hung
//   piece hangs on a wall face; a Door or a Window stands in a wall.
// - `facing`: a seat faces what it belongs to (its table, desk or bar; the stage or screen of a hall; else into the
//   room), never a wall up close.
// - `overlap`: no piece's model stands on another's or in a wall, and every doorway is clear on both sides.
// - `reach`: from the Avatar Pad, a walk a character's width wide reaches every seat and every piece someone uses.
// - `shared-wall`: rooms side by side share one wall line, or stand at least a corridor apart.
// - `indoor`: on a site out of doors (a lawn or paths), indoor furniture (a chair, a desk, a sofa, a table, a shelf, a
//   kitchen or bar piece, a machine) stands inside a room, a corridor or an Office Pod, never out in the open air; outdoors has its own seats (a Bench,
//   a Picnic Table, a Hammock) under a Garden Umbrella.
// - `outdoor`: a Road lies out of doors, its middle never in a room or a corridor (docs/specs/009-elements/road.md).

import {
  ROOM_BACK_FACE,
  ROOM_WALL,
  isFloorShape,
  isWallPiece,
  mountedFace,
  mountsOnWall,
  onRoomWall,
  pieceFacing,
  seatsACharacter,
  setModelFootprints,
  sharesWallsByBox,
  turnsWithFacing,
  wallsOf,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { FRONT, modelFloorBox, STANDS_AGAINST_A_WALL } from './template-model-box';
import { gapToWall } from './template-flush';
import { fenceSegments, type FenceSegment } from '@livehuddle/avatar/collision';
import { avatarPadCore } from '@livehuddle/avatar/pad-art';
import { AVATAR_WIDTH } from '@livehuddle/avatar/walk';

export type FitRule =
  'wall' | 'facing' | 'overlap' | 'reach' | 'shared-wall' | 'indoor' | 'outdoor';
export type FitIssue = { rule: FitRule; message: string };

type Box = { x: number; y: number; width: number; height: number };

/** A character's walking width: a Regular character at the scale it collides at (templates-by-mode.md "roomy"). */
export const FIT_CHARACTER = AVATAR_WIDTH * 1.5;
/** A corridor's width: rooms not sharing a wall stand at least this far apart (corridor.md, a Corridor's 120 px). */
export const FIT_CORRIDOR = 120;
/** Half a 3D wall: its face stands this far from its line (scene-walls.ts WALL_THICKNESS.wall / 2). */
export const FIT_WALL_FACE = 4;
/** How far off its wall's face a piece's back may stand and still be flush, in canvas px. */
export const FIT_FLUSH = 8;
/** How near a table, desk or bar a seat stands to belong to it, in canvas px. */
const BELONGS = 48;
/** How far a seat's look may reach what it faces, in canvas px. */
const LOOKS = 320;
/** The walking grid's cell, in canvas px. */
const CELL = 8;

// What stands on another piece on purpose: a microwave, a kettle or a coffee machine on a worktop or a bar, a lamp on
// a desk or a table, a podium under the stage curtains.
const ON_TOP: Record<string, readonly string[]> = {
  microwave: ['kitchen-counter', 'kitchen-sink', 'bar'],
  kettle: ['kitchen-counter', 'kitchen-sink', 'bar'],
  'coffee-machine': ['kitchen-counter', 'kitchen-sink', 'bar'],
  'table-lamp': ['desk', 'meeting-table', 'hot-desk', 'standing-desk'],
  'desk-lamp': ['desk', 'meeting-table', 'hot-desk', 'standing-desk'],
  podium: ['stage-curtains'],
};
const onTop = (a: string, b: string) => !!ON_TOP[a]?.includes(b) || !!ON_TOP[b]?.includes(a);

// Not a piece of the Space's floor or furniture: text, floors, the wall's own pieces, things with no body.
const NO_BODY = new Set([
  'door',
  'window',
  'sticker',
  'focus-button',
  'stairs',
  'timer',
  'stopwatch',
]);
// What a seat belongs to when it stands beside it.
const TABLES = new Set([
  'meeting-table',
  'picnic-table',
  'desk',
  'hot-desk',
  'standing-desk',
  'bar',
  'kitchen-counter',
  'campfire',
  'ping-pong-table',
]);
// What a seat may look at from across the floor.
const SIGHTS = new Set([
  ...TABLES,
  'screen',
  'stage',
  'fireplace',
  'fountain',
  'pond',
  'swimming-pool',
  'rug',
  'chair',
  'sofa',
  'bench',
  'bean-bag',
  'jukebox',
  'podium',
]);
// The seats the facing rule reads: the ones a character sits on facing out of them. A desk, a table, a pod or a booth
// is its own table.
const LOOSE_SEATS = new Set(['chair', 'sofa', 'bar-stool', 'bench', 'bean-bag', 'reading-nook']);
// The seats a sitter takes at their back, facing out across them.
const DESKS = new Set(['desk', 'hot-desk', 'standing-desk']);
// Pieces someone walks up to use, beside the seats.
const USED = new Set([
  ...STANDS_AGAINST_A_WALL,
  'reception-desk',
  'bookshelf',
  'notice-board',
  'suggestion-box',
  'directory',
  'elevator',
  'fireplace',
  'microwave',
  'kettle',
  'washbasin',
  'toilet-cubicle',
  'hand-dryer',
  'signpost',
  'dartboard',
  'pool-table',
  'foosball-table',
  'ping-pong-table',
]);

const shapesOf = (els: readonly Element[]) =>
  els.filter((e): e is ShapeElement => e.type === 'shape');
const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const grow = (b: Box, d: number): Box => ({
  x: b.x - d,
  y: b.y - d,
  width: b.width + 2 * d,
  height: b.height + 2 * d,
});
const label = (el: ShapeElement) =>
  `${el.shape}${el.label ? ` "${String(el.label)}"` : ''} at ${Math.round(el.x)},${Math.round(el.y)}`;

// A wall piece hung on its face, as the 3D view hangs it (scene-pieces.ts hungFrame): its back on the face, along the
// wall about its middle, a board's depth or its own footprint's.
function hungBox(el: ShapeElement, face: { line: number; vertical: boolean; dir: 1 | -1 }): Box {
  const model = modelFloorBox(el);
  const turns = turnsWithFacing(el.shape);
  const depth = turns ? (face.vertical ? model.width : model.height) : 6;
  const length = face.vertical ? (turns ? model.height : el.width) : turns ? model.width : el.width;
  const mid = face.vertical ? el.y + el.height / 2 : el.x + el.width / 2;
  const from = face.line + face.dir * (FIT_WALL_FACE + 0.5);
  const lo = face.dir === 1 ? from : from - depth;
  return face.vertical
    ? { x: lo, y: mid - length / 2, width: depth, height: length }
    : { x: mid - length / 2, y: lo, width: length, height: depth };
}

type Piece = { el: ShapeElement; box: Box; hung: boolean };

/** Every piece with a body, where the 3D view stands it. */
function bodies(els: readonly Element[]): Piece[] {
  const out: Piece[] = [];
  for (const el of shapesOf(els)) {
    if (isFloorShape(el.shape) || NO_BODY.has(el.shape)) continue;
    if (mountsOnWall(el.shape)) {
      const face = mountedFace(el, els);
      out.push({ el, box: face ? hungBox(el, face) : modelFloorBox(el), hung: !!face });
    } else out.push({ el, box: modelFloorBox(el), hung: false });
  }
  return out;
}

type Wall = { a: { x: number; y: number }; b: { x: number; y: number } };

// A wall's band in 3D: its line, thickened to its faces.
function wallBand(w: Wall): Box {
  return {
    x: Math.min(w.a.x, w.b.x) - FIT_WALL_FACE,
    y: Math.min(w.a.y, w.b.y) - FIT_WALL_FACE,
    width: Math.abs(w.a.x - w.b.x) + 2 * FIT_WALL_FACE,
    height: Math.abs(w.a.y - w.b.y) + 2 * FIT_WALL_FACE,
  };
}

// The room (or corridor) whose floor holds a point, the smallest first.
function roomAt(els: readonly Element[], p: { x: number; y: number }): ShapeElement | null {
  let best: ShapeElement | null = null;
  for (const r of shapesOf(els)) {
    if (r.shape !== 'room' && r.shape !== 'corridor') continue;
    const top = r.shape === 'room' ? r.y + ROOM_BACK_FACE - ROOM_WALL / 2 : r.y;
    if (p.x < r.x || p.x > r.x + r.width || p.y < top || p.y > r.y + r.height) continue;
    if (!best || r.width * r.height < best.width * best.height) best = r;
  }
  return best;
}

// --- Rule 1: against a wall ------------------------------------------------------------------------------------

function wallRule(els: readonly Element[], pieces: readonly Piece[], out: FitIssue[]): void {
  const walls = wallsOf(els);
  const rooms = shapesOf(els).filter((e) => e.shape === 'room' || e.shape === 'corridor');
  for (const el of shapesOf(els))
    if (isWallPiece(el) && !rooms.some((r) => onRoomWall(el, r)))
      out.push({ rule: 'wall', message: `${label(el)} stands in no wall` });
  for (const p of pieces) {
    const kind = p.el.shape;
    if (mountsOnWall(kind)) {
      if (!p.hung) out.push({ rule: 'wall', message: `${label(p.el)} hangs on no wall` });
      continue;
    }
    if (!STANDS_AGAINST_A_WALL.has(kind)) continue;
    // A coffee machine on a worktop stands where the worktop does.
    if (pieces.some((q) => q !== p && onTop(kind, q.el.shape) && meets(p.box, q.box))) continue;
    const gap = gapToWall(p.el, walls);
    if (gap === null || gap > FIT_FLUSH)
      out.push({
        rule: 'wall',
        message: `${label(p.el)} facing ${pieceFacing(p.el)} has its back ${
          gap === null ? 'to no wall within reach' : `${Math.round(gap)} px off its wall`
        }`,
      });
    else if (gap < -0.5)
      out.push({
        rule: 'wall',
        message: `${label(p.el)} pokes ${Math.round(-gap)} px into its wall`,
      });
  }
}

// --- Rule 2: seats face what they belong to --------------------------------------------------------------------

// How far a ray from `from` along `dir` runs before it enters `box`, or null when it misses.
function rayTo(
  from: { x: number; y: number },
  dir: { x: number; y: number },
  box: Box,
): number | null {
  let t0 = 0;
  let t1 = Infinity;
  for (const [p, d, lo, hi] of [
    [from.x, dir.x, box.x, box.x + box.width],
    [from.y, dir.y, box.y, box.y + box.height],
  ] as const) {
    if (d === 0) {
      if (p < lo || p > hi) return null;
      continue;
    }
    const a = (lo - p) / d;
    const b = (hi - p) / d;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  return t0 <= t1 ? t0 : null;
}

function facingRule(els: readonly Element[], pieces: readonly Piece[], out: FitIssue[]): void {
  const all = shapesOf(els);
  const walls = wallsOf(els).map(({ a, b }) => wallBand({ a, b }));
  // A round plaza (a Garden Path drawn square, template-campus-parts.ts plaza) is a place to look at, as a stage is.
  const floors = all.filter(
    (e) =>
      e.shape === 'stage' ||
      e.shape === 'rug' ||
      (e.shape === 'garden-path' && Math.abs(e.width - e.height) < 1 && e.width >= 200),
  );
  const sights = [
    ...pieces.filter((p) => SIGHTS.has(p.el.shape)),
    ...floors.map((el) => ({ el, box: el as Box, hung: false })),
  ];
  for (const p of pieces) {
    if (!LOOSE_SEATS.has(p.el.shape)) continue;
    const f = FRONT[pieceFacing(p.el)];
    const c = { x: p.box.x + p.box.width / 2, y: p.box.y + p.box.height / 2 };
    const half = Math.abs(f.x) ? p.box.width / 2 : p.box.height / 2;
    // Beside a table, desk or bar: it faces it.
    const tables = pieces.filter(
      (q) => q !== p && TABLES.has(q.el.shape) && meets(grow(p.box, BELONGS), q.box),
    );
    const wants = p.el.shape === 'bar-stool' ? tables.filter((q) => q.el.shape === 'bar') : tables;
    if (wants.length > 0) {
      const faced = wants.some((q) => {
        const t = rayTo(c, f, q.box);
        return t !== null && t - half <= BELONGS;
      });
      if (!faced)
        out.push({
          rule: 'facing',
          message: `${label(p.el)} turns its back on the ${wants[0]!.el.shape} it sits at`,
        });
      continue;
    }
    // A hall's seats face its stage, else its screen.
    const room = roomAt(els, c);
    const inRoom = (b: Box) =>
      room ? meets(b, room) : Math.hypot(b.x - c.x, b.y - c.y) < LOOKS * 2;
    // Out on the lawn a seat looks where it likes (a terrace, a bench by a pond).
    const stage = room ? floors.find((s) => s.shape === 'stage' && inRoom(s as Box)) : undefined;
    const screen = room ? pieces.find((s) => s.el.shape === 'screen' && inRoom(s.box)) : undefined;
    const focus = stage ? (stage as Box) : screen?.box;
    const audience =
      focus &&
      pieces.filter(
        (q) => q.el.shape === p.el.shape && inRoom(q.box) && LOOSE_SEATS.has(q.el.shape),
      ).length >= 4;
    if (focus && audience) {
      const fx = focus.x + focus.width / 2 - c.x;
      const fy = focus.y + focus.height / 2 - c.y;
      const along = (fx * f.x + fy * f.y) / (Math.hypot(fx, fy) || 1);
      if (along < 0.25)
        out.push({
          rule: 'facing',
          message: `${label(p.el)} faces away from the ${stage ? 'stage' : 'screen'}`,
        });
      continue;
    }
    // Else it looks into the room, at something, never at a wall up close.
    const front = (t: number) => ({ x: c.x + f.x * (half + t), y: c.y + f.y * (half + t) });
    const strip = (() => {
      const a = front(0);
      const b = front(FIT_CHARACTER);
      const across = Math.abs(f.x) ? p.box.height : p.box.width;
      return Math.abs(f.x)
        ? { x: Math.min(a.x, b.x), y: c.y - across / 4, width: FIT_CHARACTER, height: across / 2 }
        : { x: c.x - across / 4, y: Math.min(a.y, b.y), width: across / 2, height: FIT_CHARACTER };
    })();
    if (walls.some((w) => meets(strip, w))) {
      out.push({ rule: 'facing', message: `${label(p.el)} faces a wall up close` });
      continue;
    }
    // On the lawn, a walk to watch is a sight too: a bench along a path.
    const paths = room ? [] : all.filter((e) => e.shape === 'garden-path');
    const watches = paths.some((q) => {
      const t = rayTo(c, f, q);
      return t !== null && t - half <= LOOKS;
    });
    const sees =
      watches ||
      sights.some((q) => {
        if (q.el === p.el) return false;
        const t = rayTo(c, f, grow(q.box, 24));
        return t !== null && t - half <= LOOKS;
      });
    const mid = room
      ? { x: room.x + room.width / 2 - c.x, y: room.y + room.height / 2 - c.y }
      : { x: 0, y: 0 };
    const intoRoom = (mid.x * f.x + mid.y * f.y) / (Math.hypot(mid.x, mid.y) || 1) >= 0.3;
    if (!sees && !intoRoom)
      out.push({ rule: 'facing', message: `${label(p.el)} looks at nothing, out of its room` });
  }
}

// --- Rule 3: overlap, doorways ---------------------------------------------------------------------------------

function overlapRule(els: readonly Element[], pieces: readonly Piece[], out: FitIssue[]): void {
  const fences = new Set(['fence', 'garden-fence']);
  for (const [i, a] of pieces.entries())
    for (const b of pieces.slice(i + 1)) {
      if (onTop(a.el.shape, b.el.shape)) continue;
      if (fences.has(a.el.shape) && fences.has(b.el.shape)) continue;
      if (meets(a.box, b.box))
        out.push({ rule: 'overlap', message: `${label(a.el)} stands on ${label(b.el)}` });
    }
  const walls = wallsOf(els).map(({ a, b, room }) => ({ band: wallBand({ a, b }), room }));
  for (const p of pieces) {
    if (p.hung) continue;
    if (p.el.shape === 'office-pod' || fences.has(p.el.shape)) continue;
    for (const w of walls)
      if (meets(p.box, w.band)) {
        out.push({
          rule: 'overlap',
          message: `${label(p.el)} stands in ${w.room.label ? `"${String(w.room.label)}"` : 'a'}'s wall`,
        });
        break;
      }
  }
  // Every doorway clear a character's width deep, both sides.
  for (const door of shapesOf(els).filter((e) => e.shape === 'door')) {
    const r = (((door.rotation ?? 0) % 180) + 180) % 180;
    const cx = door.x + door.width / 2;
    const cy = door.y + door.height / 2;
    const w = door.width;
    const zone =
      r === 90
        ? { x: cx - FIT_CHARACTER, y: cy - w / 2, width: 2 * FIT_CHARACTER, height: w }
        : { x: cx - w / 2, y: cy - FIT_CHARACTER, width: w, height: 2 * FIT_CHARACTER };
    for (const p of pieces)
      if (!p.hung && meets(p.box, zone))
        out.push({ rule: 'overlap', message: `${label(p.el)} stands in ${label(door)}'s way` });
      else if (p.hung && meets(p.box, grow(door, 2)))
        out.push({ rule: 'overlap', message: `${label(p.el)} hangs over ${label(door)}` });
  }
}

// --- Rule 3: reach ---------------------------------------------------------------------------------------------

type Grid = { x0: number; y0: number; cols: number; rows: number; free: Uint8Array };

function distToSegment(px: number, py: number, s: FenceSegment): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.a.x) * dx + (py - s.a.y) * dy) / len));
  return Math.hypot(px - (s.a.x + t * dx), py - (s.a.y + t * dy));
}

// The cells a character's middle can stand on, a half-width clear of every wall, fence, footprint and seat.
function walkingGrid(els: readonly Element[], pieces: readonly Piece[]): Grid {
  setModelFootprints(pieceFacing);
  let segs: FenceSegment[];
  try {
    // A hung piece blocks where it hangs (below), not where its drawing's box stood.
    segs = fenceSegments(els.filter((e) => !(e.type === 'shape' && mountsOnWall(e.shape))));
  } finally {
    setModelFootprints(null);
  }
  const boxes = shapesOf(els).map((e) => e as Box);
  const x0 = Math.min(...boxes.map((b) => b.x)) - 2 * CELL;
  const y0 = Math.min(...boxes.map((b) => b.y)) - 2 * CELL;
  const cols = Math.ceil((Math.max(...boxes.map((b) => b.x + b.width)) - x0) / CELL) + 4;
  const rows = Math.ceil((Math.max(...boxes.map((b) => b.y + b.height)) - y0) / CELL) + 4;
  const free = new Uint8Array(cols * rows).fill(1);
  const r = FIT_CHARACTER / 2;
  const mark = (b: Box, hit: (px: number, py: number) => boolean) => {
    const c0 = Math.max(0, Math.floor((b.x - r - x0) / CELL));
    const c1 = Math.min(cols - 1, Math.ceil((b.x + b.width + r - x0) / CELL));
    const r0 = Math.max(0, Math.floor((b.y - r - y0) / CELL));
    const r1 = Math.min(rows - 1, Math.ceil((b.y + b.height + r - y0) / CELL));
    for (let j = r0; j <= r1; j++)
      for (let i = c0; i <= c1; i++) {
        const px = x0 + (i + 0.5) * CELL;
        const py = y0 + (j + 0.5) * CELL;
        if (hit(px, py)) free[j * cols + i] = 0;
      }
  };
  for (const s of segs) {
    const b = {
      x: Math.min(s.a.x, s.b.x),
      y: Math.min(s.a.y, s.b.y),
      width: Math.abs(s.a.x - s.b.x),
      height: Math.abs(s.a.y - s.b.y),
    };
    mark(b, (px, py) => distToSegment(px, py, s) < r);
  }
  // Seats are walked onto, not through: each is in the way of everyone else's walk.
  for (const p of pieces) {
    // A board or a sign lies flat on its wall, inside the reach the wall already keeps; a shelf or a fire stands out.
    if (!seatsACharacter(p.el.shape) && !(p.hung && turnsWithFacing(p.el.shape))) continue;
    const b = p.box;
    mark(b, (px, py) => {
      const dx = Math.max(b.x - px, 0, px - (b.x + b.width));
      const dy = Math.max(b.y - py, 0, py - (b.y + b.height));
      return Math.hypot(dx, dy) < r;
    });
  }
  return { x0, y0, cols, rows, free };
}

function reachRule(els: readonly Element[], pieces: readonly Piece[], out: FitIssue[]): void {
  const pad = shapesOf(els).find((e) => e.shape === 'avatar-pad');
  if (!pad) return;
  const g = walkingGrid(els, pieces);
  const cell = (x: number, y: number) => ({
    i: Math.floor((x - g.x0) / CELL),
    j: Math.floor((y - g.y0) / CELL),
  });
  const seen = new Uint8Array(g.free.length);
  const queue: number[] = [];
  const feet = avatarPadCore(pad);
  const start = cell(feet.x, feet.y);
  // The nearest free cell to the pad's core.
  let best = -1;
  let bestD = Infinity;
  for (let dj = -6; dj <= 6; dj++)
    for (let di = -6; di <= 6; di++) {
      const i = start.i + di;
      const j = start.j + dj;
      if (i < 0 || j < 0 || i >= g.cols || j >= g.rows || !g.free[j * g.cols + i]) continue;
      if (di * di + dj * dj < bestD) {
        bestD = di * di + dj * dj;
        best = j * g.cols + i;
      }
    }
  if (best < 0) {
    out.push({ rule: 'reach', message: 'the Avatar Pad stands on no floor a character fits on' });
    return;
  }
  seen[best] = 1;
  queue.push(best);
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q]!;
    const i = at % g.cols;
    const j = (at - i) / g.cols;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.cols || nj >= g.rows) continue;
      const n = nj * g.cols + ni;
      if (seen[n] || !g.free[n]) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  const reached = (zone: Box) => {
    const a = cell(zone.x, zone.y);
    const b = cell(zone.x + zone.width, zone.y + zone.height);
    for (let j = Math.max(0, a.j); j <= Math.min(g.rows - 1, b.j); j++)
      for (let i = Math.max(0, a.i); i <= Math.min(g.cols - 1, b.i); i++)
        if (seen[j * g.cols + i]) return true;
    return false;
  };
  for (const p of pieces) {
    const kind = p.el.shape;
    const seat = seatsACharacter(kind);
    if (!seat && !USED.has(kind)) continue;
    // A microwave or a kettle on a worktop is reached at the worktop.
    if (
      ON_TOP[kind] &&
      pieces.some((q) => q !== p && ON_TOP[kind]!.includes(q.el.shape) && meets(p.el, q.el))
    )
      continue;
    // Where someone stands to use it: round a seat, in front of anything else, and behind a desk, where its sitter
    // sits facing out over it (seats.ts: a desk facing Down seats its sitter along its top).
    const reach = FIT_CHARACTER / 2 + 3 * CELL;
    let zone: Box;
    if ((seat && !DESKS.has(kind)) || !turnsWithFacing(kind)) zone = grow(p.box, reach);
    else {
      const front = FRONT[pieceFacing(p.el)];
      // A desk's sitter sits at its back, facing out over it, so they walk up to it from behind.
      const f = DESKS.has(kind) ? { x: -front.x, y: -front.y } : front;
      const b = p.box;
      zone =
        f.y === 1
          ? { x: b.x, y: b.y + b.height, width: b.width, height: reach }
          : f.y === -1
            ? { x: b.x, y: b.y - reach, width: b.width, height: reach }
            : f.x === 1
              ? { x: b.x + b.width, y: b.y, width: reach, height: b.height }
              : { x: b.x - reach, y: b.y, width: reach, height: b.height };
    }
    if (!reached(zone))
      out.push({
        rule: 'reach',
        message: `no walk a character's width wide reaches ${DESKS.has(kind) ? "the sitter's side of " : ''}${label(p.el)}`,
      });
  }
}

// --- Rule 4: shared walls --------------------------------------------------------------------------------------

function sharedWallRule(els: readonly Element[], out: FitIssue[]): void {
  const rooms = els.filter(sharesWallsByBox);
  const half = ROOM_WALL / 2;
  const inside = (a: Box, b: Box) =>
    a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
  const spanOverlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0);
  for (const [i, a] of rooms.entries())
    for (const b of rooms.slice(i + 1)) {
      if (inside(a, b) || inside(b, a)) continue;
      const name = `"${String(a.label ?? 'a room')}" and "${String(b.label ?? 'a room')}"`;
      // Side by side: their facing side walls' lines.
      const ys = spanOverlap(
        a.y + ROOM_BACK_FACE,
        a.y + a.height,
        b.y + ROOM_BACK_FACE,
        b.y + b.height,
      );
      if (ys > ROOM_WALL) {
        const [l, r] = a.x <= b.x ? [a, b] : [b, a];
        const gap = r.x + half - (l.x + l.width - half);
        if (Math.abs(gap) > 0.5 && gap < FIT_CORRIDOR)
          out.push({
            rule: 'shared-wall',
            message: `${name} ${gap < 0 ? 'overlap' : 'stand'} ${Math.round(Math.abs(gap))} px ${
              gap < 0 ? 'past one wall' : 'apart, a double wall'
            }`,
          });
        continue;
      }
      // One above the other: the upper one's front wall and the lower one's back wall.
      const xs = spanOverlap(a.x, a.x + a.width, b.x, b.x + b.width);
      if (xs > ROOM_WALL) {
        const [t, u] = a.y <= b.y ? [a, b] : [b, a];
        const gap = u.y + ROOM_BACK_FACE - half - (t.y + t.height - half);
        if (Math.abs(gap) > 0.5 && gap < FIT_CORRIDOR)
          out.push({
            rule: 'shared-wall',
            message: `${name} ${gap < 0 ? 'overlap' : 'stand'} ${Math.round(Math.abs(gap))} px ${
              gap < 0 ? 'past one wall' : 'apart, a double wall'
            }`,
          });
      }
    }
}

// --- Rule 6: indoor furniture indoors ----------------------------------------------------------------------------

// The furniture made for indoors (the owner, 2026-11-27: "some templates seem to put an indoor chair outside which is
// weird, don't do that"). Outdoors keeps its own: a Bench, a Picnic Table, a Hammock, a Garden Umbrella, a Campfire, a
// Ping-Pong Table, Outdoor Plants and Trees. A bar and its stools out of doors stand in a tent (a room).
export const INDOOR_ONLY: ReadonlySet<string> = new Set([
  'chair',
  'desk',
  'standing-desk',
  'hot-desk',
  'sofa',
  'meeting-table',
  'reception-desk',
  'bookshelf',
  'reading-nook',
  'bean-bag',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  'fridge',
  'kitchen-counter',
  'kitchen-sink',
  'microwave',
  'kettle',
  'coffee-machine',
  'water-cooler',
  'vending-machine',
  'arcade-machine',
  'jukebox',
  'fireplace',
  'pool-table',
  'foosball-table',
  'printer',
  'copier',
  'lockers',
  'coat-rack',
  'toilet-cubicle',
  'washbasin',
  'floor-lamp',
  'nap-pod',
  'treadmill',
  'weight-bench',
]);

// Pieces that are a small room of their own: what stands in one is indoors.
const ENCLOSES = new Set(['office-pod', 'phone-booth']);

// A site out of doors: a lawn, or paths across sand or a roof. Out of its rooms is open air; a building's floor with no
// lawn or path (a lobby, an open-plan office) is indoors all over.
const OPEN_AIR = new Set(['grass', 'garden-path', 'road']);

function indoorRule(els: readonly Element[], pieces: readonly Piece[], out: FitIssue[]): void {
  if (!shapesOf(els).some((e) => OPEN_AIR.has(e.shape))) return;
  const pods = shapesOf(els).filter((e) => ENCLOSES.has(e.shape));
  for (const p of pieces) {
    if (!INDOOR_ONLY.has(p.el.shape)) continue;
    const mid = { x: p.box.x + p.box.width / 2, y: p.box.y + p.box.height / 2 };
    if (roomAt(els, mid)) continue;
    if (pods.some((q) => meets(q, { ...mid, width: 1, height: 1 }))) continue;
    out.push({ rule: 'indoor', message: `${label(p.el)} stands outdoors` });
  }
}

// --- Rule 7: roads out of doors ------------------------------------------------------------------------------------

// A Road is for outside (docs/specs/009-elements/road.md "Out of doors only"): no car drives through an office.
function outdoorRule(els: readonly Element[], out: FitIssue[]): void {
  for (const r of shapesOf(els)) {
    if (r.shape !== 'road') continue;
    if (roomAt(els, { x: r.x + r.width / 2, y: r.y + r.height / 2 }))
      out.push({ rule: 'outdoor', message: `${r.id} (road) lies indoors` });
  }
}

/** Every way a tab's layout fails the 3D view, by rule; empty when it fits. */
export function template3dFit(elements: readonly Element[]): FitIssue[] {
  const out: FitIssue[] = [];
  const pieces = bodies(elements);
  wallRule(elements, pieces, out);
  facingRule(elements, pieces, out);
  overlapRule(elements, pieces, out);
  reachRule(elements, pieces, out);
  sharedWallRule(elements, out);
  indoorRule(elements, pieces, out);
  outdoorRule(elements, out);
  return out;
}
