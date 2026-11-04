// Rooms as calls (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls"; blueprint "Behaviour
// and state (part 1)"): which room's call each walker is in, from the board's Office rooms. Pure: the canvas hands it
// the tab's visible elements, the call works out everyone's zone once per scene.
import { roomInterior } from '@liveworkspace/avatar/office-geometry';
import type { Point } from './hearing';
import type { CallStaging } from './stage';

/** A room's floor as the call reads it: the box inside its walls' centre lines, and its area for nesting. */
export type CallZone = {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly area: number;
};

/**
 * Your zone and every walker's (by presence id): a room's id, or null for the open floor. With anyone on a stage,
 * the staging too (meeting-rooms-and-stage.md "The stage"; stage.ts).
 */
export type CallZoning = {
  readonly self: string | null;
  readonly of: ReadonlyMap<string, string | null>;
  readonly stage?: CallStaging;
};

type ZoneSource = {
  readonly id: string;
  readonly type: string;
  readonly shape?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
};

/** Every Office room among `elements` as a zone. The caller passes only what is on visible layers. */
export function roomZones(elements: readonly ZoneSource[]): CallZone[] {
  const zones: CallZone[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'room') continue;
    const { x, y, width, height } = el;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      continue;
    }
    const inside = roomInterior({ x, y, width, height });
    if (inside.width <= 0 || inside.height <= 0) continue;
    zones.push({
      id: el.id,
      x0: inside.x,
      y0: inside.y,
      x1: inside.x + inside.width,
      y1: inside.y + inside.height,
      area: inside.width * inside.height,
    });
  }
  return zones;
}

/**
 * The room whose call `at` is in: strictly inside its walls' centre lines (feet on the doorway's threshold are still
 * outside), the innermost (smallest) of several, then the lower id; null on the open floor.
 */
export function zoneAt(at: Point, zones: readonly CallZone[]): string | null {
  let best: CallZone | null = null;
  for (const z of zones) {
    if (at.x <= z.x0 || at.x >= z.x1 || at.y <= z.y0 || at.y >= z.y1) continue;
    if (!best || z.area < best.area || (z.area === best.area && z.id < best.id)) best = z;
  }
  return best ? best.id : null;
}

/** Everyone's zone, worked out once: yours and each walker's. */
export function zoning(
  self: Point | null,
  walkers: ReadonlyMap<string, Point>,
  zones: readonly CallZone[],
): CallZoning {
  const of = new Map<string, string | null>();
  if (zones.length > 0) for (const [id, at] of walkers) of.set(id, zoneAt(at, zones));
  return { self: self && zones.length > 0 ? zoneAt(self, zones) : null, of };
}
