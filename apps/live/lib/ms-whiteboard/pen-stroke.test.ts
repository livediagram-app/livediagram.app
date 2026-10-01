import { describe, expect, it } from 'vitest';
import { decodePenStroke } from './pen-stroke';
import {
  CURRENT_UNIT_SCALE,
  OLDER_UNIT_SCALE,
  encodePenStroke,
  type StrokeLayout,
} from './ms-whiteboard-fixtures';

const points = [
  { x: 256, y: 256, p: 0.5 },
  { x: 300, y: 250, p: 0.75 },
  { x: 410, y: 600, p: 1 },
  { x: 380, y: 900, p: 0.25 },
];

// docs/specs/020-import-export/whiteboard-import.md "Pen strokes".
describe('decodePenStroke', () => {
  it.each<[StrokeLayout, number]>([
    ['current', CURRENT_UNIT_SCALE],
    ['older', OLDER_UNIT_SCALE],
    ['olderPlain', OLDER_UNIT_SCALE],
    ['olderTimed', OLDER_UNIT_SCALE],
  ])('reads the %s layout: unit scale, width, absolute pressure, delta points', (layout, unit) => {
    const stroke = decodePenStroke(encodePenStroke({ layout, width: 512, points }));
    expect(stroke).toMatchObject({ unitScale: unit, width: 512 });
    expect(stroke!.points).toEqual(points);
  });

  it('skips the extension header values', () => {
    const stroke = decodePenStroke(
      encodePenStroke({ layout: 'older', width: 105, points, extraHeaders: true }),
    );
    expect(stroke!.points).toEqual(points);
  });

  it('reads a single-point dot', () => {
    expect(
      decodePenStroke(encodePenStroke({ width: 256, points: [{ x: 128, y: 128, p: 0.5 }] }))!
        .points,
    ).toEqual([{ x: 128, y: 128, p: 0.5 }]);
  });

  it('refuses a truncated payload', () => {
    const bytes = encodePenStroke({ width: 512, points });
    expect(decodePenStroke(bytes.subarray(0, bytes.length - 1))).toBeNull();
    expect(decodePenStroke(bytes.subarray(0, 4))).toBeNull();
    expect(decodePenStroke(new Uint8Array())).toBeNull();
  });

  it('refuses a payload without a unit scale, or with per-point extras it cannot read', () => {
    expect(decodePenStroke(Uint8Array.from([0x50, 0x80, 0x40, 0x10]))).toBeNull();
    expect(decodePenStroke(Uint8Array.from([0xff, 0x06, 0, 0]))).toBeNull();
  });
});
