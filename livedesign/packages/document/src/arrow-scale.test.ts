import { describe, expect, it } from 'vitest';
import { scaleFreeArrow } from './arrow-scale';
import type { ArrowElement } from './index';

const arrow = (over: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 100, y: 100 },
  to: { kind: 'free', x: 300, y: 200 },
  ...over,
});
const box = { x: 100, y: 100, width: 200, height: 100 };

describe('scaleFreeArrow', () => {
  it('scales both ends from the opposite corner', () => {
    const p = scaleFreeArrow(arrow(), box, 'se', { x: 200, y: 100 }, false);
    expect(p.from).toEqual({ kind: 'free', x: 100, y: 100 });
    expect(p.to).toEqual({ kind: 'free', x: 500, y: 300 });
  });

  it('scales one axis from an edge', () => {
    const p = scaleFreeArrow(arrow(), box, 'w', { x: 100, y: 50 }, false);
    // West edge moves right by 100: width 200 -> 100, anchored on the east edge.
    expect(p.from).toEqual({ kind: 'free', x: 200, y: 100 });
    expect(p.to).toEqual({ kind: 'free', x: 300, y: 200 });
  });

  it('scales bends with the arrow', () => {
    const a = arrow({
      arrowStyle: 'curved',
      curveOffset: { dx: 10, dy: -40 },
      curvePoints: [{ dx: -20, dy: 30 }],
      elbowOffset: { dx: 6, dy: 8 },
    });
    const p = scaleFreeArrow(a, box, 'se', { x: 200, y: 0 }, false);
    expect(p.curveOffset).toEqual({ dx: 20, dy: -40 });
    expect(p.curvePoints).toEqual([{ dx: -40, dy: 30 }]);
    expect(p.elbowOffset).toEqual({ dx: 12, dy: 8 });
  });

  it('keeps the proportions when asked, following the larger change', () => {
    const p = scaleFreeArrow(arrow(), box, 'se', { x: 200, y: 0 }, true);
    expect(p.to).toEqual({ kind: 'free', x: 500, y: 300 });
  });

  it('never flips or collapses the arrow', () => {
    const p = scaleFreeArrow(arrow(), box, 'se', { x: -500, y: -500 }, false);
    expect(p.to!.kind === 'free' && p.to!.x).toBeGreaterThan(100);
    expect(p.to!.kind === 'free' && p.to!.y).toBeGreaterThan(100);
  });

  it('leaves an axis with no extent alone', () => {
    const flat = arrow({ to: { kind: 'free', x: 300, y: 100 } });
    const p = scaleFreeArrow(flat, { ...box, height: 0 }, 's', { x: 0, y: 80 }, false);
    expect(p.from).toEqual({ kind: 'free', x: 100, y: 100 });
    expect(p.to).toEqual({ kind: 'free', x: 300, y: 100 });
  });
});
