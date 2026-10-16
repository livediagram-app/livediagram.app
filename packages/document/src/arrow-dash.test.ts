import { describe, expect, it } from 'vitest';
import { arrowDashOffset } from './arrow-dash';
import type { ArrowElement } from './index';

// docs/specs/008-canvas/arrow-anchors.md "End at exact anchor": a shared end's dashes are anchored there.

const arrow = (extra: Partial<ArrowElement>): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  arrowStyle: 'straight',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 0, y: 100 },
  ...extra,
});

describe('arrowDashOffset', () => {
  it("puts the pattern's start at the end of a dashed arrow with an exact end", () => {
    // "6 5" repeats every 11: 100 = 9 × 11 + 1, so the pattern is pulled back 10 to start at the end.
    expect(
      arrowDashOffset(
        arrow({ strokeStyle: 'dashed', exactEnd: true }),
        { x: 0, y: 0 },
        { x: 0, y: 100 },
      ),
    ).toBe(10);
    // Two arrows of different lengths into one end are in step there: offset + length is a whole number of periods.
    const at = (len: number) =>
      arrowDashOffset(
        arrow({ strokeStyle: 'dashed', exactEnd: true }),
        { x: 0, y: 0 },
        { x: 0, y: len },
      )!;
    expect((at(37) + 37) % 11).toBeCloseTo(0);
    expect((at(250) + 250) % 11).toBeCloseTo(0);
  });

  it('leaves a solid line, and a dashed one whose end is its own, as they are', () => {
    expect(
      arrowDashOffset(arrow({ exactEnd: true }), { x: 0, y: 0 }, { x: 0, y: 100 }),
    ).toBeUndefined();
    expect(
      arrowDashOffset(arrow({ strokeStyle: 'dashed' }), { x: 0, y: 0 }, { x: 0, y: 100 }),
    ).toBeUndefined();
  });
});
