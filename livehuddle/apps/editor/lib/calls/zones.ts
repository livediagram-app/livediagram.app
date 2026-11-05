// Rooms as calls (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls"; blueprint "Behaviour
// and state (part 1)"): which room's call each walker is in, from the board's Office rooms. The geometry is shared
// with the api's hearing check (@livehuddle/document call-geometry.ts); the call works out everyone's zone once per
// scene.
import { zoneAt, type CallZone } from '@livehuddle/document';
import type { Point } from './hearing';
import type { CallStaging } from './stage';

export { roomZones, zoneAt, type CallZone } from '@livehuddle/document';

/**
 * Your zone and every walker's (by presence id): a room's id, or null for the open floor. With anyone on a stage,
 * the staging too (meeting-rooms-and-stage.md "The stage"; stage.ts).
 */
export type CallZoning = {
  readonly self: string | null;
  readonly of: ReadonlyMap<string, string | null>;
  readonly stage?: CallStaging;
};

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
