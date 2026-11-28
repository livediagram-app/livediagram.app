// Real 3D's pieces (docs/specs/008-canvas/3d-engine.md "The scene"): every piece that stands, built from its model
// and laid on the canvas at its frame, all into one geometry (one draw for the lot), rebuilt only when the board
// changes. Built from the board alone, so every viewer's scene is the same. Pure: no three.js, no DOM.

import type { Element } from '@livehuddle/document';
import { localClock } from '@/lib/minute-clock';
import { RISE } from './models/kit';
import {
  meetingPieceRoom,
  mountedFace,
  mountsOnWall,
  turnsWithFacing,
  type MountedFace,
  pieceArt,
  pieceMaterial,
  pieceVariant,
  roomZones,
  type CallZone,
} from '@livehuddle/document';
import { seatFabric } from '@livehuddle/avatar/furniture-art';
import { isSeatingShape, seatsACharacter } from '@livehuddle/avatar/office-geometry';
import { seatPoints } from '@livehuddle/avatar/seats';
import { standsIn3D } from '@/lib/space-3d/space-3d-pieces';
import {
  canvasToFrame,
  frameToCanvas,
  pieceFrame,
  type PieceBox,
  type PieceFrame,
} from './piece-frame';
import { WALL_THICKNESS } from './scene-walls';
import { pieceTones } from './piece-tones';
import { buildModel } from './models';
import { MeshBuilder } from './mesh-builder';
import { STAGE_DECK, STAGE_STEP, stageSteps } from './models/stage';
import { modelBounds, type PieceBounds } from './piece-pick';

const DEFAULT_STROKE = '#94a3b8';

const FORWARD: Record<string, readonly [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  right: [1, 0],
  left: [-1, 0],
};

/** A seat's facing (the way its sitter faces on the canvas) as the model's frame sees it, turned back by its yaw. */
export function facingInFrame(f: { yaw: number }, facing: string): string {
  const [dx, dy] = FORWARD[facing] ?? [0, 1];
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const x = dx * c + dy * s;
  const y = -dx * s + dy * c;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
}

/**
 * The kinds that lie flat but have parts that stand: an Office Pod's furniture, a Car Park's cars, the Avatar Pad, a
 * Stage's raised deck (models/stage.ts) and the Pond, sunk into the ground (models/pond.ts).
 */
const FLAT_WITH_STANDING = new Set([
  'office-pod',
  'car-park',
  'avatar-pad',
  'stage',
  'pond',
  // A Road's kerbs stand a little proud of its asphalt (models/road.ts).
  'road',
  // Stairs lie flat to the walk (taken by walking on) but stand up as a flight (models/stairs.ts).
  'stairs',
]);

/** Whether a piece is drawn by real 3D: one that stands, and a flat one's standing parts. */
export function modelled(el: Element): el is Extract<Element, { type: 'shape' }> {
  return el.type === 'shape' && (FLAT_WITH_STANDING.has(el.shape) || standsIn3D(el));
}

/** The pieces' one geometry, and each piece's box for presses (piece-pick.ts). */
export class PiecesMesh extends MeshBuilder {
  bounds: PieceBounds[] = [];
  /** Where each piece's corners sit in `positions` (in corners, from and to), so one can be lifted out to move. */
  ranges = new Map<string, { from: number; to: number }>();
  /** Each piece's screens (MeshBuilder.glows), as corner ranges of `positions`, that light while someone sits there. */
  screens = new Map<string, number[]>();
  /** Where each piece's glass corners and line ends sit (in floats, from and to), lifted out with it. */
  spans = new Map<string, { glass: [number, number]; lines: [number, number] }>();
  /** Each Poster's picture place on the canvas (MeshBuilder.pictures, laid and risen), twelve numbers. */
  posterPictures = new Map<string, number[]>();
  /** Each Screen's glass place on the canvas (MeshBuilder.pictures, laid and risen), where an idle one shows the logo. */
  screenFaces = new Map<string, number[]>();

  override rise(k: number): this {
    super.rise(k);
    for (const map of [this.posterPictures, this.screenFaces])
      for (const corners of map.values())
        for (let i = 2; i < corners.length; i += 3) corners[i]! *= k;
    return this;
  }
}

/**
 * Each piece's model, laid on the canvas, kept by the element it was built from (with what else it was built from: a
 * Room Sign's room name, a wall piece's wall face): a board change hands back the same object for every piece it did
 * not touch, so a drag rebuilds only the pieces it moves (building every model each frame of a drag took 23 ms on
 * Virtual Office, more than a frame).
 */
const built = new WeakMap<Element, { key: string; mesh: PiecesMesh | null }>();
/** Each Room Sign's last room name, for a build that is handed the sign without its room (a drag, a placement). */
const lastSignName = new Map<string, string>();
const SIGN_NAMES_MAX = 256;

/** The name a Room Sign shows (screen-and-room-sign.md "The name"): its room's label, Office Pod, or No Room. */
function signName(
  el: Element,
  zones: readonly CallZone[] | null,
  rooms: ReadonlyMap<string, Element>,
): string {
  if (!zones || zones.length === 0) return lastSignName.get(el.id) ?? 'No Room';
  const id = meetingPieceRoom(el as unknown as PieceBox, zones);
  const room = id ? rooms.get(id) : undefined;
  const label = (room as { label?: unknown } | undefined)?.label;
  const name =
    typeof label === 'string' && label.trim()
      ? label.trim()
      : room && room.type === 'shape' && room.shape === 'office-pod'
        ? 'Office Pod'
        : room
          ? 'Room'
          : 'No Room';
  if (lastSignName.size >= SIGN_NAMES_MAX && !lastSignName.has(el.id))
    lastSignName.delete(lastSignName.keys().next().value!);
  lastSignName.set(el.id, name);
  return name;
}

function pieceOf(
  el: Extract<Element, { type: 'shape' }>,
  label?: string,
  face?: MountedFace | null,
): PiecesMesh | null {
  const key = `${label ?? ''}|${face ? `${face.line},${face.vertical ? 1 : 0},${face.dir}` : ''}`;
  const hit = built.get(el);
  if (hit && hit.key === key) return hit.mesh;
  let one: PiecesMesh | null = new PiecesMesh();
  try {
    addPiece(one, el, label, face);
    one.rise(RISE);
    for (const b of one.bounds) {
      b.z1 *= RISE;
      if (b.z0 !== undefined) b.z0 *= RISE;
    }
  } catch {
    // A piece whose model cannot be built is left out rather than taking the scene down.
    one = null;
  }
  built.set(el, { key, mesh: one });
  return one;
}

/** How far a wall's face stands from its line in the 3D view: half a plaster wall (scene-walls.ts WALL_THICKNESS). */
const WALL_FACE = WALL_THICKNESS.wall / 2;

/**
 * A wall piece's frame hung flat on its wall face (3d-engine.md "Wall pieces sit on their wall"): its back on the
 * face, its front out from the wall, its width along the wall about its middle, whichever wall it is on, so a sign
 * by a side wall's door lies on that wall rather than standing out from it like a blade, and none floats off its wall.
 */
export function hungFrame(f: PieceFrame, box: PieceBox, face: MountedFace): PieceFrame {
  // A piece that keeps the room's facing (a Screen, a Room Sign) lies along the wall at its own width.
  const turns = turnsWithFacing(box.shape);
  const W = turns ? f.W : box.width;
  const D = turns ? f.D : box.height;
  const foot = turns ? f.foot : { x0: -W / 2, y0: -D / 2, x1: W / 2, y1: D / 2 };
  // Its back (the footprint's back edge, the model's least y) against the wall's face: a turning piece's model stands
  // on its footprint, often only the front part of its box, so centring the box there left it standing well off the
  // wall (a back-wall bookshelf about 0.75 of its depth out, found 2026-11-27).
  const across = face.line + face.dir * (WALL_FACE - foot.y0);
  const mid = face.vertical ? box.y + box.height / 2 : box.x + box.width / 2;
  // Its front, the model's +y, out from the wall: down, up, right or left the canvas.
  const yaw = face.vertical
    ? face.dir === 1
      ? -Math.PI / 2
      : Math.PI / 2
    : face.dir === 1
      ? 0
      : Math.PI;
  return {
    ...f,
    cx: face.vertical ? across : mid,
    cy: face.vertical ? mid : across,
    yaw,
    W,
    D,
    foot,
  };
}

/** Appends `src` to `dst`; with `lift`, every third value (a point's z) raised by it. */
function append(dst: number[], src: readonly number[], lift = 0): void {
  const at = dst.length;
  dst.length = at + src.length;
  for (let i = 0; i < src.length; i++) dst[at + i] = src[i]! + (lift && i % 3 === 2 ? lift : 0);
}

/** A piece's fabric or body colour (its drawing's wash), as its model is painted. */
export function pieceFabric(el: Extract<Element, { type: 'shape' }>): string {
  const box = el as unknown as { fillColor?: string };
  return isSeatingShape(el.shape)
    ? seatFabric(el.shape, box.fillColor)
    : pieceMaterial(el.shape, box.fillColor);
}

/** Every modelled piece, laid on the canvas, as one geometry. */
export function piecesMesh(
  elements: readonly Element[],
  // The whole board, for the walls a wall piece hangs on, when only some of its pieces are built.
  board: readonly Element[] = elements,
): PiecesMesh {
  const out = new PiecesMesh();
  // The rooms a Room Sign names, found only when the board holds a sign.
  const hasSign = elements.some((el) => el.type === 'shape' && el.shape === 'room-sign');
  const zones = hasSign ? roomZones(elements) : null;
  const rooms = hasSign ? new Map(elements.map((el) => [el.id, el] as const)) : new Map();
  // What stands on a Stage stands on its deck (3d-view.md "A stage stands up"): a Podium, a mic, the curtains.
  const decks = stageDecks(elements);
  for (const el of elements) {
    if (!modelled(el)) continue;
    const one = pieceOf(
      el,
      el.shape === 'room-sign' ? signName(el, zones, rooms) : undefined,
      mountsOnWall(el.shape) ? mountedFace(el, board) : null,
    );
    if (!one) continue;
    const lift =
      decks.length > 0 && el.shape !== 'stage'
        ? floorHeightAt(decks, el.x + el.width / 2, el.y + el.height / 2, 0)
        : 0;
    const from = out.positions.length / 3;
    const glassFrom = out.glassPositions.length;
    const linesFrom = out.lines.length;
    append(out.positions, one.positions, lift);
    append(out.normals, one.normals);
    append(out.colours, one.colours);
    append(out.lines, one.lines, lift);
    append(out.glassPositions, one.glassPositions, lift);
    append(out.glassNormals, one.glassNormals);
    append(out.glassColours, one.glassColours);
    for (const b of one.bounds)
      out.bounds.push(lift ? { ...b, z0: (b.z0 ?? 0) + lift, z1: b.z1 + lift } : b);
    out.ranges.set(el.id, { from, to: out.positions.length / 3 });
    const lit = one.screens.get(el.id);
    if (lit)
      out.screens.set(
        el.id,
        lit.map((v) => v + from),
      );
    out.spans.set(el.id, {
      glass: [glassFrom, out.glassPositions.length],
      lines: [linesFrom, out.lines.length],
    });
    for (const [from, to] of [
      [one.posterPictures, out.posterPictures],
      [one.screenFaces, out.screenFaces],
    ] as const) {
      const picture = from.get(el.id);
      if (picture)
        to.set(el.id, lift ? picture.map((v, i) => (i % 3 === 2 ? v + lift : v)) : picture);
    }
  }
  return out;
}

function addPiece(
  out: PiecesMesh,
  el: Extract<Element, { type: 'shape' }>,
  label?: string,
  face?: MountedFace | null,
): void {
  const box = el as unknown as PieceBox & { fillColor?: string; strokeColor?: string };
  const f = face ? hungFrame(pieceFrame(box), box, face) : pieceFrame(box);
  const kind = el.shape;
  const seat = pieceFabric(el);
  const art = pieceArt(kind);
  const t = pieceTones(art, seat, box.strokeColor ?? DEFAULT_STROKE);
  let seats: { x: number; y: number; facing: string }[] = [];
  if (seatsACharacter(kind)) {
    try {
      seats = seatPoints(el as never).map((s) => ({
        ...canvasToFrame(f, s),
        facing: facingInFrame(f, s.facing),
      }));
    } catch {
      seats = [];
    }
  }
  // A Stage's plate carries its own name, and its deck its own fill (models/stage.ts).
  const stage = kind === 'stage';
  const m = buildModel(kind, {
    f,
    t,
    seats,
    variant: pieceVariant(el) || undefined,
    label: stage ? (typeof el.label === 'string' ? el.label : undefined) : label,
    fill: stage ? box.fillColor : undefined,
    clock: kind === 'world-clock' ? localClock(Date.now()) : undefined,
  });
  const extent = modelBounds([...m.positions, ...m.glassPositions]);
  if (extent)
    out.bounds.push({
      id: el.id,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      f,
      ...extent,
    });
  const lay = (src: number[], dst: number[]) => {
    for (let i = 0; i < src.length; i += 3) {
      const p = frameToCanvas(f, src[i]!, src[i + 1]!);
      dst.push(p.x, p.y, src[i + 2]!);
    }
  };
  // Normals turn with the piece (no move: a direction).
  const turn = (src: number[], dst: number[]) => {
    const c = Math.cos(f.yaw);
    const s = Math.sin(f.yaw);
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i]!;
      const y = src[i + 1]!;
      dst.push(x * c - y * s, x * s + y * c, src[i + 2]!);
    }
  };
  const base = out.positions.length / 3;
  if (m.glows.length > 0)
    out.screens.set(
      el.id,
      m.glows.map((v) => v + base),
    );
  lay(m.positions, out.positions);
  turn(m.normals, out.normals);
  turn(m.glassNormals, out.glassNormals);
  out.colours.push(...m.colours);
  lay(m.lines, out.lines);
  lay(m.glassPositions, out.glassPositions);
  out.glassColours.push(...m.glassColours);
  // A Poster's picture place (models/poster.ts), or a Screen's glass (models/first.ts), laid on the canvas as the rest
  // of it.
  if (m.pictures.length === 12) {
    const corners: number[] = [];
    lay(m.pictures, corners);
    (kind === 'screen' ? out.screenFaces : out.posterPictures).set(el.id, corners);
  }
}

/**
 * A raised top a character stands on: an Avatar Pad's (a circle on the canvas, `rx` by `ry` about its middle), or a
 * Stage's deck and each of its steps (`box`: a rectangle `rx` by `ry` either side of its middle, turned by `yaw`). `z`
 * is how high it stands as drawn; absent, the height the caller gives (a pad's).
 */
export type PadTop = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  box?: boolean;
  yaw?: number;
  z?: number;
};

/** Every Stage's deck and steps, as raised tops (models/stage.ts builds them on the same boxes). */
function stageDecks(elements: readonly Element[]): PadTop[] {
  const out: PadTop[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'stage') continue;
    const f = pieceFrame(el);
    const { x0, y0, x1, y1 } = f.foot;
    const top = (fx0: number, fy0: number, fx1: number, fy1: number, z: number) => {
      const c = frameToCanvas(f, (fx0 + fx1) / 2, (fy0 + fy1) / 2);
      out.push({
        cx: c.x,
        cy: c.y,
        rx: (fx1 - fx0) / 2,
        ry: (fy1 - fy0) / 2,
        box: true,
        yaw: f.yaw,
        z,
      });
    };
    top(x0, y0, x1, y1, STAGE_DECK * RISE);
    for (const s of stageSteps(x1 - x0))
      top(x0 + s.x0, y1 + s.y0, x0 + s.x0 + STAGE_STEP.width, y1 + s.y1, s.z * RISE);
  }
  return out;
}

/** Every Avatar Pad's top and every Stage's deck and steps (models/pad.ts and models/stage.ts build them). */
export function padTops(elements: readonly Element[]): PadTop[] {
  const out: PadTop[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'avatar-pad') continue;
    const f = pieceFrame(el);
    // Round, as wide as the box's narrower side (models/pad.ts).
    const r = Math.min(f.foot.x1 - f.foot.x0, f.foot.y1 - f.foot.y0) / 2;
    const c = frameToCanvas(f, (f.foot.x0 + f.foot.x1) / 2, (f.foot.y0 + f.foot.y1) / 2);
    out.push({ cx: c.x, cy: c.y, rx: r, ry: r });
  }
  out.push(...stageDecks(elements));
  return out;
}

/** How high the floor stands under a point: the top it stands on (its own height, else `height`), else 0. */
export function floorHeightAt(
  pads: readonly PadTop[],
  x: number,
  y: number,
  height: number,
): number {
  for (const p of pads) {
    const dx = x - p.cx;
    const dy = y - p.cy;
    if (p.box) {
      const c = Math.cos(p.yaw ?? 0);
      const s = Math.sin(p.yaw ?? 0);
      if (Math.abs(dx * c + dy * s) <= p.rx && Math.abs(-dx * s + dy * c) <= p.ry)
        return p.z ?? height;
      continue;
    }
    const u = dx / p.rx;
    const v = dy / p.ry;
    if (u * u + v * v <= 1) return p.z ?? height;
  }
  return 0;
}
