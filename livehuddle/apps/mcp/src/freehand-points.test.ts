import { describe, expect, it } from 'vitest';
import { describeStrokePoints, MAX_FREEHAND_POINTS } from '@livehuddle/document';
import { packFreehandPoints } from './freehand-points';

describe('packFreehandPoints', () => {
  it('takes a stroke’s box from its canvas points and packs them inside it', () => {
    const out = packFreehandPoints([
      {
        id: 's',
        type: 'freehand',
        penColour: 'blue',
        points: [
          [10, 50],
          [110, 70],
          [210, 50],
        ],
      },
    ]);
    if ('error' in out) throw new Error(out.error);
    const el = out.elements[0] as Record<string, unknown>;
    expect([el.x, el.y, el.width, el.height, el.closed, el.penColour]).toEqual([
      10,
      50,
      200,
      20,
      false,
      'blue',
    ]);
    expect(el.points).toBeUndefined();
    const block = describeStrokePoints(el.packedPoints as string);
    if (!block.ok) throw new Error(block.rejection);
    expect(block.points[1]!.nx).toBeCloseTo(0.5, 3);
    expect(block.points[1]!.ny).toBeCloseTo(1, 3);
  });

  it('draws the given points, not a packed form echoed from a read', () => {
    const first = packFreehandPoints([
      {
        id: 's',
        type: 'freehand',
        points: [
          [0, 0],
          [100, 100],
        ],
      },
    ]);
    if ('error' in first) throw new Error(first.error);
    const old = (first.elements[0] as Record<string, unknown>).packedPoints;
    // The model echoes the stroke with its packed form and gives new points: a dip, not a diagonal.
    const out = packFreehandPoints([
      {
        id: 's',
        type: 'freehand',
        packedPoints: old,
        points: [
          [0, 0],
          [50, 100],
          [100, 0],
        ],
      },
    ]);
    if ('error' in out) throw new Error(out.error);
    const block = describeStrokePoints(
      (out.elements[0] as Record<string, unknown>).packedPoints as string,
    );
    if (!block.ok) throw new Error(block.rejection);
    expect(block.points).toHaveLength(3);
    expect(block.points[1]!.ny).toBeCloseTo(1, 3);
  });

  it('packs a flat line on its zero-height axis, and passes everything else through', () => {
    const line = {
      type: 'freehand',
      closed: true,
      points: [
        [0, 5],
        [40, 5],
      ],
    };
    const box = { id: 'b', type: 'shape', shape: 'square' };
    const stored = { type: 'freehand', packedPoints: 'AQA=' };
    const out = packFreehandPoints([line, box, stored, 'not an element']);
    if ('error' in out) throw new Error(out.error);
    const el = out.elements[0] as Record<string, unknown>;
    expect([el.height, el.closed]).toEqual([0, true]);
    expect(out.elements.slice(1)).toEqual([box, stored, 'not an element']);
  });

  it('refuses points it cannot draw, naming the element', () => {
    const bad = (points: unknown, id?: string) =>
      packFreehandPoints([{ ...(id ? { id } : {}), type: 'freehand', points }]);
    expect(bad([], 's')).toEqual({
      error: `element "s": "points" takes 1 to ${MAX_FREEHAND_POINTS} canvas points, [[x, y], ...]`,
    });
    expect('error' in bad([{ nx: 0, ny: 0 }])).toBe(true);
    expect('error' in bad([[0, Number.NaN]])).toBe(true);
    expect('error' in bad('0,0 1,1')).toBe(true);
    expect(bad([[0]])).toMatchObject({ error: expect.stringMatching(/^element 1:/) });
  });
});
