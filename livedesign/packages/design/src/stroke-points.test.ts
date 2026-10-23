import { describe, expect, it } from 'vitest';
import {
  MAX_FREEHAND_POINTS,
  MAX_PACKED_POINTS_LENGTH,
  STROKE_POINT_MAX_ERROR,
  STROKE_PRESSURE_MAX_ERROR,
  encodeStrokePoints,
  parseStrokePoints,
  strokePointCount,
  type NormalisedPoint,
  type StrokePoints,
} from './stroke-points';

function bytesOf(packed: string): number[] {
  return [...Buffer.from(packed, 'base64')];
}

function packedOf(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

function decoded(packed: string): StrokePoints {
  const parsed = parseStrokePoints(packed);
  if (!parsed.ok) throw new Error(parsed.rejection);
  return parsed.points;
}

// A deterministic wobbly stroke: no randomness, so failures reproduce.
function wobble(count: number): NormalisedPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    nx: (Math.sin(i * 0.37) + 1) / 2,
    ny: (Math.cos(i * 0.21 + 0.5) + 1) / 2,
  }));
}

describe('encodeStrokePoints', () => {
  it('writes the version, the flags and one little-endian record per point', () => {
    const packed = encodeStrokePoints([
      { nx: 0, ny: 1 },
      { nx: 1, ny: 0.5 },
    ]);
    expect(bytesOf(packed)).toEqual([1, 0, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x80]);
  });

  it('sets the pressure flag and appends a pressure byte to each record', () => {
    const packed = encodeStrokePoints([{ nx: 0, ny: 0 }], [1]);
    expect(bytesOf(packed)).toEqual([1, 1, 0, 0, 0, 0, 0xff]);
  });

  it('writes an empty stroke as the header alone', () => {
    expect(encodeStrokePoints([])).toBe('AQA=');
  });

  it('clamps float noise outside the box into it', () => {
    const packed = encodeStrokePoints([{ nx: -1e-12, ny: 1 + 1e-12 }]);
    expect(bytesOf(packed)).toEqual([1, 0, 0, 0, 0xff, 0xff]);
  });

  it('throws on a non-finite coordinate or pressure', () => {
    expect(() => encodeStrokePoints([{ nx: Number.NaN, ny: 0 }])).toThrow(
      'stroke-point-not-finite',
    );
    expect(() => encodeStrokePoints([{ nx: 0, ny: 0 }], [Infinity])).toThrow(
      'stroke-point-not-finite',
    );
  });

  it('throws when the pressures do not match the points', () => {
    expect(() => encodeStrokePoints([{ nx: 0, ny: 0 }], [0.5, 0.5])).toThrow(
      'stroke-pressures-length',
    );
  });

  it('throws past the point cap', () => {
    expect(() => encodeStrokePoints(wobble(MAX_FREEHAND_POINTS + 1))).toThrow(
      'stroke-too-many-points',
    );
  });
});

describe('parseStrokePoints', () => {
  it('round-trips every point within the precision bound', () => {
    const points = wobble(500);
    const back = decoded(encodeStrokePoints(points));
    expect(back.count).toBe(500);
    expect(back.pressures).toBeNull();
    points.forEach((p, i) => {
      expect(Math.abs(back.nx[i]! - p.nx)).toBeLessThanOrEqual(STROKE_POINT_MAX_ERROR);
      expect(Math.abs(back.ny[i]! - p.ny)).toBeLessThanOrEqual(STROKE_POINT_MAX_ERROR);
    });
  });

  it('holds the bound in canvas px for tiny and huge boxes', () => {
    const points = wobble(200);
    const back = decoded(encodeStrokePoints(points));
    for (const side of [1, 3, 1_000, 10_000, 100_000]) {
      points.forEach((p, i) => {
        expect(Math.abs(back.nx[i]! - p.nx) * side).toBeLessThanOrEqual(side / 131_070);
      });
    }
    // The spec's worked examples.
    expect(1_000 * STROKE_POINT_MAX_ERROR).toBeLessThan(0.008);
    expect(10_000 * STROKE_POINT_MAX_ERROR).toBeLessThan(0.08);
  });

  it('keeps pressures within their bound', () => {
    const points = wobble(64);
    const pressures = points.map((_, i) => (i % 17) / 16);
    const back = decoded(encodeStrokePoints(points, pressures));
    expect(back.pressures).not.toBeNull();
    pressures.forEach((p, i) => {
      expect(Math.abs(back.pressures![i]! - p)).toBeLessThanOrEqual(STROKE_PRESSURE_MAX_ERROR);
    });
  });

  it('stores the box edges exactly', () => {
    const back = decoded(
      encodeStrokePoints([
        { nx: 0, ny: 0 },
        { nx: 1, ny: 1 },
      ]),
    );
    expect([...back.nx]).toEqual([0, 1]);
    expect([...back.ny]).toEqual([0, 1]);
  });

  it('reads a degenerate box (all on one axis) and a single point', () => {
    const flat = decoded(
      encodeStrokePoints([
        { nx: 0, ny: 0.25 },
        { nx: 0, ny: 0.75 },
      ]),
    );
    expect([...flat.nx]).toEqual([0, 0]);
    const dot = decoded(encodeStrokePoints([{ nx: 0.5, ny: 0.5 }], [0.3]));
    expect(dot.count).toBe(1);
  });

  it('reads an empty stroke', () => {
    expect(decoded('AQA=').count).toBe(0);
  });

  it('re-encodes a decoded block to the same block', () => {
    const packed = encodeStrokePoints(
      wobble(300),
      wobble(300).map((p) => p.nx),
    );
    const back = decoded(packed);
    const again = encodeStrokePoints(
      Array.from({ length: back.count }, (_, i) => ({ nx: back.nx[i]!, ny: back.ny[i]! })),
      [...back.pressures!],
    );
    expect(again).toBe(packed);
  });

  it('round-trips the largest stroke allowed', () => {
    const points = wobble(MAX_FREEHAND_POINTS);
    const packed = encodeStrokePoints(
      points,
      points.map(() => 0.5),
    );
    expect(packed.length).toBe(MAX_PACKED_POINTS_LENGTH);
    expect(decoded(packed).count).toBe(MAX_FREEHAND_POINTS);
  });

  it.each([
    ['not-a-string', 42],
    ['not-a-string', undefined],
    ['too-long', 'A'.repeat(MAX_PACKED_POINTS_LENGTH + 4)],
    ['not-base64', 'AQA'],
    ['not-base64', 'AQ A='],
    ['not-base64', 'AQ*='],
    ['not-base64', 'AQB='],
    ['too-short', packedOf([1])],
    ['too-short', ''],
    ['unknown-version', packedOf([2, 0, 0, 0, 0, 0])],
    ['unknown-flags', packedOf([1, 2, 0, 0, 0, 0])],
    ['ragged', packedOf([1, 0, 0, 0, 0])],
    ['ragged', packedOf([1, 1, 0, 0, 0, 0])],
  ])('rejects %s', (rejection, input) => {
    expect(parseStrokePoints(input)).toEqual({ ok: false, rejection });
  });

  it('rejects more records than the point cap', () => {
    const bytes = new Array<number>(2 + (MAX_FREEHAND_POINTS + 1) * 4).fill(0);
    bytes[0] = 1;
    const packed = packedOf(bytes);
    expect(packed.length).toBeLessThanOrEqual(MAX_PACKED_POINTS_LENGTH);
    expect(parseStrokePoints(packed)).toEqual({ ok: false, rejection: 'too-many-points' });
  });
});

describe('strokePointCount', () => {
  it('counts records from the length alone', () => {
    expect(strokePointCount(encodeStrokePoints(wobble(7)))).toBe(7);
    expect(strokePointCount(encodeStrokePoints(wobble(8), new Array(8).fill(0.5)))).toBe(8);
    expect(strokePointCount('AQA=')).toBe(0);
  });
});
