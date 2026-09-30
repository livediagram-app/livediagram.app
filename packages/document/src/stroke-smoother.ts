// The live pen pipeline (docs/specs/023-whiteboard/whiteboard.md "Pens"; blueprint
// whiteboard-round-one "Live stroke pipeline"; design and measurements in
// docs/research/stroke-smoothing.md): an incremental, fixed-lag, zero-phase
// smoother feeding a streaming error-bounded simplifier.
//
// - The head is the latest raw sample, so the drawn line never lags the pen.
// - Each sample is a Gaussian mean over the samples a few ms either side of it,
//   so nothing lags and loops and corners are not dragged inwards.
// - A sample is frozen once every sample its window reads exists; frozen points
//   enter the simplifier, whose kept points are final. Only the wet tail after
//   them is recomputed each frame, so earlier ink never shimmers.
// - The result at release is the last frame's result: nothing re-simplifies.
//
// Parameters are screen px and ms; px are divided by the zoom at the press, so
// the pipeline runs in canvas px and a stroke is as smooth at every zoom.

import type { Point } from './geometry-primitives';

export type StrokePointerKind = 'pen' | 'mouse' | 'touch';

export type StrokeSmoothing = {
  /** Gaussian sigma in time; the window reaches 3 sigma either side. */
  sigmaMs: number;
  /** Speed cap: sigma never spans more than this distance of travel, px. */
  capPx: number;
  /** Samples closer than this to the previous one are dropped, px. */
  minSamplePx: number;
  /** The simplifier's error bound, px. */
  simplifyTolPx: number;
  /** The longest chord the simplifier keeps, px. */
  maxChordPx: number;
};

// Starting values from docs/research/stroke-smoothing.md "Parameters"; safe
// ranges there (sigma 4 to 16 ms, cap 1 to 3 px, minimum sample 0 to 1 px,
// tolerance 0.25 to 1 px, chord 24 to 96 px). The mouse cap is tuned from 1.5 to
// 2 px on the seeded suite: at 1.5 a 300 px/s line sampled at 120 Hz keeps 0.39 px
// of 0.5 px noise (bound 0.35); at 2 it keeps 0.29, loops shrink 0.31 px (bound 0.6).
export const STROKE_SMOOTHING: Readonly<Record<StrokePointerKind, StrokeSmoothing>> = {
  pen: { sigmaMs: 6, capPx: 1.5, minSamplePx: 0.25, simplifyTolPx: 0.35, maxChordPx: 48 },
  mouse: { sigmaMs: 8, capPx: 2, minSamplePx: 0.5, simplifyTolPx: 0.5, maxChordPx: 48 },
  touch: { sigmaMs: 12, capPx: 2.5, minSamplePx: 0.5, simplifyTolPx: 0.6, maxChordPx: 48 },
};

// The most samples one simplifier chord may span, so a pen trembling on the
// spot (every sample within tolerance of one short chord) costs at most this
// many distance checks per sample. Safe range 64 to 1024.
export const SIMPLIFY_MAX_WINDOW = 256;

// Reach of the smoothing window, in sigmas.
const WINDOW_SIGMAS = 3;
const INITIAL_CAPACITY = 256;

/** The settings row for a `PointerEvent.pointerType`: anything unknown is a mouse. */
export function strokePointerKind(pointerType: string | undefined): StrokePointerKind {
  return pointerType === 'pen' || pointerType === 'touch' ? pointerType : 'mouse';
}

export type StrokeSmoother = {
  /** Adds a raw sample (canvas px, ms). False when it is dropped. */
  push(x: number, y: number, t: number): boolean;
  /** The final kept points, append-only: they never change once here. */
  readonly kept: readonly Point[];
  /** How many raw samples the stroke holds. */
  readonly sampleCount: number;
  /** A raw sample, canvas px. */
  sample(i: number): Point;
  /** The provisional kept points after `kept`, ending exactly on the latest sample. */
  tail(): Point[];
  /** The whole result as it stands: `kept` then `tail()`. O(stroke): not per frame. */
  points(): Point[];
  /** Freezes everything and returns the final points (idempotent). */
  end(): Point[];
};

type Buffer = { x: Float64Array; y: Float64Array; t: Float64Array };

const newBuffer = (capacity: number): Buffer => ({
  x: new Float64Array(capacity),
  y: new Float64Array(capacity),
  t: new Float64Array(capacity),
});

function grown(b: Buffer, used: number): Buffer {
  const next = newBuffer(b.x.length * 2);
  next.x.set(b.x.subarray(0, used));
  next.y.set(b.y.subarray(0, used));
  next.t.set(b.t.subarray(0, used));
  return next;
}

/** The greedy simplifier's state: the anchor (last kept index) and how far it has read. */
type SimplifierState = { anchor: number; last: number };

/**
 * One streaming smoother for one stroke. `zoom` converts the screen-px settings to canvas px;
 * samples are pushed in canvas px.
 */
export function createStrokeSmoother(smoothing: StrokeSmoothing, zoom: number): StrokeSmoother {
  const scale = zoom > 0 ? zoom : 1;
  const sigmaMs = smoothing.sigmaMs;
  const capPx = smoothing.capPx / scale;
  const minSample2 = (smoothing.minSamplePx / scale) ** 2;
  const tol2 = (smoothing.simplifyTolPx / scale) ** 2;
  const maxChord2 = (smoothing.maxChordPx / scale) ** 2;
  const freezeLagMs = WINDOW_SIGMAS * sigmaMs;
  // A gap longer than the widest window is a pause: the pen rested, reporting nothing.
  const pauseMs = freezeLagMs;

  let raw = newBuffer(INITIAL_CAPACITY);
  let n = 0;
  // Frozen smoothed points (indices match the raw samples below `frozen`).
  let smooth = { x: new Float64Array(INITIAL_CAPACITY), y: new Float64Array(INITIAL_CAPACITY) };
  let frozen = 0;
  const kept: Point[] = [];
  const state: SimplifierState = { anchor: 0, last: -1 };
  let ended = false;

  // Sigma for sample i: time-based, capped so fast travel is not averaged over too long a path.
  const sigmaAt = (i: number, count: number): number => {
    const a = Math.max(0, i - 2);
    const b = Math.min(count - 1, i + 2);
    const dt = raw.t[b]! - raw.t[a]!;
    if (dt <= 0) return sigmaMs;
    const dx = raw.x[b]! - raw.x[a]!;
    const dy = raw.y[b]! - raw.y[a]!;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt;
    return speed > 0 ? Math.min(sigmaMs, capPx / speed) : sigmaMs;
  };

  // The smoothed point of sample i given the samples so far (`count` of them). The window is
  // symmetric and never crosses an end: the stroke's first sample, its latest, or a pause (a gap
  // longer than the window reaches, where the pen rested and reported nothing). A one-sided
  // window would pull the sample back along its path, so a sample at an end is its raw self: the
  // head stays on the pen, and a corner the pen stopped at keeps its point.
  const smoothAt = (i: number, count: number): Point => {
    const ti = raw.t[i]!;
    const sigma = sigmaAt(i, count);
    const reach = WINDOW_SIGMAS * sigma;
    let back = reach;
    for (let j = i; ; j--) {
      if (j === 0 || raw.t[j]! - raw.t[j - 1]! > pauseMs) {
        back = Math.min(back, ti - raw.t[j]!);
        break;
      }
      if (ti - raw.t[j - 1]! > reach) break;
    }
    let ahead = reach;
    for (let j = i; ; j++) {
      if (j === count - 1 || raw.t[j + 1]! - raw.t[j]! > pauseMs) {
        ahead = Math.min(ahead, raw.t[j]! - ti);
        break;
      }
      if (raw.t[j + 1]! - ti > reach) break;
    }
    const h = Math.min(back, ahead);
    if (!(h > 0)) return { x: raw.x[i]!, y: raw.y[i]! };
    const k = -1 / (2 * sigma * sigma);
    let sw = 1;
    let sx = raw.x[i]!;
    let sy = raw.y[i]!;
    for (let j = i - 1; j >= 0; j--) {
      const dt = raw.t[j]! - ti;
      if (-dt > h) break;
      const w = Math.exp(dt * dt * k);
      sw += w;
      sx += w * raw.x[j]!;
      sy += w * raw.y[j]!;
    }
    for (let j = i + 1; j < count; j++) {
      const dt = raw.t[j]! - ti;
      if (dt > h) break;
      const w = Math.exp(dt * dt * k);
      sw += w;
      sx += w * raw.x[j]!;
      sy += w * raw.y[j]!;
    }
    return { x: sx / sw, y: sy / sw };
  };

  // Whether the chord from `a` to `k` holds every point between within tolerance.
  const fits = (px: (i: number) => number, py: (i: number) => number, a: number, k: number) => {
    if (k - a <= 1) return true;
    if (k - a > SIMPLIFY_MAX_WINDOW) return false;
    const ax = px(a);
    const ay = py(a);
    const vx = px(k) - ax;
    const vy = py(k) - ay;
    const len2 = vx * vx + vy * vy;
    if (len2 > maxChord2) return false;
    for (let j = a + 1; j < k; j++) {
      const wx = px(j) - ax;
      const wy = py(j) - ay;
      const u = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
      const ex = wx - u * vx;
      const ey = wy - u * vy;
      if (ex * ex + ey * ey > tol2) return false;
    }
    return true;
  };

  // Feeds points up to `upTo` into a simplifier state; `keep` receives each kept index.
  const simplify = (
    s: SimplifierState,
    upTo: number,
    px: (i: number) => number,
    py: (i: number) => number,
    keep: (i: number) => void,
  ) => {
    for (let k = s.last + 1; k <= upTo; k++) {
      s.last = k;
      if (k === 0) {
        keep(0);
        continue;
      }
      if (!fits(px, py, s.anchor, k)) {
        s.anchor = k - 1;
        keep(k - 1);
      }
    }
  };

  // Whether a frozen sample's speed or window read sample i, so it must never change.
  const readByFrozen = (i: number): boolean =>
    frozen > 0 && (i <= frozen + 1 || raw.t[i]! <= raw.t[frozen - 1]! + freezeLagMs);

  const frozenX = (i: number) => smooth.x[i]!;
  const frozenY = (i: number) => smooth.y[i]!;
  const keepFrozen = (i: number) => kept.push({ x: smooth.x[i]!, y: smooth.y[i]! });

  const storeSmoothed = (i: number, p: Point) => {
    if (i >= smooth.x.length) {
      const nx = new Float64Array(smooth.x.length * 2);
      const ny = new Float64Array(smooth.y.length * 2);
      nx.set(smooth.x);
      ny.set(smooth.y);
      smooth = { x: nx, y: ny };
    }
    smooth.x[i] = p.x;
    smooth.y[i] = p.y;
  };

  // Freezes, in order, every sample whose window is complete.
  const freeze = () => {
    const tLast = raw.t[n - 1]!;
    while (frozen + 2 <= n - 1 && tLast >= raw.t[frozen]! + freezeLagMs) {
      storeSmoothed(frozen, smoothAt(frozen, n));
      frozen++;
    }
    if (frozen > 0) simplify(state, frozen - 1, frozenX, frozenY, keepFrozen);
  };

  const push = (x: number, y: number, t: number): boolean => {
    if (ended || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) return false;
    if (n > 0) {
      const lt = raw.t[n - 1]!;
      if (t < lt) return false;
      const dx = x - raw.x[n - 1]!;
      const dy = y - raw.y[n - 1]!;
      if (t === lt) {
        // Two positions at one instant: the later wins, but never over the first sample (the
        // stroke starts where it was pressed), nor over one a frozen point was smoothed with.
        if (n === 1 || readByFrozen(n - 1)) return false;
        raw.x[n - 1] = x;
        raw.y[n - 1] = y;
        return true;
      }
      if (dx * dx + dy * dy < minSample2) return false;
    }
    if (n === raw.x.length) raw = grown(raw, n);
    raw.x[n] = x;
    raw.y[n] = y;
    raw.t[n] = t;
    n++;
    freeze();
    return true;
  };

  const tail = (): Point[] => {
    if (ended || n === 0) return [];
    // The wet samples, smoothed against the samples so far, after the frozen ones.
    const wetX = new Float64Array(n - frozen);
    const wetY = new Float64Array(n - frozen);
    for (let i = frozen; i < n; i++) {
      const p = smoothAt(i, n);
      wetX[i - frozen] = p.x;
      wetY[i - frozen] = p.y;
    }
    const px = (i: number) => (i < frozen ? smooth.x[i]! : wetX[i - frozen]!);
    const py = (i: number) => (i < frozen ? smooth.y[i]! : wetY[i - frozen]!);
    const scratch: SimplifierState = { ...state };
    const out: Point[] = [];
    let lastKept = kept.length > 0 ? state.anchor : -1;
    simplify(scratch, n - 1, px, py, (i) => {
      out.push({ x: px(i), y: py(i) });
      lastKept = i;
    });
    if (lastKept !== n - 1) out.push({ x: px(n - 1), y: py(n - 1) });
    return out;
  };

  const end = (): Point[] => {
    if (ended) return kept.slice();
    if (n > 0) {
      for (let i = frozen; i < n; i++) storeSmoothed(i, smoothAt(i, n));
      frozen = n;
      let lastKept = kept.length > 0 ? state.anchor : -1;
      simplify(state, n - 1, frozenX, frozenY, (i) => {
        keepFrozen(i);
        lastKept = i;
      });
      if (lastKept !== n - 1) keepFrozen(n - 1);
    }
    ended = true;
    return kept.slice();
  };

  return {
    push,
    kept,
    get sampleCount() {
      return n;
    },
    sample: (i: number) => ({ x: raw.x[i]!, y: raw.y[i]! }),
    tail,
    points: () => (ended ? kept.slice() : [...kept, ...tail()]),
    end,
  };
}
