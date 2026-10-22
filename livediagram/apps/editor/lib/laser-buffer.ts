import { LASER_LONGEST_TRAIL_MS } from './laser-config';

// One laser sample on a participant's trail. `t` is a
// performance.now() reading at the time the point was appended, used
// for both age-based drop in this buffer and per-segment fade in
// LaserOverlay.
export type LaserPoint = { x: number; y: number; t: number };

// How long a buffered point sticks around before trimLaserBuffer
// drops it: the longest trail's fade window (laserLifetimeMs, the Long
// trail) plus a margin, so points past the fade sit in the buffer at 0
// opacity, protecting against frame jitter at the fade boundary. It was a
// fixed 1.5 s, which cut the 2.5 s Long trail short.
const LASER_BUFFER_MARGIN_MS = 500;
export const LASER_BUFFER_TTL_MS = LASER_LONGEST_TRAIL_MS + LASER_BUFFER_MARGIN_MS;

// Hard cap on points per participant trail. Even a peer who sends
// laser ops faster than the throttle would normally allow can't
// grow the buffer without bound: the trim drops anything past the
// most recent LASER_MAX_POINTS samples, in addition to the TTL. Sized
// for a whole TTL of samples at the ~30 Hz send rate (one per 33 ms), so
// the cap never shortens a trail drawn at the normal rate.
const LASER_SAMPLE_INTERVAL_MS = 33;
export const LASER_MAX_POINTS = Math.ceil(LASER_BUFFER_TTL_MS / LASER_SAMPLE_INTERVAL_MS);

// Bound a laser-trail buffer in both dimensions: drop samples older
// than LASER_BUFFER_TTL_MS, then cap at the LASER_MAX_POINTS most
// recent. Called on every append (local broadcast + remote receive)
// so even a flood from a misbehaving peer can't grow the buffer
// without bound.
//
// `now` is injectable so tests can pin a deterministic clock; the
// production callers omit it and the default reads
// `performance.now()` at call time.
export function trimLaserBuffer(
  points: LaserPoint[],
  now: number = performance.now(),
): LaserPoint[] {
  const cutoff = now - LASER_BUFFER_TTL_MS;
  const fresh = points.filter((p) => p.t >= cutoff);
  return fresh.length > LASER_MAX_POINTS ? fresh.slice(fresh.length - LASER_MAX_POINTS) : fresh;
}
