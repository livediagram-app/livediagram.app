// Real 3D's office dog (docs/specs/008-canvas/3d-engine.md "The office dog"): how its model stands and moves this
// frame, from what its hidden drawing (components/canvas/collab/OfficeDog.tsx) says. The drawing keeps the dog's own
// walk, route, rests and pats; this only poses the model. Pure: no three.js, no DOM; canvas px, radians and seconds.

/** Where the drawing's feet are in its 44 x 32 box (OfficeDog.tsx DOG_FEET). */
export const DOG_FEET = { x: 22, y: 30 } as const;
/** How far one full step (both pairs of legs) carries the dog, in canvas px. */
export const DOG_STRIDE = 15;
/** How long it takes to lie down or get up, and to settle into its bed, in s. */
export const DOG_LIE_S = 0.45;
/** How long a pat's heart rises, in ms (OfficeDog.tsx PAT_MS). */
export const DOG_PAT_MS = 1500;

export type DogReading = {
  /** Where its feet are on the canvas. */
  feet: { x: number; y: number };
  /** Lying down (resting at a spot, or asleep in its bed). */
  asleep: boolean;
  /** Asleep in its bed (not out on the floor). */
  home: boolean;
  /** On its way along its route. */
  trotting: boolean;
  /** Facing left (the drawing's mark), for the way it faces before it has moved. */
  left: boolean;
};

/**
 * The dog as its drawing has it: `bed` its bed's box, `tx`/`ty` the drawing's translation over the bed's box (its
 * computed transform, mid-trot included), and the drawing's marks.
 */
export function readDog(
  bed: { x: number; y: number },
  tx: number,
  ty: number,
  marks: { pet: string | null; floor: boolean; trot: boolean; left: boolean },
): DogReading {
  const asleep = marks.pet === 'asleep';
  return {
    feet: { x: bed.x + tx + DOG_FEET.x, y: bed.y + ty + DOG_FEET.y },
    asleep,
    home: asleep && !marks.floor,
    trotting: marks.trot,
    left: marks.left,
  };
}

/** Moves `v` toward `want` by `dt / span` (both 0 to 1), never past it. */
export function easeToward(v: number, want: number, dt: number, span = DOG_LIE_S): number {
  const step = span > 0 ? dt / span : 1;
  return want > v ? Math.min(want, v + step) : Math.max(want, v - step);
}

/** The step's phase (radians) after `dt` at `speed` canvas px a second. */
export function stepPhase(phase: number, speed: number, dt: number): number {
  return (phase + ((speed * dt) / DOG_STRIDE) * Math.PI * 2) % (Math.PI * 2);
}

export type DogLimbs = {
  /** Each diagonal pair's swing from the hip (front-left with back-right is `a`), forward positive. */
  a: number;
  b: number;
  /** How high the body rises this moment of the step. */
  bob: number;
  /** The tail's wag (side to side) and how high it is held (0 down along the floor, 1 up). */
  wag: number;
  tailUp: number;
};

/**
 * The legs, body and tail: `phase` the step, `stride` how much it is stepping (0 standing to 1 trotting), `lie` how
 * far it has lain down (0 standing, 1 lying), `t` the time in s, `wagHz` how fast its tail wags (0 still).
 */
export function dogLimbs(
  phase: number,
  stride: number,
  lie: number,
  t: number,
  wagHz: number,
): DogLimbs {
  const swing = Math.sin(phase) * 0.62 * stride * (1 - lie);
  const up = 1 - lie;
  return {
    a: swing,
    b: -swing,
    bob: Math.abs(Math.sin(phase)) * 1.3 * stride * up,
    wag: wagHz > 0 ? Math.sin(t * Math.PI * 2 * wagHz) * (0.55 - 0.3 * lie) : 0,
    tailUp: up,
  };
}

/** How fast the tail wags: fast for a pat, brisk on its way, gently standing, still while it lies resting. */
export function wagHz(patted: boolean, stride: number, lie: number): number {
  if (patted) return 7;
  if (lie > 0.5) return 0;
  return 1.6 + 2.4 * stride;
}

/** A slow breath while it lies down: the body's swell, 0 to 1. */
export function breath(t: number, lie: number): number {
  return lie * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.28));
}

/** Whether a screen point falls inside the box round some screen points, grown by `pad` px. */
export function boxHit(
  points: readonly { x: number; y: number }[],
  x: number,
  y: number,
  pad = 4,
): boolean {
  if (points.length === 0) return false;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad;
}

/** A pat's heart `ms` after it began: how high it has risen (canvas px) and how clear it is (1 to 0). */
export function heartAt(ms: number, still: boolean): { rise: number; opacity: number } | null {
  if (ms < 0 || ms > DOG_PAT_MS) return null;
  const t = ms / DOG_PAT_MS;
  return {
    rise: still ? 6 : 6 + 16 * (1 - (1 - t) * (1 - t)),
    opacity: t < 0.6 ? 1 : (1 - t) / 0.4,
  };
}
