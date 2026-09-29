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
});
