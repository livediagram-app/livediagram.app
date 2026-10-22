import { describe, expect, it } from 'vitest';
import { boxCorners, boxFromReadout, boxReadout, dragBox, grabAt } from './box';
import { apply, IDENTITY, translate } from './matrix';

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};
const none = { shift: false, alt: false };

describe('the transform box', () => {
  it('grabs a handle, the inside, or the outside', () => {
    const m = translate(10, 10);
    expect(grabAt(m, 100, 50, { x: 10, y: 10 }, 4)).toEqual({ kind: 'scale', handle: 'nw' });
    expect(grabAt(m, 100, 50, { x: 60, y: 61 }, 4)).toEqual({ kind: 'scale', handle: 's' });
    expect(grabAt(m, 100, 50, { x: 110, y: 10 }, 4, true)).toEqual({
      kind: 'distort',
      handle: 'ne',
    });
    // An edge handle never distorts.
    expect(grabAt(m, 100, 50, { x: 110, y: 35 }, 4, true)).toEqual({ kind: 'scale', handle: 'e' });
    expect(grabAt(m, 100, 50, { x: 50, y: 30 }, 4)).toEqual({ kind: 'move' });
    expect(grabAt(m, 100, 50, { x: 200, y: 200 }, 4)).toEqual({ kind: 'rotate' });
    // On a small box the nearest handle wins, not the first in reach.
    expect(grabAt(IDENTITY, 10, 10, { x: 10, y: 10 }, 8)).toEqual({ kind: 'scale', handle: 'se' });
  });

  it('moves by the drag', () => {
    const m = dragBox(IDENTITY, 10, 10, { kind: 'move' }, { x: 5, y: 5 }, { x: 8, y: 1 }, none);
    near(apply(m, { x: 0, y: 0 }), { x: 3, y: -4 });
  });

  it('scales from the opposite handle, or about the centre with Alt', () => {
    const grab = { kind: 'scale', handle: 'se' } as const;
    const m = dragBox(IDENTITY, 100, 50, grab, { x: 100, y: 50 }, { x: 200, y: 75 }, none);
    near(apply(m, { x: 0, y: 0 }), { x: 0, y: 0 });
    near(apply(m, { x: 100, y: 50 }), { x: 200, y: 75 });
    const c = dragBox(
      IDENTITY,
      100,
      50,
      grab,
      { x: 100, y: 50 },
      { x: 150, y: 50 },
      { shift: false, alt: true },
    );
    near(apply(c, { x: 50, y: 25 }), { x: 50, y: 25 });
    near(apply(c, { x: 100, y: 25 }), { x: 150, y: 25 });
  });

  it('keeps the shape with Shift', () => {
    const grab = { kind: 'scale', handle: 'se' } as const;
    const m = dragBox(
      IDENTITY,
      100,
      50,
      grab,
      { x: 100, y: 50 },
      { x: 200, y: 60 },
      { shift: true, alt: false },
    );
    near(apply(m, { x: 100, y: 50 }), { x: 200, y: 100 });
    // An edge handle with Shift scales both ways, about the opposite edge's middle.
    const e = dragBox(
      IDENTITY,
      100,
      50,
      { kind: 'scale', handle: 'e' },
      { x: 100, y: 25 },
      { x: 200, y: 25 },
      { shift: true, alt: false },
    );
    near(apply(e, { x: 100, y: 50 }), { x: 200, y: 75 });
  });

  it('scales a turned box along its own axes', () => {
    const turned = dragBox(
      IDENTITY,
      100,
      50,
      { kind: 'rotate' },
      { x: 100, y: 25 },
      { x: 50, y: 75 },
      none,
    );
    const wide = dragBox(
      turned,
      100,
      50,
      { kind: 'scale', handle: 'e' },
      apply(turned, { x: 100, y: 25 }),
      apply(turned, { x: 150, y: 25 }),
      none,
    );
    const r = boxReadout(wide, 100, 50);
    expect(r.width).toBeCloseTo(150, 4);
    expect(r.height).toBeCloseTo(50, 4);
    expect(r.angle).toBeCloseTo(90, 4);
  });

  it('rotates about the centre, in 15° steps with Shift', () => {
    const m = dragBox(
      IDENTITY,
      100,
      100,
      { kind: 'rotate' },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      none,
    );
    expect(boxReadout(m, 100, 100).angle).toBeCloseTo(90, 6);
    near(apply(m, { x: 50, y: 50 }), { x: 50, y: 50 });
    const s = dragBox(
      IDENTITY,
      100,
      100,
      { kind: 'rotate' },
      { x: 100, y: 50 },
      { x: 100, y: 62 },
      { shift: true, alt: false },
    );
    expect(boxReadout(s, 100, 100).angle).toBeCloseTo(15, 6);
  });

  it('distorts one corner freely', () => {
    const m = dragBox(
      IDENTITY,
      10,
      10,
      { kind: 'distort', handle: 'se' },
      { x: 10, y: 10 },
      { x: 14, y: 12 },
      none,
    );
    const c = boxCorners(m, 10, 10);
    near(c[0]!, { x: 0, y: 0 });
    near(c[1]!, { x: 10, y: 0 });
    near(c[2]!, { x: 14, y: 12 });
    near(c[3]!, { x: 0, y: 10 });
  });

  it('round-trips the options bar readout', () => {
    const r = { x: 20, y: 30, width: 200, height: 80, angle: 30 };
    const back = boxReadout(boxFromReadout(100, 40, r), 100, 40);
    for (const k of ['x', 'y', 'width', 'height', 'angle'] as const)
      expect(back[k]).toBeCloseTo(r[k], 6);
  });
});

describe('Skew and Perspective', () => {
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  };

  it('grab an edge to skew, a corner for perspective, and scale as ever in Free', () => {
    const m = IDENTITY;
    expect(grabAt(m, 100, 50, { x: 50, y: 0 }, 4, false, 'skew')).toEqual({
      kind: 'skew',
      handle: 'n',
    });
    expect(grabAt(m, 100, 50, { x: 100, y: 0 }, 4, false, 'skew')).toEqual({
      kind: 'scale',
      handle: 'ne',
    });
    expect(grabAt(m, 100, 50, { x: 100, y: 0 }, 4, false, 'perspective')).toEqual({
      kind: 'perspective',
      handle: 'ne',
    });
    expect(grabAt(m, 100, 50, { x: 100, y: 0 }, 4, true, 'perspective')).toEqual({
      kind: 'distort',
      handle: 'ne',
    });
  });

  it('skews by sliding the grabbed edge along itself', () => {
    const next = dragBox(
      IDENTITY,
      100,
      50,
      { kind: 'skew', handle: 'n' },
      { x: 50, y: 0 },
      { x: 70, y: 9 },
      {
        shift: false,
        alt: false,
      },
    );
    const [nw, ne, se, sw] = boxCorners(next, 100, 50);
    near(nw!, { x: 20, y: 0 });
    near(ne!, { x: 120, y: 0 });
    near(se!, { x: 100, y: 50 });
    near(sw!, { x: 0, y: 50 });
  });

  it('moves a corner and its partner apart along the edge the drag follows', () => {
    const keys = { shift: false, alt: false };
    const wider = dragBox(
      IDENTITY,
      100,
      50,
      { kind: 'perspective', handle: 'ne' },
      { x: 100, y: 0 },
      { x: 110, y: 2 },
      keys,
    );
    const [nw, ne, se, sw] = boxCorners(wider, 100, 50);
    near(ne!, { x: 110, y: 0 });
    near(nw!, { x: -10, y: 0 });
    near(se!, { x: 100, y: 50 });
    near(sw!, { x: 0, y: 50 });
    const taller = dragBox(
      IDENTITY,
      100,
      50,
      { kind: 'perspective', handle: 'se' },
      { x: 100, y: 50 },
      { x: 101, y: 60 },
      keys,
    );
    const c = boxCorners(taller, 100, 50);
    near(c[2]!, { x: 100, y: 60 });
    near(c[1]!, { x: 100, y: -10 });
  });
});
