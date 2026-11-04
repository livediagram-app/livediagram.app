// Who you hear, and how loudly (docs/specs/012-collaboration/proximity-audio.md "Hearing"; blueprint "Hearing"):
// pure geometry over the positions the room already shares, so the subscriptions, the audio graph and the equaliser
// all read one answer.

/** A speaker within this many canvas px of you, feet to feet, is subscribed. */
export const HEARING_RADIUS_PX = 260;
/** A subscribed speaker is let go only beyond this, so somebody on the edge does not flicker in and out. */
export const RELEASE_RADIUS_PX = 300;
/** Full volume within this. */
export const FULL_VOLUME_RADIUS_PX = 90;
/** Never hard left or right. */
export const MAX_PAN = 0.8;
/** Out of earshot, the bars fade from BARS_FAR_OPACITY_NEAR at the release radius to the minimum here. */
export const BARS_FADE_END_PX = 1500;
export const BARS_FAR_OPACITY_NEAR = 0.9;
export const BARS_FAR_OPACITY_MIN = 0.3;

export type Point = { x: number; y: number };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The speakers heard next: one already heard stays while within the release radius, a new one joins within the
 * hearing radius. `peers` maps a presence id to its feet; only peers in it (walking, on this tab, with a microphone
 * to hear) are candidates. Returns `prev` itself when nothing changed, so a caller can compare by identity.
 */
export function nextHeard(
  prev: ReadonlySet<string>,
  self: Point | null,
  peers: ReadonlyMap<string, Point>,
): ReadonlySet<string> {
  const next = new Set<string>();
  if (self) {
    for (const [id, at] of peers) {
      const d = distance(self, at);
      if (d <= HEARING_RADIUS_PX || (prev.has(id) && d <= RELEASE_RADIUS_PX)) next.add(id);
    }
  }
  if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
  return next;
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
