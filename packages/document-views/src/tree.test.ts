import { describe, expect, it } from 'vitest';
import { arrowBetween, shapeAt, strokeAt } from './__fixtures__/build';
import { buildViewTree, isViewRun, type ViewItem } from './tree';

const outline = (items: ViewItem[]): unknown[] =>
  items.map((item) =>
    isViewRun(item)
      ? `run×${item.strokes.length}`
      : item.children.length > 0
        ? { [item.el.id]: outline(item.children) }
        : item.el.id,
  );

describe('buildViewTree', () => {
  it('nests by derived containment, reading order per level, arrows left out', () => {
    const frame = shapeAt('frame', 'frame', 0, 0, 500, 300);
    const lane = shapeAt('lane', 'lane', 0, 150, 500, 150);
    const tree = buildViewTree(
      [
        shapeAt('square', 'far', 900, 0),
        lane,
        shapeAt('square', 'in-lane', 10, 200),
        frame,
        shapeAt('square', 'b', 300, 10),
        shapeAt('square', 'a', 10, 10),
        arrowBetween('arr', 'a', 'b'),
        strokeAt('s1', 1000, 500),
        strokeAt('s2', 1100, 500),
      ],
      new Set(['a', 'b']),
    );
    expect(outline(tree.roots)).toEqual([
      { frame: ['a', 'b', { lane: ['in-lane'] }] },
      'far',
      'run×2',
    ]);
    expect(tree.nodes.has('arr')).toBe(false);
    expect(tree.nodes.get('in-lane')?.container).toBe('lane');
  });

  it('has no roots for an empty tab', () => {
    expect(buildViewTree([], new Set()).roots).toEqual([]);
  });

  it('keeps the first of two elements sharing an id', () => {
    const tree = buildViewTree(
      [shapeAt('square', 'x', 0, 0), shapeAt('square', 'x', 50, 50)],
      new Set(),
    );
    expect(tree.roots).toHaveLength(1);
    expect(tree.nodes.get('x')?.index).toBe(0);
  });
});
