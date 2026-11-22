import { describe, expect, it } from 'vitest';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { partitionVisible } from './visibility';

describe('partitionVisible (E7)', () => {
  const a = shapeAt('square', 'a', 0, 0);
  const b = { ...shapeAt('square', 'b', 200, 0), layerId: 'secret' };
  const ab = arrowBetween('ab', 'a', 'b');
  const aa = arrowBetween('aa', 'a', 'a');
  const onHidden = { ...shapeAt('square', 'c', 400, 0), layerId: 'secret' };

  it('prints everything when no layer is hidden', () => {
    const tab = { elements: [a, b, ab], layers: [{ id: 'secret', name: 'Secret' }] };
    expect(partitionVisible(tab)).toEqual({ printed: [a, b, ab], hidden: [] });
  });

  it('hides a hidden layer and the arrows pinned to it, keeping array order', () => {
    const tab = {
      elements: [a, b, ab, aa, onHidden],
      layers: [
        { id: 'default', name: 'Default' },
        { id: 'secret', name: 'Secret', visible: false },
      ],
    };
    expect(partitionVisible(tab)).toEqual({ printed: [a, aa], hidden: [b, ab, onHidden] });
  });

  it('hides an arrow riding on a hidden arrow, however long the chain', () => {
    const ridesOn = (id: string, on: string) => ({
      ...arrowBetween(id, 'a', 'a'),
      to: { kind: 'on-arrow' as const, arrowId: on, t: 0.5 },
    });
    const first = ridesOn('r1', 'ab');
    const second = ridesOn('r2', 'r1');
    const tab = {
      elements: [second, a, b, ab, first],
      layers: [
        { id: 'default', name: 'Default' },
        { id: 'secret', name: 'Secret', visible: false },
      ],
    };
    expect(partitionVisible(tab)).toEqual({ printed: [a], hidden: [second, b, ab, first] });
  });

  it('hides an arrow once when it hangs on hidden elements more than once', () => {
    const loop = arrowBetween('bb', 'b', 'b');
    const alsoHidden = { ...arrowBetween('cb', 'c', 'b'), layerId: 'secret' };
    const tab = {
      elements: [a, b, onHidden, loop, alsoHidden],
      layers: [
        { id: 'default', name: 'Default' },
        { id: 'secret', name: 'Secret', visible: false },
      ],
    };
    expect(partitionVisible(tab)).toEqual({
      printed: [a],
      hidden: [b, onHidden, loop, alsoHidden],
    });
  });

  it('keeps an arrow whose only pinned end is visible', () => {
    const free = { ...arrowBetween('free', 'a', 'b'), to: { kind: 'free' as const, x: 0, y: 0 } };
    const tab = {
      elements: [a, b, free],
      layers: [
        { id: 'default', name: 'Default' },
        { id: 'secret', name: 'Secret', visible: false },
      ],
    };
    expect(partitionVisible(tab).printed).toEqual([a, free]);
  });
});
