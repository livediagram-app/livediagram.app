// Who you hear, and how loudly (docs/specs/012-collaboration/proximity-audio.md "Hearing"; blueprint "Hearing"):
// pure geometry over the positions the room already shares, so the subscriptions, the audio graph and the equaliser
// all read one answer. Walls come first (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls"):
// a room's walls block sound, and inside a room, as in the open, distance decides. A stage reaches the whole tab, and
// its speakers hear each other as one call (the same spec's "The stage").
import { CALL_RELEASE_RADIUS_PX } from '@livehuddle/document';
import type { CallZoning } from './zones';

/** A speaker within this many canvas px of you, feet to feet, is subscribed. */
export const HEARING_RADIUS_PX = 260;
/** A subscribed speaker is let go only beyond this, so somebody on the edge does not flicker in and out. */
export const RELEASE_RADIUS_PX = CALL_RELEASE_RADIUS_PX;
/** Full volume within this. */
export const FULL_VOLUME_RADIUS_PX = 90;
/** Never hard left or right. */
export const MAX_PAN = 0.8;
/** Out of earshot, the bars fade from BARS_FAR_OPACITY_NEAR at the release radius to the minimum here. */
export const BARS_FADE_END_PX = 1500;
export const BARS_FAR_OPACITY_NEAR = 0.9;
export const BARS_FAR_OPACITY_MIN = 0.3;

// A walker's feet, and the seat they sit on (a Phone Booth's call is only its sitter's: call-geometry's CallPoint).
export type Point = { x: number; y: number; seatedOn?: string | null };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Where a peer stands relative to you: 'room' speaks from the stage you speak from (one call, full volume), 'open'
 * shares your room or the open floor (by distance), 'apart' is walled off (or is the audience of the stage you speak
 * from), 'stage' speaks to the whole tab from a stage you are not on.
 */
export type Together = 'room' | 'open' | 'apart' | 'stage';

/** Whether `id` is in your room, with you in the open, on the other side of a wall, or on a stage. No zoning: the open. */
export function togetherWith(id: string, zoning: CallZoning | undefined): Together {
  const stage = zoning?.stage;
  if (stage) {
    const onStage = stage.speakers.has(id);
    // Speakers hear each other as one room, and the stage hears nobody else.
    if (stage.self) return onStage ? 'room' : 'apart';
    if (onStage) return 'stage';
  }
  const mine = zoning?.self ?? null;
  const theirs = zoning?.of.get(id) ?? null;
  // Walls block sound; inside them, as in the open, distance decides.
  return mine === theirs ? 'open' : 'apart';
}

/**
 * The speakers heard next. Nobody across a wall is ever heard; in your room or the open floor, one already heard
 * stays while within the release radius, a new one joins within the hearing radius, and a stage's speakers are heard
 * wherever they stand. `peers` maps a presence id to its feet; only peers in it (walking, on this tab, with a microphone
 * to hear) are candidates. Returns `prev` itself when nothing changed, so a caller can compare by identity.
 */
export function nextHeard(
  prev: ReadonlySet<string>,
  self: Point | null,
  peers: ReadonlyMap<string, Point>,
  zoning?: CallZoning,
): ReadonlySet<string> {
  const next = new Set<string>();
  if (self) {
    for (const [id, at] of peers) {
      const together = togetherWith(id, zoning);
      if (together === 'apart') continue;
      if (together === 'room' || together === 'stage') {
        next.add(id);
        continue;
      }
      const d = distance(self, at);
      if (d <= HEARING_RADIUS_PX || (prev.has(id) && d <= RELEASE_RADIUS_PX)) next.add(id);
    }
  }
  if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
  return next;
}

/**
 * Whether a peer would hear you now: your room, or the hearing radius in the open. A speaker on a stage you are not on
 * does not hear you (the stage hears nobody in its audience).
 */
export function inEarshot(self: Point, at: Point, together: Together): boolean {
  if (together === 'apart' || together === 'stage') return false;
  return together === 'room' || distance(self, at) <= HEARING_RADIUS_PX;
}

/** Whether anyone hears you now (the mic indicator's Live). On a stage, everyone walking the tab does. */
export function someoneHears(
  self: Point | null,
  walkers: ReadonlyMap<string, Point>,
  zoning: CallZoning | undefined,
): boolean {
  if (!self) return false;
  if (zoning?.stage?.self) return walkers.size > 0;
  for (const [id, at] of walkers) if (inEarshot(self, at, togetherWith(id, zoning))) return true;
  return false;
}

/**
 * How a heard speaker is placed: by distance in your room or the open, full volume beside you on a stage, panned by
 * side either way; a stage speaker you are not beside at full volume, centred.
 */
export function placeFor(
  self: Point,
  at: Point,
  together: Together,
): { gain: number; pan: number } {
  if (together === 'stage') return { gain: 1, pan: 0 };
  return {
    gain: together === 'room' ? 1 : gainAt(distance(self, at)),
    pan: panAt(at.x - self.x),
  };
}

/** The gain at `d` canvas px: 1 within the full-volume radius, then an equal-power fade to 0 at the release radius. */
export function gainAt(d: number): number {
  if (d <= FULL_VOLUME_RADIUS_PX) return 1;
  if (d >= RELEASE_RADIUS_PX) return 0;
  const t = (d - FULL_VOLUME_RADIUS_PX) / (RELEASE_RADIUS_PX - FULL_VOLUME_RADIUS_PX);
  return Math.cos((t * Math.PI) / 2);
}

/** The stereo pan for a speaker `dx` canvas px to your right (negative: left). */
export function panAt(dx: number): number {
  const p = Math.max(-1, Math.min(1, dx / HEARING_RADIUS_PX)) * MAX_PAN;
  // Never -0: a speaker straight ahead is centred.
  return p === 0 ? 0 : p;
}

/** How strongly a speaker's bars show: fully while heard, else fading with distance to a floor. */
export function barsOpacity(d: number, heard: boolean): number {
  if (heard) return 1;
  if (d <= RELEASE_RADIUS_PX) return BARS_FAR_OPACITY_NEAR;
  if (d >= BARS_FADE_END_PX) return BARS_FAR_OPACITY_MIN;
  const t = (d - RELEASE_RADIUS_PX) / (BARS_FADE_END_PX - RELEASE_RADIUS_PX);
  return BARS_FAR_OPACITY_NEAR + (BARS_FAR_OPACITY_MIN - BARS_FAR_OPACITY_NEAR) * t;
}

/** Where to walk to reach a talker: a short way short of them, along the line from you. */
export const WALK_TO_TALKER_STOP_PX = 60;
export function walkTowards(self: Point, target: Point): Point {
  const d = distance(self, target);
  if (d <= WALK_TO_TALKER_STOP_PX) return self;
  const k = (d - WALK_TO_TALKER_STOP_PX) / d;
  return { x: self.x + (target.x - self.x) * k, y: self.y + (target.y - self.y) * k };
}
