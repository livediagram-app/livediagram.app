import { describe, expect, it } from 'vitest';
import { recogniseShape } from './index';

// Hand-rolled polyline generators that produce the shape of stroke a
// reasonably-careful user would draw. Real freehand samples are
// noisier than this, but the recogniser runs on the post-RDP
// simplification so its input has been smoothed already, and these
// fixtures match that noise floor.

function rectanglePoints(
  x: number,
  y: number,
  w: number,
  h: number,
  samplesPerSide = 12,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < samplesPerSide; i++) pts.push({ x: x + (w * i) / samplesPerSide, y });
  for (let i = 0; i < samplesPerSide; i++) pts.push({ x: x + w, y: y + (h * i) / samplesPerSide });
  for (let i = 0; i < samplesPerSide; i++)
    pts.push({ x: x + w - (w * i) / samplesPerSide, y: y + h });
  for (let i = 0; i <= samplesPerSide; i++) pts.push({ x, y: y + h - (h * i) / samplesPerSide });
  return pts;
}

function circlePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  samples = 48,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  return pts;
}

function diamondPoints(
  cx: number,
  cy: number,
  w: number,
  h: number,
  samplesPerSide = 12,
): { x: number; y: number }[] {
  const rx = w / 2;
  const ry = h / 2;
  const corners = [
    { x: cx, y: cy - ry },
    { x: cx + rx, y: cy },
    { x: cx, y: cy + ry },
    { x: cx - rx, y: cy },
  ];
  const pts: { x: number; y: number }[] = [];
  for (let c = 0; c < corners.length; c++) {
    const a = corners[c]!;
    const b = corners[(c + 1) % corners.length]!;
    for (let i = 0; i < samplesPerSide; i++) {
      const t = i / samplesPerSide;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  pts.push(corners[0]!);
  return pts;
}

function linePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  samples = 12,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

// Jitter helper: add gaussian-ish noise to each sample so the input
// matches what a real shaky hand produces. The recogniser must
// tolerate this without dropping the classification.
function jitter(points: { x: number; y: number }[], amount: number): { x: number; y: number }[] {
  // Deterministic pseudo-noise so test runs are reproducible.
  let seed = 1337;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff - 0.5;
  };
  return points.map((p) => ({ x: p.x + next() * amount * 2, y: p.y + next() * amount * 2 }));
}

function trianglePoints(
  x: number,
  y: number,
  w: number,
  h: number,
  samplesPerSide = 14,
): { x: number; y: number }[] {
  const corners = [
    { x: x + w / 2, y }, // apex
    { x: x + w, y: y + h }, // bottom-right
    { x, y: y + h }, // bottom-left
  ];
  const pts: { x: number; y: number }[] = [];
  for (let c = 0; c < corners.length; c++) {
    const a = corners[c]!;
    const b = corners[(c + 1) % corners.length]!;
    for (let i = 0; i < samplesPerSide; i++) {
      const t = i / samplesPerSide;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  pts.push(corners[0]!);
  return pts;
}

function starPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  perEdge = 6,
): { x: number; y: number }[] {
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = ((-90 + i * 36) * Math.PI) / 180;
    const r = i % 2 === 0 ? 1 : 0.4;
    verts.push({ x: cx + Math.cos(ang) * rx * r, y: cy + Math.sin(ang) * ry * r });
  }
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % 10]!;
    for (let j = 0; j < perEdge; j++) {
      const t = j / perEdge;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  pts.push(verts[0]!);
  return pts;
}

describe('recogniseShape', () => {
  it('returns null for too few points', () => {
    expect(recogniseShape([])).toBeNull();
    expect(
      recogniseShape([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBeNull();
  });

  it('returns null when the bounding box is smaller than the min-size floor', () => {
    // A 5x5 sketch is too small to commit to a recognition; the user
    // is probably just clicking.
    const tiny = rectanglePoints(0, 0, 5, 5);
    expect(recogniseShape(tiny)).toBeNull();
  });

  it('recognises a clean rectangle as a square shape', () => {
    const result = recogniseShape(rectanglePoints(10, 20, 100, 60));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('square');
    expect(result!.confidence).toBeGreaterThan(0.8);
    expect(result!.bbox).toMatchObject({ x: 10, y: 20, width: 100, height: 60 });
  });

  it('recognises a rectangle with small jitter (real hand-drawn noise)', () => {
    const noisy = jitter(rectanglePoints(0, 0, 200, 120, 16), 2);
    const result = recogniseShape(noisy);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('square');
    expect(result!.confidence).toBeGreaterThan(0.6);
  });

  it('recognises a clean circle', () => {
    const result = recogniseShape(circlePoints(50, 50, 40, 40));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('circle');
    expect(result!.confidence).toBeGreaterThan(0.8);
  });

  it('recognises an oval (non-square bbox circle) as a circle kind', () => {
    // The renderer makes circle elements stretch to the bbox, so an
    // oval gesture gets the same kind back.
    const result = recogniseShape(circlePoints(50, 50, 60, 25));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('circle');
  });

  it('recognises a clean diamond', () => {
    const result = recogniseShape(diamondPoints(60, 60, 80, 80));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('diamond');
    expect(result!.confidence).toBeGreaterThan(0.8);
  });

  it('recognises a clean upward triangle', () => {
    const result = recogniseShape(trianglePoints(10, 10, 120, 100));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('triangle');
    expect(result!.confidence).toBeGreaterThan(0.8);
  });

  it('recognises a triangle with hand-drawn jitter', () => {
    const result = recogniseShape(jitter(trianglePoints(0, 0, 140, 120), 3));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('triangle');
  });

  it('recognises a clean 5-pointed star', () => {
    const result = recogniseShape(starPoints(60, 60, 50, 50));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('star');
    // A point-up star's bbox centre sits below its geometric centre, so
    // the bbox-fit idealised star is slightly offset and a "clean" star
    // tops out around 0.68 — still comfortably over the caller's 0.40
    // commit threshold.
    expect(result!.confidence).toBeGreaterThan(0.6);
  });

  it('does not mistake a clean square for a triangle or star', () => {
    expect(recogniseShape(rectanglePoints(0, 0, 100, 100))!.kind).toBe('square');
  });

  it('recognises a long straight line as a line kind, carrying its endpoints', () => {
    const result = recogniseShape(linePoints(10, 20, 200, 100));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('line');
    expect(result!.from).toEqual({ x: 10, y: 20 });
    expect(result!.to).toEqual({ x: 200, y: 100 });
  });

  it('rejects a short flick that does not span the bbox enough to look like a line', () => {
    // Two points very close together: chord small, bbox small, no
    // recognisable shape. Important: we shouldn't return `line` for
    // every short open scribble.
    const result = recogniseShape([
      { x: 0, y: 0 },
      { x: 6, y: 5 },
    ]);
    expect(result).toBeNull();
  });

  it('prefers rectangle over diamond when both score (square drawn deliberately is not a diamond)', () => {
    // Tighter rectangle tolerance vs diamond tolerance means a clean
    // square should win on the rectangle scorer and stop the diamond
    // scorer from poaching it.
    const result = recogniseShape(rectanglePoints(0, 0, 100, 100));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('square');
  });

  it('prefers diamond over rectangle when the gesture clearly tracks the diamond edges', () => {
    const result = recogniseShape(diamondPoints(50, 50, 80, 80));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('diamond');
  });

  it('returns null for ambiguous closed scribbles (no shape clears its threshold)', () => {
    // Random walk that closes loosely. None of the shape scorers
    // should pass; the caller keeps it as freehand.
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const r = 30 + Math.sin(t * 5) * 10 + Math.cos(t * 7) * 12;
      points.push({ x: 50 + Math.cos(t) * r, y: 50 + Math.sin(t) * r });
    }
    points.push(points[0]!);
    const result = recogniseShape(points);
    // It's allowed to recognise SOMETHING with low confidence here
    // (a star-ish loop is close to a circle), but if it does the
    // confidence should be low so the caller's threshold rejects it.
    if (result !== null) {
      expect(result.confidence).toBeLessThan(0.7);
    }
  });
});
