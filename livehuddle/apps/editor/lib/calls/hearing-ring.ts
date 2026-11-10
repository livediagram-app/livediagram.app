// Your hearing ring (docs/specs/012-collaboration/proximity-audio.md "The talking equaliser", "Your hearing ring"):
// where people can hear you while you talk. A circle at the hearing radius round your feet, cut to the floor of the
// room you stand in and with every other room's floor cut out, since walls block sound both ways. Pure, so the ring and its tests read one answer.
import { zoneAt, type CallZone } from './zones';
import { mayTakeStage, stageAt, type CallStage } from './stage';
import type { AccessLevel } from '@livehuddle/api-schema';
import { HEARING_RADIUS_PX, reachOf, type Point } from './hearing';

export type HearingRing = {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  // The room's floor in canvas px when you stand in one: the ring is clipped to it. Null on the open floor.
  readonly clip: readonly Point[] | null;
  // Every other room's floor the ring reaches, cut out of it: walls block sound both ways, so standing outside a
  // room (or in the room round it) your voice does not reach in.
  readonly holes: readonly (readonly Point[])[];
};

/** The floor of `zone` as an outline: its Room Builder polygon, else its box. */
export function zoneOutline(zone: CallZone): readonly Point[] {
  if (zone.polygon) return zone.polygon;
  return [
    { x: zone.x0, y: zone.y0 },
    { x: zone.x1, y: zone.y0 },
    { x: zone.x1, y: zone.y1 },
    { x: zone.x0, y: zone.y1 },
  ];
}

/**
 * The ring round `self`'s feet, clipped to the room they stand in (a Phone Booth only while seated on it). Null on a
 * stage's top that lets you speak: the whole tab hears you there, so no ring marks it. Worked out from the board, not
 * the call, so it holds on the microphone's local preview too.
 */
export function hearingRing(
  self: Point,
  zones: readonly CallZone[],
  stages: readonly CallStage[] = [],
  level?: AccessLevel,
): HearingRing | null {
  const stage = stages.length > 0 ? stageAt(self, stages) : null;
  if (stage && mayTakeStage(level, stage.speakers)) return null;
  // Three times as far from a Podium (venue-pieces.md "Speaking from the Podium"); walls still cut it.
  const r = HEARING_RADIUS_PX * reachOf(self);
  const id = zones.length > 0 ? zoneAt(self, zones) : null;
  const zone = id === null ? undefined : zones.find((z) => z.id === id);
  const holes: (readonly Point[])[] = [];
  for (const z of zones) {
    if (z.id === id) continue;
    // Beyond the ring's reach: nothing to cut.
    if (z.x1 <= self.x - r || z.x0 >= self.x + r || z.y1 <= self.y - r || z.y0 >= self.y + r)
      continue;
    // A room round yours (you stand inside it too): its floor is where you are heard, not a wall's other side.
    if (zoneAt(self, [z]) === z.id) continue;
    holes.push(zoneOutline(z));
  }
  return { cx: self.x, cy: self.y, r, clip: zone ? zoneOutline(zone) : null, holes };
}
