// The office dog's trot along its route (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"), as one
// animation the browser's compositor plays: its stops along the way, each at its share of the route's length, so it
// keeps a steady pace, and the moments it turns to face left or right. Nothing runs on the page per frame while it
// trots (docs/specs/008-canvas/canvas-performance.md "A still Space does nothing"). Pure: the face plays it.

export type DogPoint = { x: number; y: number };

export type DogTrot = {
  /** Where it starts, then each corner of the route and its end. */
  points: readonly DogPoint[];
  /** Each point's share of the route's length, 0 to 1. */
  offsets: readonly number[];
  /** How long the whole trot takes, in ms. */
  ms: number;
  /** When it turns to face left (true) or right (false), in ms from the start; the first is at 0. */
  turns: readonly { atMs: number; left: boolean }[];
};

// A step sideways shorter than this keeps the way it faces (straight up or down the canvas).
const TURN_MIN_DX = 0.5;

/** The trot from `from` along `route` at `speed` canvas px a second; `facingLeft` is the way it faces as it sets off. */
export function dogTrot(
  from: DogPoint,
  route: readonly DogPoint[],
  speed: number,
  facingLeft: boolean,
): DogTrot {
  const points = [from, ...route];
  const lengths = [0];
  const turns: { atMs: number; left: boolean }[] = [];
  let left = facingLeft;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const startMs = (lengths[i - 1]! / speed) * 1000;
    if (Math.abs(b.x - a.x) > TURN_MIN_DX && b.x < a.x !== left) {
      left = b.x < a.x;
      turns.push({ atMs: startMs, left });
    }
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[lengths.length - 1]!;
  return {
    points,
    offsets: lengths.map((l) => (total > 0 ? l / total : 1)),
    ms: (total / speed) * 1000,
    turns,
  };
}

/** Where the dog is `ms` into its trot: along the route, its start before it and its end after. */
export function dogAtTime(trot: DogTrot, ms: number): DogPoint {
  const { points, offsets } = trot;
  const share = trot.ms > 0 ? Math.min(1, Math.max(0, ms / trot.ms)) : 1;
  for (let i = 1; i < points.length; i++) {
    if (share > offsets[i]!) continue;
    const a = points[i - 1]!;
    const b = points[i]!;
    const span = offsets[i]! - offsets[i - 1]!;
    const t = span > 0 ? (share - offsets[i - 1]!) / span : 1;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return points[points.length - 1]!;
}
