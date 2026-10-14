import { describe, expect, it } from 'vitest';
import { curveAnchorPoints } from './arrow-path';
import { orthogonalBends, withOrthogonalBends } from './arrow-orthogonal';
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

  it('turns an angled arrow with lined-up ends straight', () => {
    const els = [box('p', 0, 0), box('c', 0, 200), angled('p', 'c')];
    const out = withOrthogonalBends(els, 'TB');
    expect(out[2]).toMatchObject({ arrowStyle: 'straight' });
    expect((out[2] as ArrowElement).curvePoints).toBeUndefined();
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
