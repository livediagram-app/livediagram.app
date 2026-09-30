import { describe, expect, it } from 'vitest';
import {
  STROKE_CHUNK_SEGMENTS,
  STROKE_SMOOTHING,
  catmullRomToBezierPath,
  createStrokePathBuilder,
  createStrokeSmoother,
  type StrokePathFrame,
} from './index';
import { loopsAt, sampleTrace } from './stroke-test-traces';

// The live stroke's SVG path (blueprint "Live stroke pipeline", Path): sealed chunks never rebuilt,
// one live path, and together exactly the path the committed stroke renders.

/** Sealed chunks and the live path as one path: every chunk after the first loses its `M x y`. */
function joined(sealed: string[], live: string): string {
  const all = [...sealed, live];
  return all.map((d, i) => (i === 0 ? d : d.replace(/^M \S+ \S+ /, ''))).join(' ');
}

/** The segments (`C …`) of a path, in order. */
const segments = (d: string) => d.split(/ (?=C )/).slice(1);

describe('createStrokePathBuilder', () => {
  it('draws nothing for no points, a bare move for one', () => {
    const b = createStrokePathBuilder();
    expect(b.update([], [])).toEqual({ sealed: [], live: '' });
    expect(b.update([], [{ x: 3, y: 4 }]).live).toBe('M 3 4');
  });

  it('seals a chunk every STROKE_CHUNK_SEGMENTS final segments and never rebuilds it', () => {
    expect(STROKE_CHUNK_SEGMENTS).toBe(64);
    const points = Array.from({ length: 150 }, (_, i) => ({ x: i * 5, y: (i % 7) * 3 }));
    const b = createStrokePathBuilder();
    const sealed: string[] = [];
    let frame: StrokePathFrame;
    // Points become final a few at a time; the last two stay in the tail.
    for (let k = 1; k <= points.length - 2; k += 3) {
      frame = b.update(points.slice(0, k), points.slice(k));
      sealed.push(...frame.sealed);
    }
    frame = b.update(points, []);
    sealed.push(...frame.sealed);
    expect(sealed).toHaveLength(Math.floor((points.length - 2) / STROKE_CHUNK_SEGMENTS));
    for (const chunk of sealed) expect(segments(chunk)).toHaveLength(STROKE_CHUNK_SEGMENTS);
    expect(joined(sealed, frame.live)).toBe(catmullRomToBezierPath(points, false));
  });

  it('keeps the live path short however long the stroke is', () => {
    const points = Array.from({ length: 400 }, (_, i) => ({ x: i, y: Math.sin(i / 9) * 20 }));
    const b = createStrokePathBuilder();
    let longest = 0;
    for (let k = 1; k <= points.length - 3; k += 2) {
      const f = b.update(points.slice(0, k), points.slice(k, k + 3));
      longest = Math.max(longest, segments(f.live).length);
    }
    expect(longest).toBeLessThanOrEqual(STROKE_CHUNK_SEGMENTS + 4);
  });

  it('matches the committed path frame by frame on a live stroke, final segments never changing', () => {
    const trace = sampleTrace(loopsAt(300, 8, 160), 400, 240, { white: 0.4, seed: 21 });
    const s = createStrokeSmoother(STROKE_SMOOTHING.pen, 1);
    // Small chunks, so a short stroke seals several.
    const b = createStrokePathBuilder(8);
    const sealed: string[] = [];
    const frames: { d: string; final: number }[] = [];
    trace.forEach((p, i) => {
      s.push(p.x, p.y, p.t);
      if (i % 2 === 0 && i !== trace.length - 1) return;
      const f = b.update(s.kept, s.tail());
      sealed.push(...f.sealed);
      const d = joined(sealed, f.live);
      // Each frame shows exactly the path its points would commit as.
      expect(d).toBe(catmullRomToBezierPath([...s.kept, ...s.tail()], false));
      frames.push({ d, final: Math.max(0, s.kept.length - 2) });
    });
    const end = s.end();
    const last = b.update(s.kept, s.tail());
    sealed.push(...last.sealed);
    const landed = catmullRomToBezierPath(end, false);
    // No jump: the last frame is what lands.
    expect(joined(sealed, last.live)).toBe(landed);
    expect(frames[frames.length - 1]!.d).toBe(landed);
    // Prefix stability: every frame's final segments survive, unchanged, to the end.
    const endSegments = segments(landed);
    for (const f of frames) {
      expect(segments(f.d).slice(0, f.final)).toEqual(endSegments.slice(0, f.final));
    }
    expect(sealed.length).toBeGreaterThan(0);
  });
});
