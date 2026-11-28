// The office dog's way round its room (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"): the walls it
// walks between and the walk's own route finder (@livehuddle/avatar/pathing), so it trots round every piece and never
// through its room's walls, and only to a spot it can get to. Its walls are its room's (or, in no room, nothing round
// it) and its area's blocks (pet-wander.ts: each piece's whole box, which holds the piece's footprint at any facing,
// the 3D models' included, and any other room's box), each block solid so the grid holds no spot inside it. Built once
// per change to its area, never per frame. Pure: no React, no DOM.

import { PET_INSET, petLeg, type PetArea } from '@livehuddle/document';
import { buildNavGrid, findWalkRoute, type NavGrid } from '@livehuddle/avatar/pathing';
import type { FenceSegment } from '@livehuddle/avatar/collision';

/** How far the dog's feet keep from a piece's box or a wall as it walks, in canvas px. */
export const DOG_REACH = 18;

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

function edges(b: Box, solid: boolean): FenceSegment[] {
  const tl = { x: b.x, y: b.y };
  const tr = { x: b.x + b.width, y: b.y };
  const br = { x: b.x + b.width, y: b.y + b.height };
  const bl = { x: b.x, y: b.y + b.height };
  const s = solid ? { solid: { x: b.x, y: b.y, width: b.width, height: b.height } } : {};
  return [
    { a: tl, b: tr, ...s },
    { a: tr, b: br, ...s },
    { a: br, b: bl, ...s },
    { a: bl, b: tl, ...s },
  ];
}

/**
 * The lines the dog cannot cross: its room's walls (a box area's room floor, PET_INSET out from the box; a turned or
 * drawn room's floor polygon) and each block's four edges.
 */
export function petFences(area: PetArea | null): FenceSegment[] {
  if (!area) return [];
  const out: FenceSegment[] = [];
  if (area.kind === 'box') {
    const { box } = area;
    out.push(
      ...edges(
        {
          x: box.x - PET_INSET,
          y: box.y - PET_INSET,
          width: box.width + 2 * PET_INSET,
          height: box.height + 2 * PET_INSET,
        },
        false,
      ),
    );
  } else if (area.kind === 'polygon') {
    const p = area.polygon;
    for (let i = 0; i < p.length; i += 1) out.push({ a: p[i]!, b: p[(i + 1) % p.length]! });
  }
  for (const b of area.blocks ?? []) out.push(...edges(b, true));
  return out;
}

/** The dog's route grid for its area, or null when nothing bounds it (every trot is then a straight line). */
export function petGrid(area: PetArea | null): NavGrid | null {
  const fences = petFences(area);
  return fences.length > 0 ? buildNavGrid(fences, DOG_REACH) : null;
}

/** Where the dog lies in its bed, in canvas px: the bed's middle, a little down. */
export function petHome(bed: Box): Point {
  return { x: bed.x + bed.width / 2, y: bed.y + bed.height * 0.72 };
}

/**
 * Leg `n`'s spot for this bed, in canvas px, or null when it naps in its bed: petLeg's spot that the dog can walk to
 * from its bed round the walls and pieces (one route per try, at most PET_TRIES a walk). The same on every screen, as
 * the bed, its area and so its grid are.
 */
export function petSpot(
  bed: Box & { id: string },
  area: PetArea,
  grid: NavGrid | null,
  n: number,
): Point | null {
  const home = petHome(bed);
  return petLeg(bed.id, n, area, (p) => findWalkRoute(grid, home, p) !== null);
}
