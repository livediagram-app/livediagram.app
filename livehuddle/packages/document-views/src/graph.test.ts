import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { graphView } from './graph';
import { buildViewModel } from './model';

const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });
const tabOf = (elements: Element[]) => buildViewModel({ id: 'tab-1', name: 'T', elements });

// A stored arrow is a retired element that joins nothing (docs/specs/002-project-scope/not-in-livehuddle.md "The
// element engine", part 4): the graph lists no node and no arrow, and points to the outline for every element.
describe('graphView (R17, VW30)', () => {
  it('lists no node and no arrow, and counts every element unconnected', async () => {
    const { text, json } = graphView(checkout());
    await expect(text).toMatchFileSnapshot(golden('checkout.graph.txt'));
    expect(json.nodes).toEqual([]);
    expect(json.arrows).toEqual([]);
    expect(json.elision?.command).toBe('view --view outline');
  });

  it('names a lone element in the singular, a stored arrow among them, and an empty tab with nothing', () => {
    expect(
      graphView(tabOf([shapeAt('square', 'a', 0, 0)]))
        .text.split('\n')
        .slice(1),
    ).toEqual(['… 1 unconnected element hidden: view --view outline']);
    const { text } = graphView(tabOf([shapeAt('square', 'a', 0, 0), arrowBetween('aa', 'a', 'a')]));
    expect(text.split('\n').slice(1)).toEqual([
      '… 2 unconnected elements hidden: view --view outline',
    ]);
    const empty = graphView(tabOf([]));
    expect(empty.text.split('\n')).toHaveLength(1);
    expect(empty.json.elision).toBeNull();
  });
});
