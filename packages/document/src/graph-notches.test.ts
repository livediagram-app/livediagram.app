import { describe, expect, it } from 'vitest';
import { withoutNotches } from './graph-notches';
import type { ArrowElement, Element } from './index';

const box = (id: string, x: number, y: number, width = 200, height = 60): Element =>
  ({ id, type: 'shape', shape: 'square', x, y, width, height }) as Element;

// An elbow down from a to b, its middle run at the half height, ends where the boxes' anchors put them.
const elbow = (id: string, from: string, to: string, dx: number): Element =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 's' },
    to: { kind: 'pinned', elementId: to, anchor: 'n' },
    arrowStyle: 'angled',
    curvePoints: [
      { dx: -dx / 2, dy: 0 },
      { dx: dx / 2, dy: 0 },
    ],
  }) as Element;

const arrowOf = (els: Element[], id: string) => els.find((e) => e.id === id) as ArrowElement;

describe('withoutNotches', () => {
  it('draws straight an elbow whose ends sit a pixel or two off one line', () => {
    // b's centre is 2 px left of a's, as boxes of different widths centred apart.
    const els = withoutNotches([box('a', 0, 0), box('b', 0, 200, 196), elbow('x', 'a', 'b', -2)]);
    expect(arrowOf(els, 'x').arrowStyle).toBe('straight');
    expect(arrowOf(els, 'x').curvePoints).toBeUndefined();
  });

  it('moves a box no other line meets across by the step, so the line runs true', () => {
    // b is a leaf 2 px left of a: it moves 2 px right, under a, and the straight line is plumb.
    const els = withoutNotches([box('a', 0, 0), box('b', 0, 200, 196), elbow('x', 'a', 'b', -2)]);
    const b = els.find((e) => e.id === 'b') as Element & { x: number; width: number };
    expect(b.x + b.width / 2).toBe(100);
    // Both ends meet other lines: neither moves, and the line keeps its slant.
    const busy = withoutNotches([
      box('a', 0, 0),
      box('b', 0, 200, 196),
      box('c', 400, 0),
      box('d', 400, 200),
      elbow('x', 'a', 'b', -2),
      elbow('y', 'a', 'd', 400),
      elbow('z', 'c', 'b', -400),
    ]);
    expect((busy.find((e) => e.id === 'b') as Element & { x: number }).x).toBe(0);
  });

  it('keeps an elbow whose ends are further apart, a curve, and one joining a bus', () => {
    const far = withoutNotches([box('a', 0, 0), box('b', 40, 200), elbow('x', 'a', 'b', 40)]);
    expect(arrowOf(far, 'x').arrowStyle).toBe('angled');
    const curved = { ...elbow('x', 'a', 'b', -2), arrowStyle: 'curved' } as Element;
    expect(
      arrowOf(withoutNotches([box('a', 0, 0), box('b', 0, 200, 196), curved]), 'x').arrowStyle,
    ).toBe('curved');
    const bus = withoutNotches([
      box('a', 0, 0),
      box('c', 300, 0),
      box('b', 0, 200, 196),
      elbow('x', 'a', 'b', -2),
      elbow('y', 'c', 'b', -300),
    ]);
    expect(arrowOf(bus, 'x').arrowStyle).toBe('angled');
    const straight = withoutNotches([
      box('a', 0, 0),
      box('b', 0, 200),
      { ...elbow('x', 'a', 'b', 0), arrowStyle: 'angled', curvePoints: undefined } as Element,
    ]);
    expect(arrowOf(straight, 'x').arrowStyle).toBe('angled');
  });
});
