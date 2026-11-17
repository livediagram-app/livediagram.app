// The pieces the 3D view stands up (docs/specs/008-canvas/3d-view.md "Pieces stand up"; blueprint: 3d-view.md): every
// piece of the Space drawn upright in the flat plan turns up about its front edge to face the camera, as the
// characters do. Which kinds stand, which of them are near enough to stand now, how far a sitter is lifted in front
// of the piece it sits on, and the piece under a press on the tilted screen. Pure: no React, no DOM.

import type { Element, ShapeKind } from '@livehuddle/document';
import type { SpaceArea } from './space-3d-cutaway';

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

/**
 * The value of a standing piece's attribute: `base` or `centre` for a piece that stands, `inside` for one whose
 * furniture stands inside its walls, undefined for one that lies flat.
 */
export function standAttr(el: Element): 'base' | 'centre' | 'inside' | undefined {
  if (standsInside3D(el)) return 'inside';
  if (!standsIn3D(el)) return undefined;
  return ((el as { rotation?: number }).rotation ?? 0) % 360 === 0 ? 'base' : 'centre';
}

/** The standing pieces whose box meets the area, by id: the ones that turn up now. */
export function standingIdsInArea(elements: readonly Element[], area: SpaceArea): Set<string> {
  const out = new Set<string>();
  for (const el of elements) {
    if (!standsIn3D(el) && !standsInside3D(el)) continue;
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
export function seatLift(piece: Box | null | undefined, feet: Point): number {
  if (!piece) return 0;
  const depth = piece.y + piece.height - feet.y;
  return depth >= 0 && depth <= piece.height ? Math.ceil(depth) + 1 : 0;
}

/**
 * Whether a sitter sits behind the piece (further back than SPACE_SEAT_LIFT_SHARE of its depth: a table's far side,
 * behind a desk): the piece then hides their legs, so they read as sitting behind it, not on it (3d-view.md "Pieces
 * stand up").
 */
export function seatBehind(piece: Box | null | undefined, feet: Point): boolean {
  if (!piece) return false;
  const depth = piece.y + piece.height - feet.y;
  return depth > piece.height * SPACE_SEAT_LIFT_SHARE && depth <= piece.height;
}

type Rect = { left: number; top: number; width: number; height: number };

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
    if (!best || p.box.y + p.box.height > best.box.y + best.box.height) best = p;
  }
  if (!best) return null;
  const { box, rect } = best;
  if (best.rotated) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
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
/** How high up its wall a hung piece's foot sits, in canvas px (008-canvas DEFAULTS.md D147). */
export const SPACE_HANG_LIFT = 10;

type WallLine = { a: Point; b: Point; kind: string };

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
  for (const w of walls) {
    if (w.kind !== 'wall' && w.kind !== 'glass' && w.kind !== 'window') continue;
    if (Math.abs(w.a.y - w.b.y) > 1) continue;
    if (mid < Math.min(w.a.x, w.b.x) || mid > Math.max(w.a.x, w.b.x)) continue;
    const y = (w.a.y + w.b.y) / 2;
    if (y > el.y + el.height / 2 || el.y - y > SPACE_HANG_REACH) continue;
    // The nearest such wall above it; a hair in front of its face so the piece is never inside it.
    if (best === null || y > best) best = y;
  }
  return best === null ? null : best + 1 - foot;
}
