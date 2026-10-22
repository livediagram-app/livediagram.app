import { describe, expect, it } from 'vitest';
import { createFreehand, type Element } from '@livediagram/document';
import { compactLanded, roundTo } from './compact';

// docs/specs/020-import-export/board-scene.md "Compact output": boxes and arrow ends to a
// hundredth of a pixel; a stroke stays exactly as the codec packed it.
describe('compactLanded', () => {
  it('keeps boxes to a hundredth of a pixel', () => {
    const shape = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 10.123456,
      y: 20.987654,
      width: 99.999999,
      height: 50.004,
    } as Element;
    expect(compactLanded([shape])[0]).toMatchObject({ x: 10.12, y: 20.99, width: 100, height: 50 });
  });

  it('rounds an arrow’s free ends and bends, leaving pinned ones alone', () => {
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 1.23456, y: 2.34567 },
      to: { kind: 'pinned', elementId: 'b', anchor: 'e' },
      curvePoints: [{ dx: 0.333333, dy: -0.666666 }],
    } as Element;
    expect(compactLanded([arrow])[0]).toMatchObject({
      from: { kind: 'free', x: 1.23, y: 2.35 },
      to: { kind: 'pinned' },
      curvePoints: [{ dx: 0.33, dy: -0.67 }],
    });
  });

  it('leaves a stroke exactly as the codec packed it', () => {
    const stroke = createFreehand(
      [
        { x: 0.123, y: 0.456 },
        { x: 50.789, y: 20.001 },
      ],
      false,
    );
    expect(compactLanded([stroke])[0]).toBe(stroke);
  });
});

describe('roundTo', () => {
  it('rounds half away from zero, and turns -0 into 0', () => {
    expect(roundTo(0.125, 2)).toBe(0.13);
    expect(Object.is(roundTo(-0.0001, 2), -0)).toBe(false);
  });
});
