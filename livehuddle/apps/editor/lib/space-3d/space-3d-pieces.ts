// The pieces the 3D view stands up (docs/specs/008-canvas/3d-view.md "Pieces stand up"; blueprint: 3d-view.md): every
// piece of the Space drawn upright in the flat plan turns up about its front edge to face the camera, as the
// characters do. Which kinds stand, which of them are near enough to stand now, how far a sitter is lifted in front
// of the piece it sits on, and the piece under a press on the tilted screen. Pure: no React, no DOM.

import type { Element, ShapeKind } from '@livehuddle/document';
import type { SpaceArea } from './space-3d-cutaway';
import { boxToCamera, toCamera, turnQuarter } from './space-3d-turn';

/** The attribute a standing piece's box carries: `base` turns about its front edge, `centre` (a turned piece) its middle. */
export const SPACE_STANDS_ATTR = 'data-space-stands';
/** Set (outside React) on the standing pieces in the view area: only these turn up. */
export const SPACE_NEAR_ATTR = 'data-space-near';

/** A sitter whose feet are within this share of the piece's depth of its front edge is drawn in front of it (DEFAULTS.md D144). */
export const SPACE_SEAT_LIFT_SHARE = 0.6;

// The Space's shape kinds that lie on the floor (3d-view.md "Which pieces"): floor coverings, the pieces whose walls
// stand instead, a wall's own parts, and the board's controls. Every other shape kind stands.
const FLAT_KINDS = new Set<ShapeKind>([
  'room',
  'corridor',
  'office-pod',
  'fence',
  'garden-fence',
  'door',
  'window',
  'rug',
  'grass',
  'garden-path',
  'stage',
  'pond',
  'swimming-pool',
  'car-park',
  'stairs',
  'avatar-pad',
  'mode-button',
  'focus-button',
  'timer',
  'stopwatch',
  'icon',
  'sticker',
]);

/** Whether an element's flat drawing hides in the 3D view because its wall stands instead: a Fence and a Garden Fence. */
export function walledIn3D(el: Element): boolean {
  return el.type === 'shape' && (el.shape === 'fence' || el.shape === 'garden-fence');
}

/** Whether an element stands up in the 3D view: a shape of the Space drawn upright. */
export function standsIn3D(el: Element): el is Extract<Element, { type: 'shape' }> {
  return el.type === 'shape' && !FLAT_KINDS.has(el.shape);
}

/** Whether a piece lies flat but stands its furniture up inside its walls in the 3D view: an Office Pod. */
export function standsInside3D(el: Element): el is Extract<Element, { type: 'shape' }> {
  return el.type === 'shape' && el.shape === 'office-pod';
}

// The pieces built row by row in the 3D view (3d-view.md "Tables are built, not stood"): their drawings carry rows.
// The Car Park lies flat but its cars stand in their bays (3d-view.md "Cars stand in their bays").
const ROWED_KINDS: ReadonlySet<string> = new Set(['meeting-table', 'picnic-table', 'car-park']);

/** Whether a piece is built row by row in the 3D view: a table with its chairs or benches, not turned. */
export function builtIn3D(el: Element): el is Extract<Element, { type: 'shape' }> {
  return (
    el.type === 'shape' &&
    ROWED_KINDS.has(el.shape) &&
    ((el as { rotation?: number }).rotation ?? 0) % 360 === 0
  );
}

/**
 * The value of a standing piece's attribute: `base` or `centre` for a piece that stands, `inside` for one whose
 * furniture stands inside its walls, `rows` for one built row by row, `raised` for a Stage whose top rises, undefined
 * for one that lies flat.
 */
export function standAttr(
  el: Element,
): 'base' | 'centre' | 'inside' | 'rows' | 'raised' | 'along' | undefined {
  // A Stage's top rises on its sides (3d-view.md "A stage stands up").
  if (el.type === 'shape' && el.shape === 'stage') return 'raised';
  // A backdrop stands on its own line as a wall does, so a turned camera never swings it in front of its stage.
  if (el.type === 'shape' && STANDS_ALONG.has(el.shape)) return 'along';
  if (standsInside3D(el)) return 'inside';
  if (builtIn3D(el)) return 'rows';
  if (!standsIn3D(el)) return undefined;
  return ((el as { rotation?: number }).rotation ?? 0) % 360 === 0 ? 'base' : 'centre';
}

/** The standing pieces whose box meets the area, by id: the ones that turn up now. */
export function standingIdsInArea(elements: readonly Element[], area: SpaceArea): Set<string> {
  const out = new Set<string>();
  for (const el of elements) {
    if (!standsIn3D(el) && !standsInside3D(el) && !builtIn3D(el)) continue;
    if (
      el.x + el.width >= area.left &&
      el.x <= area.right &&
      el.y + el.height >= area.top &&
      el.y <= area.bottom
    )
      out.add(el.id);
  }
  return out;
}

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

/**
 * How far in front of its feet a sitter's figure is drawn, in canvas px along the floor: the distance to the front
 * edge of the piece it sits on, so every sitter is drawn over the standing piece as the flat plan draws them (a chair,
 * a sofa, a table's near side and its far side, behind a desk). The stylesheet turns it into a nudge towards the
 * camera; 0 for a sitter off the piece's box.
 */
export function seatLift(piece: Box | null | undefined, feet: Point, turn = 0): number {
  if (!piece) return 0;
  // Turned (3d-view.md "Turning the camera"): measured along the camera's way.
  if (turnQuarter(turn) !== 0) return seatLift(boxToCamera(piece, turn), toCamera(feet, turn));
  const depth = piece.y + piece.height - feet.y;
  return depth >= 0 && depth <= piece.height ? Math.ceil(depth) + 1 : 0;
}

/**
 * Whether a sitter sits behind the piece (further back than SPACE_SEAT_LIFT_SHARE of its depth: a table's far side,
 * behind a desk): the piece then hides their legs, so they read as sitting behind it, not on it (3d-view.md "Pieces
 * stand up").
 */
export function seatBehind(piece: Box | null | undefined, feet: Point, turn = 0): boolean {
  // A piece built row by row hides a sitter's legs itself, with its own rows (3d-view.md "Tables are built").
  if (!piece || (piece as { rows?: true }).rows) return false;
  if (turnQuarter(turn) !== 0) return seatBehind(boxToCamera(piece, turn), toCamera(feet, turn));
  const depth = piece.y + piece.height - feet.y;
  return depth > piece.height * SPACE_SEAT_LIFT_SHARE && depth <= piece.height;
}

type Rect = { left: number; top: number; width: number; height: number };

// How near the camera a box's nearest edge is, along the camera's way (bigger is nearer).
function nearEdge(box: Box, turn: number): number {
  const b = boxToCamera(box, turn);
  return b.y + b.height;
}

/** A standing piece's box on the floor and where its drawing shows on the screen. */
export type StandingOnScreen = { box: Box; rect: Rect; rotated: boolean };

/**
 * The canvas point a press on a standing piece stands for, or null when it is over none: of the pieces whose drawing
 * holds the press, the nearest the camera (the lowest front edge); the press mapped back into its box, since a piece
 * faces the camera and its drawing is its box scaled. A turned piece answers with its middle.
 */
export function standingPiecePointAt(
  pieces: readonly StandingOnScreen[],
  client: Point,
  // The camera's quarter turns (3d-view.md "Turning the camera"): turned, the nearest is the camera's nearest, and a
  // piece answers with its middle (its drawing no longer maps onto its box).
  turn = 0,
): Point | null {
  let best: StandingOnScreen | null = null;
  for (const p of pieces) {
    const { rect } = p;
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (
      client.x < rect.left ||
      client.x > rect.left + rect.width ||
      client.y < rect.top ||
      client.y > rect.top + rect.height
    )
      continue;
    if (!best || nearEdge(p.box, turn) > nearEdge(best.box, turn)) best = p;
  }
  if (!best) return null;
  const { box, rect } = best;
  if (best.rotated || turnQuarter(turn) !== 0)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return {
    x: box.x + ((client.x - rect.left) / rect.width) * box.width,
    y: box.y + ((client.y - rect.top) / rect.height) * box.height,
  };
}

// The pieces that hang on a wall (3d-view.md "Wall pieces hang on the wall"): a board, a clock, a dartboard, the
// calendar and photo walls, a hand dryer, a meeting Screen and a Room Sign.
const HUNG_KINDS: ReadonlySet<string> = new Set([
  'notice-board',
  'world-clock',
  'dartboard',
  'calendar-wall',
  'photo-wall',
  'hand-dryer',
  'screen',
  'room-sign',
]);

/** How far below a back wall's line a wall piece's top may sit and still hang on it, in canvas px (008-canvas DEFAULTS.md D147). */
export const SPACE_HANG_REACH = 64;
/** How far below a wall piece's foot a wall's line may run and the piece still hang on it, in canvas px. */
export const SPACE_HANG_ACROSS = 24;
/** How high up its wall a hung piece's foot sits, in canvas px (008-canvas DEFAULTS.md D147). */
export const SPACE_HANG_LIFT = 10;

type WallLine = { a: Point; b: Point; kind: string };

/** Whether a piece of this kind hangs on a wall in the 3D view. */
export function hangsOnWall(kind: string): boolean {
  return HUNG_KINDS.has(kind);
}

/** A piece's rotation on the plan in clockwise quarter turns (0 to 3), or null for any other angle. */
export function pieceQuarters(el: Element): number | null {
  const r = ((((el as { rotation?: number }).rotation ?? 0) % 360) + 360) % 360;
  return r % 90 === 0 ? r / 90 : null;
}

/**
 * Whether a piece is drawn as the turned camera sees it (3d-view.md "Turning the camera"): a piece that stands on its
 * front edge or is built row by row, unturned on the canvas, not hung on a wall. It then shows the side the camera
 * looks at (its back from behind) rather than turning with you.
 */
export function seenFromCamera(el: Element): boolean {
  // A backdrop stands on its own line and is seen from wherever the camera is.
  if (el.type !== 'shape' || hangsOnWall(el.shape) || STANDS_ALONG.has(el.shape)) return false;
  if (standsInside3D(el)) return false;
  // A piece turned by quarter turns on the plan (a sofa facing into the room, lockers along a side wall) is seen as
  // the camera sees it too (the owner, 2026-11-18: they looked "like they are floating in the air on one side").
  if (pieceQuarters(el) === null) return false;
  return standsIn3D(el) || builtIn3D(el);
}

/**
 * Where a wall piece hangs in the 3D view: the back wall (a level wall facing the camera) just above it in the plan,
 * across its middle, as how far its foot moves up the floor to that wall's line (canvas px, negative), or null for a
 * piece of another kind or with no such wall (it then stands where it is, as any piece does).
 */
export function hangOnWall(el: Element, walls: readonly WallLine[]): number | null {
  if (el.type !== 'shape' || !HUNG_KINDS.has(el.shape)) return null;
  if (((el as { rotation?: number }).rotation ?? 0) % 360 !== 0) return null;
  const mid = el.x + el.width / 2;
  const foot = el.y + el.height;
  let best: number | null = null;
  // A piece placed over a wall's line, or just behind it (a Room Sign beside a door on the corridor side): it hangs on
  // that wall's face too, never lying flat where the wall would clip it (the owner, 2026-11-18).
  let across: number | null = null;
  for (const w of walls) {
    if (w.kind !== 'wall' && w.kind !== 'glass' && w.kind !== 'window' && w.kind !== 'doorway')
      continue;
    if (Math.abs(w.a.y - w.b.y) > 1) continue;
    if (mid < Math.min(w.a.x, w.b.x) || mid > Math.max(w.a.x, w.b.x)) continue;
    const y = (w.a.y + w.b.y) / 2;
    if (y > el.y + el.height / 2) {
      if (y - foot <= SPACE_HANG_ACROSS && (across === null || y < across)) across = y;
      continue;
    }
    if (el.y - y > SPACE_HANG_REACH) continue;
    // The nearest such wall above it; a hair in front of its face so the piece is never inside it.
    if (best === null || y > best) best = y;
  }
  const at = best ?? across;
  return at === null ? null : at + 1 - foot;
}

/** The gap a grown Screen keeps from each end of its wall, in canvas px. */
export const SPACE_SCREEN_MARGIN = 16;

/**
 * How wide a hung Screen may grow along its wall (the owner, 2026-11-18: "as large as possible on that wall to make
 * watching it easier"): twice the room from its middle to the nearer end of the run of wall it hangs on, less a
 * margin, so it grows about its middle and never over a corner, a window or a doorway. Null for any other piece or no
 * such wall. `dy` is hangOnWall's answer for it.
 */
export function screenRoomOnWall(
  el: Element,
  walls: readonly WallLine[],
  dy: number,
): number | null {
  if (el.type !== 'shape' || el.shape !== 'screen') return null;
  const mid = el.x + el.width / 2;
  const line = el.y + el.height + dy - 1;
  for (const w of walls) {
    if (w.kind !== 'wall' && w.kind !== 'glass') continue;
    if (Math.abs(w.a.y - w.b.y) > 1 || Math.abs((w.a.y + w.b.y) / 2 - line) > 1) continue;
    const lo = Math.min(w.a.x, w.b.x);
    const hi = Math.max(w.a.x, w.b.x);
    if (mid < lo || mid > hi) continue;
    return Math.max(0, 2 * (Math.min(mid - lo, hi - mid) - SPACE_SCREEN_MARGIN));
  }
  return null;
}

/** Whether a facing shows a piece's side drawing: its back to the east or the west. */
export function isSideFacing(facing: string): boolean {
  return facing === 'e' || facing === 'w';
}

/**
 * The kinds whose side drawing is an upright elevation of the piece's end (a chair, a jukebox, a treadmill), so it
 * stands up as it is. Every other kind's side drawing is the flat plan's view from above, turned (a desk's top, a
 * sofa's seat, a counter's worktop), which stood up lies the piece on its side (the owner, 2026-11-18: "the Printer,
 * its lying on its side"); side on, those show the end of their front drawing instead (`endSlice`).
 */
export const SIDE_IS_ELEVATION: ReadonlySet<string> = new Set([
  'chair',
  'water-cooler',
  'coffee-machine',
  'bar-stool',
  'jukebox',
  'arcade-machine',
  'fireplace',
  'vending-machine',
  'bean-bag',
  'reading-nook',
  'kettle',
  'washbasin',
  'podium',
  'nap-pod',
  'treadmill',
  'weight-bench',
  'phone-booth',
  'suggestion-box',
  'fridge',
  'hammock',
]);

/**
 * The end of a piece's front drawing the 3D view shows when the camera sees its side (3d-view.md "Turning the
 * camera"), in the drawing's own units: a strip about as wide as the piece is deep, from its left end seen from the east and its right end from the west. A desk's end is its leg
 * and the edge of its top, a sofa's its arm, a bookshelf's its side: upright, at the piece's height, on its foot.
 */
export function endSlice(
  front: { width: number; height: number },
  side: { width: number },
  facing: 'e' | 'w',
): { x: number; width: number } {
  // A side drawing seen from above is the plan's box turned, its width the front's height rather than the piece's
  // depth, so the end is no wider than half the front either way: a desk's leg and the edge of its top.
  const width = Math.min(side.width, front.width / 2, front.height / 2);
  return { x: facing === 'e' ? 0 : front.width - width, width };
}

/**
 * How far a piece seen as the camera sees it moves its drawing towards the camera, in the drawing's own turned frame
 * (canvas px): from standing about its footprint's middle to standing on the footprint's edge nearest the camera, so
 * what you see covers the ground that blocks you (3d-view.md "Turning the camera").
 */
export function seenFootShift(
  box: { width: number; height: number },
  quarter: number,
  standHeight: number,
): number {
  const depth = turnQuarter(quarter) % 2 === 1 ? box.width : box.height;
  return (depth - standHeight) / 2;
}

/** The pieces that stand along their own line like a wall, never turning to the camera (3d-view.md "A stage stands up"). */
const STANDS_ALONG: ReadonlySet<string> = new Set(['stage-curtains']);

/** How high a Stage stands in the 3D view, in canvas px (3d-view.md "A stage stands up"; DEFAULTS.md D148). */
export const SPACE_STAGE_LIFT = 20;

/** How far up a character at `at` stands: on a Stage's top, its height; else on the floor. */
export function standsRaised(
  stages: readonly { x: number; y: number; width: number; height: number }[],
  at: { x: number; y: number } | null | undefined,
): number {
  if (!at) return 0;
  for (const s of stages)
    if (at.x >= s.x && at.x <= s.x + s.width && at.y >= s.y && at.y <= s.y + s.height)
      return SPACE_STAGE_LIFT;
  return 0;
}

/**
 * The flat pieces whose drawing is a picture to read rather than a floor covering: an Avatar Pad (drawn as a disc seen
 * from the room's camera) and the board's controls. In the 3D view they turn with the camera about their middle, as
 * words on the floor do, so a turned camera never shows a pad as a sideways ellipse or a control on its side (the
 * owner, 2026-11-18: "nor avatar landing pads").
 */
const FACES_CAMERA: ReadonlySet<string> = new Set([
  'avatar-pad',
  'mode-button',
  'focus-button',
  'timer',
  'stopwatch',
]);

export function facesCameraFlat(el: Element): boolean {
  return el.type === 'shape' && FACES_CAMERA.has(el.shape);
}
