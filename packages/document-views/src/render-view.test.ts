import { describe, expect, it } from 'vitest';
import { TAB_VIEW_NAMES, type TabViewName } from '@livediagram/api-schema';
import type { Element, Tab } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { renderView, type ViewRequest } from './render-view';

const REQUESTS: Record<TabViewName, ViewRequest> = {
  outline: { view: 'outline' },
  graph: { view: 'graph' },
  layout: { view: 'layout' },
  comments: { view: 'comments' },
  show: { view: 'show', ref: '146b' },
  find: { view: 'find', q: 'pay' },
};
// Every element's ref in the checkout tab: the first four characters of its pinned id.
const ELEMENT_REFS = new Set(checkoutTab().elements.map((el) => el.id.slice(0, 4)));
const render = (request: ViewRequest, tab: Tab = checkoutTab()) =>
  renderView(request, tab, { rev: CHECKOUT_REV });

describe('renderView', () => {
  it('opens every view with the header and its revision (R18, I5)', () => {
    for (const view of TAB_VIEW_NAMES) {
      const result = render(REQUESTS[view]);
      if (!result.ok) throw new Error(view);
      expect(result.text.split('\n')[0]).toMatch(
        /^tab 0b34 "Checkout platform" · 30 elements.* · rev 41$/,
      );
      expect(result.view).toBe(view);
      expect(result.elements).toBe(30);
    }
  });

  it('gives text and JSON that agree on refs and counts (R19)', () => {
    for (const view of TAB_VIEW_NAMES) {
      const result = render(REQUESTS[view]);
      if (!result.ok) throw new Error(view);
      const json = JSON.stringify(result.json);
      expect(json).toContain('"ref":"0b34"');
      expect(json).toContain('"elements":30');
      const textRefs = new Set(result.text.match(/\b[0-9a-f]{4}\b/g));
      const jsonRefs = new Set(json.match(/"[0-9a-f]{4}"/g)?.map((r) => r.slice(1, -1)));
      // find's text carries each match's whole outline line; its JSON lists the matches.
      const [from, to] = view === 'find' ? [jsonRefs, textRefs] : [textRefs, jsonRefs];
      for (const ref of from) if (ELEMENT_REFS.has(ref)) expect(to).toContain(ref);
    }
  });

  it('gives the same bytes every time, reading no clock (R22, I1)', () => {
    for (const view of TAB_VIEW_NAMES) {
      expect(render(REQUESTS[view])).toEqual(render(REQUESTS[view]));
    }
  });

  it('passes options through', () => {
    const coarse = render({ view: 'layout', coarse: true, only: 'c991' });
    expect(coarse.ok && coarse.text.split('\n')[1]).toBe('c991: 202b 146b / 6406 e4a8 / 12de 0556');
    const styled = render({ view: 'outline', style: true, budget: 100000, door: 'mcp' });
    expect(styled.ok && styled.text).toContain('line=angled');
    const all = render({ view: 'comments', all: true });
    expect(all.ok && all.text).toContain('· resolved ·');
  });
});

describe('renderView refusals (R4, R5, E17, E18)', () => {
  const hidden = { ...shapeAt('square', 'abcd1', 0, 0), layerId: 'off' };
  const tab: Tab = {
    id: 'tab-1',
    name: 'T',
    elements: [
      shapeAt('square', 'abcd0', 0, 0, 100, 50, { label: 'Zero' }),
      hidden,
      arrowBetween('arr', 'abcd0', 'abcd0'),
    ] as Element[],
    layers: [
      { id: 'default', name: 'Default' },
      { id: 'off', name: 'Off', visible: false },
    ],
  };

  it('refuses an ambiguous prefix with every candidate, marking a printed-length one stale', () => {
    expect(render({ view: 'show', ref: 'abc' }, tab)).toEqual({
      ok: false,
      refusal: {
        error: 'target_ambiguous',
        message: '"abc" matches 2 elements now',
        input: 'abc',
        candidates: [
          { ref: 'abcd0', kind: 'square', label: 'Zero' },
          { ref: 'abcd1', kind: 'square', label: null },
        ],
        stale: false,
      },
    });
    const stale = render({ view: 'outline', only: 'abcd' }, tab);
    expect(!stale.ok && stale.refusal).toMatchObject({
      stale: true,
      message: '"abcd" matches 2 elements now; one was added since your read?',
    });
  });

  it('refuses a ref that names nothing, offering the nearest', () => {
    const result = render({ view: 'show', ref: 'abce' }, tab);
    expect(!result.ok && result.refusal).toMatchObject({
      error: 'target_not_found',
      message: 'no element "abce"; deleted since your read? tab diff shows what changed',
      candidates: [{ ref: 'abcd0' }, { ref: 'abcd1' }, { ref: 'arr' }],
    });
    expect(render({ view: 'show' }, tab)).toMatchObject({
      ok: false,
      refusal: { error: 'target_not_found' },
    });
  });

  it('refuses an element on a hidden layer (I7)', () => {
    expect(render({ view: 'show', ref: 'abcd1' }, tab)).toMatchObject({
      ok: false,
      refusal: { error: 'target_not_found', message: '"abcd1" is on a hidden layer' },
    });
  });

  it('shows an arrow but refuses one as a subtree (VW41), and refuses find without q', () => {
    expect(render({ view: 'show', ref: 'arr' }, tab).ok).toBe(true);
    expect(render({ view: 'outline', only: 'arr' }, tab)).toEqual({
      ok: false,
      refusal: { error: 'invalid_value', message: 'only takes an element, not an arrow' },
    });
    expect(render({ view: 'find', q: '' }, tab)).toMatchObject({
      ok: false,
      refusal: { error: 'invalid_value' },
    });
  });
});
