import { describe, expect, it } from 'vitest';
import {
  SIMPLIFY_MAX_WINDOW,
  STROKE_SMOOTHING,
  catmullRomSegment,
  catmullRomToBezierPath,
  createStrokeSmoother,
  isStrokeCorner,
  strokePointerKind,
  type StrokeSmoother,
  type StrokeSmoothing,
} from './index';
import {
  circleAt,
  distToPolyline,
  hausdorff,
  lineAt,
  loopsAt,
  samplePath,
  sampleTrace,
  seededRandom,
  vAt,
  type TraceSample,
} from './stroke-test-traces';

// The live pen pipeline (docs/specs/023-whiteboard/whiteboard.md "Pens", blueprint "Live stroke
// pipeline"), measured with the metrics of docs/research/stroke-smoothing.md "Test plan" on seeded
// synthetic traces in screen px at zoom 1.

type Point = { x: number; y: number };
const MOUSE = STROKE_SMOOTHING.mouse;

/** Feeds a trace, `perFrame` samples per frame, calling `frame` after each. Returns the result. */
function run(
  trace: TraceSample[],
  smoothing: StrokeSmoothing = MOUSE,
  zoom = 1,
  frame?: (s: StrokeSmoother, last: TraceSample) => void,
  perFrame = 2,
): { smoother: StrokeSmoother; points: Point[] } {
  const smoother = createStrokeSmoother(smoothing, zoom);
  trace.forEach((p, i) => {
    smoother.push(p.x / zoom, p.y / zoom, p.t);
    if (frame && (i % perFrame === perFrame - 1 || i === trace.length - 1)) frame(smoother, p);
  });
  return { smoother, points: smoother.end() };
}

const curveOf = (points: Point[], steps = 16) =>
  samplePath(catmullRomToBezierPath(points, false), steps);

// Segment j of the curve through `points`, sampled.
const segmentCurve = (points: Point[], j: number) =>
  samplePath(`M ${points[j]!.x} ${points[j]!.y} ${catmullRomSegment((i) => points[i], j)}`, 5);

/** RMS distance of the curve from the x axis, ignoring `trimPx` at each end. */
function rmsFromXAxis(points: Point[], fromX: number, toX: number): number {
  const on = curveOf(points).filter((p) => p.x >= fromX && p.x <= toX);
  return Math.sqrt(on.reduce((s, p) => s + p.y * p.y, 0) / on.length);
}

describe('stroke pointer kinds and settings', () => {
  it('maps pointer types to their settings, mouse by default', () => {
    expect(strokePointerKind('pen')).toBe('pen');
    expect(strokePointerKind('touch')).toBe('touch');
    expect(strokePointerKind('mouse')).toBe('mouse');
    expect(strokePointerKind(undefined)).toBe('mouse');
    expect(strokePointerKind('')).toBe('mouse');
  });

  it('carries the research starting values, the mouse cap tuned', () => {
    expect(STROKE_SMOOTHING).toEqual({
      pen: { sigmaMs: 6, capPx: 1.5, minSamplePx: 0.25, simplifyTolPx: 0.35, maxChordPx: 48 },
      mouse: { sigmaMs: 8, capPx: 2, minSamplePx: 0.5, simplifyTolPx: 0.5, maxChordPx: 48 },
      touch: { sigmaMs: 12, capPx: 2.5, minSamplePx: 0.5, simplifyTolPx: 0.6, maxChordPx: 48 },
    });
  });
});

describe('samples', () => {
  it('drops a sample within the minimum distance of the previous one', () => {
    const s = createStrokeSmoother(MOUSE, 1);
    expect(s.push(0, 0, 0)).toBe(true);
    expect(s.push(0.3, 0, 8)).toBe(false);
    expect(s.push(2, 0, 16)).toBe(true);
    expect(s.sampleCount).toBe(2);
  });

  it('measures the minimum distance on screen: zoomed in, a smaller canvas step counts', () => {
    const s = createStrokeSmoother(MOUSE, 4);
    s.push(0, 0, 0);
    // 0.3 canvas px at 400% is 1.2 screen px.
    expect(s.push(0.3, 0, 8)).toBe(true);
  });

  it('drops a sample from the past', () => {
    const s = createStrokeSmoother(MOUSE, 1);
    s.push(0, 0, 10);
    expect(s.push(5, 0, 9)).toBe(false);
    expect(s.sampleCount).toBe(1);
  });

  it('lets a sample at the same time replace the previous one, never the first', () => {
    const s = createStrokeSmoother(MOUSE, 1);
    s.push(0, 0, 0);
    expect(s.push(5, 0, 0)).toBe(false);
    s.push(5, 0, 8);
    expect(s.push(9, 0, 8)).toBe(true);
    expect(s.sampleCount).toBe(2);
    expect(s.sample(1)).toEqual({ x: 9, y: 0 });
  });

  it('ends a tap as its one point', () => {
    const s = createStrokeSmoother(MOUSE, 1);
    s.push(3, 4, 0);
    expect(s.end()).toEqual([{ x: 3, y: 4 }]);
  });

  it('grows past its first buffer without losing samples', () => {
    const trace = sampleTrace(lineAt(600), 5000, 240);
    const s = createStrokeSmoother(MOUSE, 1);
    for (const p of trace) s.push(p.x, p.y, p.t);
    expect(s.sampleCount).toBe(trace.length);
    expect(s.sample(trace.length - 1)).toEqual({ x: 3000, y: 0 });
  });
});

describe('zero lag at the head', () => {
  it('always ends the drawn stroke exactly on the latest sample', () => {
    const trace = sampleTrace(loopsAt(300, 8, 160), 1200, 120, { white: 0.5, seed: 3 });
    let checked = 0;
    run(trace, MOUSE, 1, (s) => {
      const tail = s.tail();
      // The latest sample the smoother took (one within the minimum step is dropped).
      expect(tail[tail.length - 1]).toEqual(s.sample(s.sampleCount - 1));
      checked++;
    });
    expect(checked).toBeGreaterThan(50);
  });

  it('starts exactly on the first sample', () => {
    const trace = sampleTrace(lineAt(600), 300, 120, { white: 0.5, seed: 4 });
    expect(run(trace).points[0]).toEqual({ x: trace[0]!.x, y: trace[0]!.y });
  });
});

describe('a stable prefix', () => {
  // Random scribbles: a random walk with random speed changes, rate and seed.
  const scribble = (seed: number, hz: number): TraceSample[] => {
    const rand = seededRandom(seed);
    const out: TraceSample[] = [];
    let x = 0;
    let y = 0;
    let heading = 0;
    let speed = 0.5;
    for (let i = 0; i < 240; i++) {
      heading += (rand() - 0.5) * 1.2;
      speed = Math.max(0.05, Math.min(1.5, speed + (rand() - 0.5) * 0.3));
      const dt = 1000 / hz;
      x += Math.cos(heading) * speed * dt;
      y += Math.sin(heading) * speed * dt;
      out.push({ x: x + (rand() - 0.5), y: y + (rand() - 0.5), t: i * dt });
    }
    return out;
  };

  it('never changes a kept point once it is kept, on every frame of random traces', () => {
    let frames = 0;
    let changed = 0;
    for (const [seed, hz] of [
      [11, 60],
      [12, 120],
      [13, 240],
      [14, 90],
    ] as const) {
      const seen: number[] = [];
      const { points } = run(
        scribble(seed, hz),
        STROKE_SMOOTHING.pen,
        1,
        (s) => {
          frames++;
          for (let i = 0; i < seen.length / 2; i++) {
            if (s.kept[i]!.x !== seen[2 * i] || s.kept[i]!.y !== seen[2 * i + 1]) changed++;
          }
          for (let i = seen.length / 2; i < s.kept.length; i++)
            seen.push(s.kept[i]!.x, s.kept[i]!.y);
        },
        3,
      );
      expect(points.flatMap((p) => [p.x, p.y]).slice(0, seen.length)).toEqual(seen);
    }
    expect(frames).toBeGreaterThan(300);
    expect(changed).toBe(0);
  });

  it('settles the wet tail by under a pixel', () => {
    const trace = sampleTrace(loopsAt(250, 10, 200), 400, 240, { white: 0.3, seed: 5 });
    // Each frame's provisional curve (from the last final segment on), kept for later.
    const frames: { from: number; points: Point[] }[] = [];
    const { points } = run(trace, STROKE_SMOOTHING.pen, 1, (s) => {
      frames.push({ from: Math.max(0, s.kept.length - 2), points: [...s.kept, ...s.tail()] });
    });
    // The landed curve, one sampled run per segment.
    const landed = points.slice(1).map((_, j) => segmentCurve(points, j));
    let worst = 0;
    for (const f of frames) {
      // Against the landed segments around the same stretch of the stroke.
      const near = landed.slice(Math.max(0, f.from - 4), f.points.length + 8).flat();
      for (let j = f.from; j < f.points.length - 1; j++) {
        for (const p of segmentCurve(f.points, j)) {
          worst = Math.max(worst, distToPolyline(p, near));
        }
      }
    }
    expect(frames.length).toBeGreaterThan(40);
    expect(worst).toBeLessThan(1);
  });
});

describe('no jump on release', () => {
  it('lands exactly the points the last frame showed', () => {
    const trace = sampleTrace(loopsAt(300, 8, 160), 900, 120, { white: 0.5, seed: 6 });
    let lastShown: Point[] = [];
    const { points } = run(trace, MOUSE, 1, (s) => {
      lastShown = [...s.kept, ...s.tail()];
    });
    expect(points).toEqual(lastShown);
  });

  it('points() is the kept points and the tail, and just the kept points after the end', () => {
    const trace = sampleTrace(lineAt(600), 400, 120);
    const s = createStrokeSmoother(MOUSE, 1);
    for (const p of trace) s.push(p.x, p.y, p.t);
    expect(s.points()).toEqual([...s.kept, ...s.tail()]);
    const end = s.end();
    expect(s.tail()).toEqual([]);
    expect(s.points()).toEqual(end);
    expect(s.end()).toEqual(end);
  });
});

describe('rate independence', () => {
  it('draws one trajectory the same at 60, 120 and 240 Hz, within half a pixel', () => {
    // A gentle handwriting-scale curve at 400 px/s.
    const at = (t: number) => ({
      x: 0.4 * t,
      y: 30 * Math.sin((2 * Math.PI * t) / 600),
    });
    const curves = [60, 120, 240].map((hz) => curveOf(run(sampleTrace(at, 600, hz)).points, 6));
    expect(hausdorff(curves[0]!, curves[1]!)).toBeLessThan(0.5);
    expect(hausdorff(curves[1]!, curves[2]!)).toBeLessThan(0.5);
    expect(hausdorff(curves[0]!, curves[2]!)).toBeLessThan(0.5);
  });
});

describe('wobble', () => {
  // One noise draw swings a line's RMS by a tenth of a pixel, so each bound holds for the mean of
  // eight seeded traces: a 300 px/s mouse line sampled at 120 Hz.
  const meanRms = (noise: { white?: number; tremor?: number }) => {
    let sum = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const trace = sampleTrace(lineAt(300), 1000, 120, { ...noise, seed: seed * 7 });
      sum += rmsFromXAxis(run(trace).points, 10, 290);
    }
    return sum / 8;
  };

  it('smooths 0.5 px white noise on a line to at most 0.35 px RMS', () => {
    expect(meanRms({ white: 0.5 })).toBeLessThanOrEqual(0.35);
  });

  it('smooths a 1 px tremor on a line to at most 0.65 px RMS', () => {
    expect(meanRms({ tremor: 1 })).toBeLessThanOrEqual(0.65);
  });
});

describe('loops', () => {
  it('keeps an 8 px handwriting loop at 400 px/s within 0.6 px of its radius', () => {
    const trace = sampleTrace(circleAt(8, 400), (2 * Math.PI * 8 * 2 * 1000) / 400, 120);
    const curve = curveOf(run(trace).points);
    // The middle loop, away from the pinned ends.
    const mid = curve.slice(Math.floor(curve.length / 4), Math.floor((3 * curve.length) / 4));
    const mean = mid.reduce((s, p) => s + Math.hypot(p.x, p.y), 0) / mid.length;
    expect(Math.abs(mean - 8)).toBeLessThanOrEqual(0.6);
  });
});

describe('corners', () => {
  for (const angle of [90, 45, 20]) {
    it(`keeps a ${angle} degree V's corner within 1.5 px`, () => {
      const v = vAt(angle, 100, 600);
      const trace = sampleTrace(v.at, v.durationMs, 120, { white: 0.3, seed: angle });
      const curve = curveOf(run(trace).points);
      const cut = Math.min(...curve.map((p) => Math.hypot(p.x, p.y)));
      expect(cut).toBeLessThanOrEqual(1.5);
    });
  }

  it('turns a 180 degree retrace on a corner: a tangent break, no loop', () => {
    // Out to x = 100 and straight back along the same line.
    const at = (t: number) => ({ x: t <= 250 ? 0.4 * t : 200 - 0.4 * t, y: 0 });
    const { points } = run(sampleTrace(at, 500, 120));
    const tip = points.reduce((best, p, i) => (p.x > points[best]!.x ? i : best), 0);
    expect(isStrokeCorner(points[tip - 1]!, points[tip]!, points[tip + 1]!)).toBe(true);
    const curve = curveOf(points);
    expect(Math.max(...curve.map((p) => p.x))).toBeLessThanOrEqual(points[tip]!.x + 1e-9);
    expect(Math.max(...curve.map((p) => Math.abs(p.y)))).toBeLessThan(0.5);
  });
});

describe('zoom', () => {
  it('scales the canvas result by exactly 1 / zoom for one screen trace', () => {
    const trace = sampleTrace(loopsAt(300, 8, 160), 700, 120, { white: 0.5, seed: 9 });
    const base = run(trace, MOUSE, 1).points;
    for (const zoom of [0.5, 2]) {
      const scaled = run(trace, MOUSE, zoom).points;
      expect(scaled).toEqual(base.map((p) => ({ x: p.x / zoom, y: p.y / zoom })));
    }
  });
});

describe('the kept polyline and its curve', () => {
  it('keeps the curve within 1 px of the kept points on handwriting', () => {
    const trace = sampleTrace(loopsAt(250, 10, 200), 1400, 120, { white: 0.5, seed: 10 });
    const { points } = run(trace);
    let worst = 0;
    const curve = curveOf(points);
    for (const p of curve) {
      let best = Infinity;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const len = vx * vx + vy * vy;
        const u = len ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len)) : 0;
        best = Math.min(best, Math.hypot(p.x - a.x - u * vx, p.y - a.y - u * vy));
      }
      worst = Math.max(worst, best);
    }
    expect(worst).toBeLessThan(1);
  });

  it('compacts: far fewer kept points than samples on a smooth stroke', () => {
    const trace = sampleTrace(lineAt(600), 1000, 240, { white: 0.3, seed: 11 });
    expect(run(trace).points.length).toBeLessThan(trace.length / 5);
  });
});

describe('bounded work per frame', () => {
  it('keeps the wet tail short however long the stroke grows', () => {
    const trace = sampleTrace(loopsAt(200, 12, 300), 10_000, 240, { white: 0.4, seed: 12 });
    let longest = 0;
    const s = createStrokeSmoother(STROKE_SMOOTHING.pen, 1);
    trace.forEach((p, i) => {
      s.push(p.x, p.y, p.t);
      if (i % 2 === 1) longest = Math.max(longest, s.tail().length);
    });
    expect(trace.length).toBeGreaterThan(2000);
    expect(longest).toBeLessThan(24);
  });

  it('bounds a chord in samples, so a pen trembling on the spot stays cheap', () => {
    // A pen shivering 0.3 px back and forth while creeping along: every sample sits within
    // tolerance of one short chord, so only the window cap ends the chord.
    const s = createStrokeSmoother(STROKE_SMOOTHING.pen, 1);
    for (let i = 0; i < 1000; i++) s.push(i * 0.01 + (i % 2) * 0.3, 0, i * 8);
    const kept = s.end();
    expect(kept.length).toBeGreaterThanOrEqual(Math.ceil(1000 / SIMPLIFY_MAX_WINDOW));
  });
});
