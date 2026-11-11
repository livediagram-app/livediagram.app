import { describe, expect, it } from 'vitest';
import { arrowBetween, retiredShapeAt, shapeAt, strokeAt } from './__fixtures__/build';
import { buildViewTree, isViewRun, nodesOf, subtreeItems, type ViewItem } from './tree';

const outline = (items: ViewItem[]): string[] =>
  items.map((item) => (isViewRun(item) ? `run×${item.strokes.length}` : item.el.id));

describe('buildViewTree', () => {
  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: nothing nests, so a stored
  // boundary or lane is one element in reading order like any other, and what sat on it is beside it.
  it('lists every element flat in reading order, a stored arrow too, bare strokes folded', () => {
    const tree = buildViewTree([
      shapeAt('signpost', 'far', 900, 0),
      retiredShapeAt('lane', 'lane', 0, 150, 500, 150),
      shapeAt('signpost', 'in-lane', 10, 200),
      retiredShapeAt('boundary', 'frame', 0, 0, 500, 300),
      shapeAt('signpost', 'b', 300, 10),
      shapeAt('signpost', 'a', 10, 10),
      arrowBetween('arr', 'a', 'b'),
      strokeAt('s1', 1000, 500),
      strokeAt('s2', 1100, 500),
    ]);
    expect(outline(tree.roots)).toEqual([
      'frame',
      'lane',
      'a',
      'in-lane',
      'b',
      'far',
      'run×2',
      'arr',
    ]);
    expect(tree.nodes.has('arr')).toBe(true);
    expect(nodesOf(tree.roots).map((n) => n.el.id)).toEqual([
      'frame',
      'lane',
      'a',
      'in-lane',
      'b',
      'far',
      's1',
      's2',
      'arr',
    ]);
  });

  it('has no roots for an empty tab', () => {
    expect(buildViewTree([]).roots).toEqual([]);
  });

  it('keeps the first of two elements sharing an id', () => {
    const tree = buildViewTree([shapeAt('signpost', 'x', 0, 0), shapeAt('signpost', 'x', 50, 50)]);
    expect(tree.roots).toHaveLength(1);
    expect(tree.nodes.get('x')?.index).toBe(0);
  });

  it('starts a view from one element, or from nothing for an id it does not hold', () => {
    const tree = buildViewTree([shapeAt('signpost', 'x', 0, 0)]);
    expect(outline(subtreeItems(tree, 'x'))).toEqual(['x']);
    expect(subtreeItems(tree, 'gone')).toEqual([]);
  });
});
