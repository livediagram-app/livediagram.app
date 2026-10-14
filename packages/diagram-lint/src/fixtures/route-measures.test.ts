import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { arrow, box, frame, tabOf } from './build';
import { routeMeasures } from './route-measures';

describe('routeMeasures', () => {
  it('counts a route that turns back on itself, and one that notches', () => {
    const back = arrow('back', 'a', 'b', ['e', 'w'], {
      arrowStyle: 'angled',
      curvePoints: [
        { dx: 200, dy: 0 },
        { dx: -100, dy: 0 },
      ],
    } as Partial<Element>);
    expect(routeMeasures(tabOf(box('a', 0, 0), box('b', 300, 0), back)).kinks).toBe(1);
    const notch = arrow('notch', 'a', 'b', ['e', 'w'], {
      arrowStyle: 'angled',
      curvePoints: [
        { dx: 0, dy: -3 },
        { dx: 0, dy: 3 },
      ],
    } as Partial<Element>);
    const low = box('b', 300, 6);
    expect(routeMeasures(tabOf(box('a', 0, 0), low, notch)).kinks).toBe(1);
  });

  it('counts a route that starts inside a frame heading, and reads an empty tab', () => {
    const tab = tabOf(
      { ...frame('f', 0, 0, 600, 400), label: 'Core services' } as Element,
      box('a', 20, 4, { width: 40, height: 20 }),
      box('b', 300, 200),
      arrow('x', 'a', 'b'),
    );
    expect(routeMeasures(tab).strikes).toBe(1);
    expect(routeMeasures(tabOf()).extent).toBe('none');
  });
});
