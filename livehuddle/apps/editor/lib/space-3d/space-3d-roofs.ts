// Roofs (docs/specs/008-canvas/3d-view.md "Rooms on grass have roofs"): a room standing on Grass is a house, so the
// 3D view puts a pitched roof on its walls, its ridge along the room's long side. The roof is a ghost like the walls
// in front of you (app/space-3d.css), so it never hides anyone, and it goes while you stand inside that room. A room
// on a floor that is not grass is a room inside a building and has none.
import type { Element } from '@livehuddle/document';
import { SPACE_WALL_HEIGHT } from './space-3d-walls';
import type { SpaceArea } from './space-3d-cutaway';

/** How steep a roof is: its rise over half its span (about 35 degrees). */
export const SPACE_ROOF_PITCH = 0.7;
/** The highest a ridge rises over the wall tops, in canvas px, so a big hall's roof stays a roof. */
export const SPACE_ROOF_MAX_RISE = 150;

/** One roof, on its room's box. `across` when the ridge runs down the plan (the room is taller than it is wide). */
export type SpaceRoof = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  across: boolean;
};

type Box = { x: number; y: number; width: number; height: number };

const inside = (p: { x: number; y: number }, b: Box) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/** Every plain room (a box, unturned) whose middle stands on Grass, in board order. */
export function spaceRoofs(elements: readonly Element[]): SpaceRoof[] {
  const lawns: Box[] = [];
  for (const el of elements) if (el.type === 'shape' && el.shape === 'grass') lawns.push(el);
  if (lawns.length === 0) return [];
  const out: SpaceRoof[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'room' || el.rotation || el.roomOutline) continue;
    const middle = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    if (!lawns.some((lawn) => inside(middle, lawn))) continue;
    out.push({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      across: el.height > el.width,
    });
  }
  return out;
}

/** The roofs whose rooms meet the drawn area. */
export function roofsInArea(
  roofs: readonly SpaceRoof[],
  area: Pick<SpaceArea, 'left' | 'top' | 'right' | 'bottom'>,
): SpaceRoof[] {
  return roofs.filter(
    (r) =>
      r.x + r.width >= area.left &&
      r.x <= area.right &&
      r.y + r.height >= area.top &&
      r.y <= area.bottom,
  );
}

/** The roof over `feet`, by id: the one hidden while you stand in its room. */
export function roofOver(
  roofs: readonly SpaceRoof[],
  feet: { x: number; y: number } | null,
): string | null {
  if (!feet) return null;
  return roofs.find((r) => inside(feet, r))?.id ?? null;
}

/**
 * A roof's shape, along its ridge: the ridge's `length`, the `span` across it, how high the ridge `rise`s over the wall
 * tops, each slope's `slant` (its length up from the eaves) and `pitch` (degrees), and the wall tops' height `base`.
 */
export function roofShape(roof: SpaceRoof): {
  length: number;
  span: number;
  rise: number;
  slant: number;
  pitch: number;
  base: number;
} {
  const length = roof.across ? roof.height : roof.width;
  const span = roof.across ? roof.width : roof.height;
  const rise = Math.min((span / 2) * SPACE_ROOF_PITCH, SPACE_ROOF_MAX_RISE);
  return {
    length,
    span,
    rise,
    slant: Math.hypot(span / 2, rise),
    pitch: (Math.atan2(rise, span / 2) * 180) / Math.PI,
    base: SPACE_WALL_HEIGHT,
  };
}
