import { describe, expect, it } from 'vitest';
import { describeStrokePoints, expandPackedPoints } from './stroke-points-debug';
import { encodeStrokePoints } from './stroke-points';

describe('describeStrokePoints', () => {
  it('expands a block into readable points', () => {
    const packed = encodeStrokePoints(
      [
        { nx: 0, ny: 1 },
        { nx: 1, ny: 0 },
      ],
      [0, 1],
    );
    expect(describeStrokePoints(packed)).toEqual({
      ok: true,
      version: 1,
      pressure: true,
      points: [
        { nx: 0, ny: 1, p: 0 },
        { nx: 1, ny: 0, p: 1 },
      ],
    });
  });

  it('leaves the pressure out of a stroke without one', () => {
    expect(describeStrokePoints(encodeStrokePoints([{ nx: 0, ny: 0 }]))).toEqual({
      ok: true,
      version: 1,
      pressure: false,
      points: [{ nx: 0, ny: 0 }],
    });
  });

  it('names why a block does not decode', () => {
    expect(describeStrokePoints('AgA=')).toEqual({ ok: false, rejection: 'unknown-version' });
  });
});

describe('expandPackedPoints', () => {
  it('replaces every packedPoints in a document with its points, leaving the input alone', () => {
    const packed = encodeStrokePoints([{ nx: 0.5, ny: 0.25 }]);
    const doc = {
      tabs: [{ elements: [{ id: 'f', type: 'freehand', packedPoints: packed }, { id: 's' }] }],
    };
    const expanded = expandPackedPoints(doc);
    expect(expanded).toEqual({
      tabs: [
        {
          elements: [
            {
              id: 'f',
              type: 'freehand',
              packedPoints: {
                ok: true,
                version: 1,
                pressure: false,
                points: [{ nx: 32768 / 65535, ny: 16384 / 65535 }],
              },
            },
            { id: 's' },
          ],
        },
      ],
    });
    expect(doc.tabs[0]!.elements[0]!.packedPoints).toBe(packed);
  });
});
