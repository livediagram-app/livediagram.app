import { describe, expect, it } from 'vitest';
import { curveAnchorPoints } from './arrow-path';
import { orthogonalBends, withFacingBends } from './arrow-orthogonal';
import { createPinnedArrow, createShape } from './factories';
import type { ArrowElement, Element } from './index';

// docs/specs/008-canvas/layout-cleanup.md "Angled lines bend twice".

const box = (id: string, x: number, y: number): Element => ({
  ...createShape('square', x, y),
  id,
  width: 100,
  height: 60,
});
const angled = (from: string, to: string): ArrowElement => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `${from}-${to}`,
  arrowStyle: 'angled',
});

describe('orthogonal bends', () => {
  it('bends at half height, straight above each end', () => {
    const els = [box('p', 0, 0), box('c', 300, 200), angled('p', 'c')];
    const bends = orthogonalBends(els[2] as ArrowElement, els, 'TB')!;
    // p's bottom is (50, 60), c's top is (350, 200): bends at y = 130.
    expect(curveAnchorPoints({ x: 50, y: 60 }, { x: 350, y: 200 }, bends)).toEqual([
      { x: 50, y: 130 },
      { x: 350, y: 130 },
    ]);
  });

  it('bends once out of a side across the flow, then along it into the other end', () => {
    // p's right side (100, 30) to c's top (350, 200): across first, then down.
    const side: ArrowElement = {
      ...createPinnedArrow('p', 'e', 'c', 'n'),
      id: 'side',
      arrowStyle: 'angled',
    };
    const els = [box('p', 0, 0), box('c', 300, 200), side];
    const bends = orthogonalBends(side, els, 'TB')!;
    expect(curveAnchorPoints({ x: 100, y: 30 }, { x: 350, y: 200 }, bends)).toEqual([
      { x: 350, y: 30 },
    ]);
    // Into a side from the flow: along first, then across. Left to right, a top end is the one across.
    const into: ArrowElement = {
      ...createPinnedArrow('c', 'n', 'p', 'e'),
      id: 'into',
      arrowStyle: 'angled',
    };
    expect(
      curveAnchorPoints(
        { x: 350, y: 200 },
        { x: 100, y: 30 },
        orthogonalBends(into, [box('p', 0, 0), box('c', 300, 200), into], 'TB')!,
      ),
    ).toEqual([{ x: 350, y: 30 }]);
    const lr: ArrowElement = {
      ...createPinnedArrow('p', 's', 'c', 'w'),
      id: 'lr',
      arrowStyle: 'angled',
    };
    expect(
      curveAnchorPoints(
        { x: 50, y: 60 },
        { x: 300, y: 230 },
        orthogonalBends(lr, [box('p', 0, 0), box('c', 300, 200), lr], 'LR')!,
      ),
    ).toEqual([{ x: 50, y: 230 }]);
  });

  it('runs a side-to-top pair straight when its ends line up', () => {
    const side: ArrowElement = {
      ...createPinnedArrow('p', 'e', 'c', 'n'),
      id: 'side',
      arrowStyle: 'angled',
    };
    const els = [box('p', 0, 0), box('c', 50, 200), side];
    expect(orthogonalBends(side, els, 'TB')).toBeUndefined();
  });
});

// docs/specs/008-canvas/layout-cleanup.md "Angled lines bend twice": an agent's own elements.
describe('facing bends', () => {
  const pinned = (
    id: string,
    from: string,
    fa: 'n' | 'e' | 's' | 'w',
    to: string,
    ta: 'n' | 'e' | 's' | 'w',
  ) => ({ ...createPinnedArrow(from, fa, to, ta), id, arrowStyle: 'angled' }) as ArrowElement;

  it('bends a bottom-to-top arrow into a lower box twice, at half height', () => {
    const els = [box('p', 0, 0), box('c', 300, 200), pinned('a', 'p', 's', 'c', 'n')];
    const a = withFacingBends(els)[2] as ArrowElement;
    expect(curveAnchorPoints({ x: 50, y: 60 }, { x: 350, y: 200 }, a.curvePoints!)).toEqual([
      { x: 50, y: 130 },
      { x: 350, y: 130 },
    ]);
  });

  it('bends a right-to-left arrow into a box further right twice, at half width', () => {
    const els = [box('p', 0, 0), box('c', 300, 200), pinned('a', 'p', 'e', 'c', 'w')];
    const a = withFacingBends(els)[2] as ArrowElement;
    expect(curveAnchorPoints({ x: 100, y: 30 }, { x: 300, y: 230 }, a.curvePoints!)).toEqual([
      { x: 200, y: 30 },
      { x: 200, y: 230 },
    ]);
  });

  it('bends top-to-bottom and left-to-right arrows the other way round too', () => {
    const els = [
      box('p', 0, 0),
      box('c', 300, 200),
      pinned('up', 'c', 'n', 'p', 's'),
      pinned('back', 'c', 'w', 'p', 'e'),
    ];
    const out = withFacingBends(els);
    expect((out[2] as ArrowElement).curvePoints).toHaveLength(2);
    expect((out[3] as ArrowElement).curvePoints).toHaveLength(2);
  });

  it('leaves an L whose ends do not face, a curved or straight arrow, and given bends alone', () => {
    const given = { ...pinned('given', 'p', 's', 'c', 'n'), curvePoints: [{ dx: 5, dy: 5 }] };
    const els = [
      box('p', 0, 200),
      box('c', 300, 0),
      pinned('away', 'p', 's', 'c', 'n'),
      pinned('mixed', 'p', 'e', 'c', 's'),
      { ...pinned('curved', 'p', 's', 'c', 'n'), arrowStyle: 'curved' } as ArrowElement,
      given,
      { ...createShape('square', 0, 0), id: 'loose' } as Element,
    ];
    expect(withFacingBends(els)).toEqual(els);
  });

  it('runs a facing arrow straight when its ends line up', () => {
    const els = [box('p', 0, 0), box('c', 0, 200), pinned('a', 'p', 's', 'c', 'n')];
    expect(withFacingBends(els)[2]).toMatchObject({ arrowStyle: 'straight' });
  });

  it("keeps the cross run off a frame's heading band and border, nearest half way", () => {
    // p's bottom (50, 60) to c's top (350, 300): half way is 180, inside the frame's heading band (170..202).
    const frame = { ...createShape('frame', 0, 170), id: 'f', width: 500, height: 200 } as Element;
    const els = [box('p', 0, 0), { ...box('c', 300, 300) }, frame, pinned('a', 'p', 's', 'c', 'n')];
    const a = withFacingBends(els)[3] as ArrowElement;
    expect(curveAnchorPoints({ x: 50, y: 60 }, { x: 350, y: 300 }, a.curvePoints!)[0]!.y).toBe(162);
  });

  it('keeps the cross run off a box between the ends, and half way when nothing is clear', () => {
    const between = { ...box('m', 150, 100), height: 100 };
    const els = [box('p', 0, 0), box('c', 300, 300), between, pinned('a', 'p', 's', 'c', 'n')];
    const a = withFacingBends(els)[3] as ArrowElement;
    // Half way (180) is inside m (92..208 with its clearance): the nearest clear level is 208.
    expect(curveAnchorPoints({ x: 50, y: 60 }, { x: 350, y: 300 }, a.curvePoints!)[0]!.y).toBe(208);
    const wall = { ...box('w', 0, 70), width: 400, height: 220 };
    const walled = [box('p', 0, 0), box('c', 300, 300), wall, pinned('a', 'p', 's', 'c', 'n')];
    const b = withFacingBends(walled)[3] as ArrowElement;
    expect(curveAnchorPoints({ x: 50, y: 60 }, { x: 350, y: 300 }, b.curvePoints!)[0]!.y).toBe(180);
  });

  it("keeps a cross run off another facing arrow's run where their spans overlap", () => {
    // Two arrows down from p into c and d, their cross runs over the same stretch: the second steps off the first.
    const els = [
      box('p', 0, 0),
      box('c', 300, 300),
      box('d', 200, 300),
      pinned('a', 'p', 's', 'c', 'n'),
      { ...pinned('b', 'p', 's', 'd', 'n'), id: 'b' },
    ];
    const out = withFacingBends(els);
    const y = (i: number, to: { x: number; y: number }) =>
      curveAnchorPoints({ x: 50, y: 60 }, to, (out[i] as ArrowElement).curvePoints!)[0]!.y;
    expect(Math.abs(y(3, { x: 350, y: 300 }) - y(4, { x: 250, y: 300 }))).toBeGreaterThanOrEqual(
      16,
    );
  });

  it('loops an arrow between two ends on the same side out past them, never along the edges', () => {
    const els = [box('p', 0, 0), box('c', 300, 40), pinned('a', 'p', 's', 'c', 's')];
    const a = withFacingBends(els)[2] as ArrowElement;
    // p's bottom (50, 60), c's bottom (350, 100): out to 124, below the lower one.
    expect(curveAnchorPoints({ x: 50, y: 60 }, { x: 350, y: 100 }, a.curvePoints!)).toEqual([
      { x: 50, y: 124 },
      { x: 350, y: 124 },
    ]);
    const up = withFacingBends([
      box('p', 0, 0),
      box('c', 300, 40),
      pinned('u', 'p', 'n', 'c', 'n'),
    ])[2] as ArrowElement;
    expect(curveAnchorPoints({ x: 50, y: 0 }, { x: 350, y: 40 }, up.curvePoints!)[0]!.y).toBe(-24);
    const right = withFacingBends([
      box('p', 0, 0),
      box('c', 0, 200),
      pinned('r', 'p', 'e', 'c', 'e'),
    ])[2] as ArrowElement;
    expect(curveAnchorPoints({ x: 100, y: 30 }, { x: 100, y: 230 }, right.curvePoints!)[0]!.x).toBe(
      124,
    );
    const left = withFacingBends([
      box('p', 0, 0),
      box('c', 0, 200),
      pinned('l', 'p', 'w', 'c', 'w'),
    ])[2] as ArrowElement;
    expect(curveAnchorPoints({ x: 0, y: 30 }, { x: 0, y: 230 }, left.curvePoints!)[0]!.x).toBe(-24);
  });

  it('leaves a free end alone', () => {
    const free: ArrowElement = {
      ...pinned('f', 'p', 's', 'c', 'n'),
      to: { kind: 'free', x: 300, y: 300 },
    };
    const els = [box('p', 0, 0), box('c', 300, 200), free];
    expect(withFacingBends(els)[2]).toBe(free);
  });
});
