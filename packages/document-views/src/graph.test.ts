import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { estimateTokens } from './budget';
import { graphView } from './graph';
import { buildViewModel } from './model';

const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });
const tabOf = (elements: Element[]) => buildViewModel({ id: 'tab-1', name: 'T', elements });

describe('graphView (R17, VW30)', () => {
  it('lists connected nodes, then every arrow, and counts the unconnected', async () => {
    const { text, json } = graphView(checkout());
    await expect(text).toMatchFileSnapshot(golden('checkout.graph.txt'));
    expect(json.nodes).toHaveLength(12);
    expect(json.arrows).toHaveLength(11);
    expect(json.elision?.command).toBe('view --view outline');
  });

  it('fits a budget by whole lines, keeping JSON in step', () => {
    const { text, json } = graphView(checkout(), { budget: 120, door: 'mcp' });
    expect(estimateTokens(text)).toBeLessThanOrEqual(120);
    expect(text.split('\n').at(-1)).toMatch(
      /^… 6 nodes hidden; 11 arrows hidden; 7 unconnected elements hidden: read_document \{"budget":\d+\}$/,
    );
    expect(json.nodes).toHaveLength(6);
    expect(json.arrows).toHaveLength(0);
    const arrowsCut = graphView(checkout(), { budget: 200 }).json;
    expect(arrowsCut.nodes).toHaveLength(12);
    expect(arrowsCut.arrows.length).toBeGreaterThan(0);
    expect(arrowsCut.arrows.length).toBeLessThan(11);
  });

  it('prints unlabelled nodes, no separator without arrows, a lone unconnected element', () => {
    expect(
      graphView(tabOf([shapeAt('square', 'a', 0, 0)]))
        .text.split('\n')
        .slice(1),
    ).toEqual(['… 1 unconnected element hidden: view --view outline']);
    const { text, json } = graphView(
      tabOf([shapeAt('square', 'a', 0, 0), arrowBetween('aa', 'a', 'a')]),
    );
    expect(text.split('\n').slice(1)).toEqual(['square a', '', 'a -> a [aa]']);
    expect(json.elision).toBeNull();
  });
});
