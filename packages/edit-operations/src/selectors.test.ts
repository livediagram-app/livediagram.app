import { describe, expect, it } from 'vitest';
import type { EditRejection } from '@livediagram/api-schema';
import type { Element, Tab } from '@livediagram/document';
import { reachableFrom } from './graph-walk';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { formatRejections } from './rejections';
import { parseSelector, resolveOne, resolveSelector, resolveSome } from './selectors';
import { createState, putElement, type EditState } from './state';
import type { ApplyOptions } from './types';

const stateOf = (tab: Tab = checkoutFlow(), options: ApplyOptions = {}): EditState =>
  createState(tab, { makeId: fixedIds(), ...options }, () => {});
const ids = (selector: string, state = stateOf()) => {
  const out = resolveSelector(state, selector, 1);
  if ('rejection' in out) throw new Error(formatRejections([out.rejection]).join('\n'));
  return out.els.map((el) => el.id);
};
const refusal = (selector: string, state = stateOf()): EditRejection => {
  const out = resolveSelector(state, selector, 1);
  if (!('rejection' in out))
    throw new Error(`expected a refusal, got ${out.els.map((el) => el.id)}`);
  return out.rejection;
};
const withElements = (...extra: Element[]): Tab => {
  const tab = checkoutFlow();
  return { ...tab, elements: [...tab.elements, ...extra] };
};
const sticky = (id: string, label: string, x = 600, y = 0): Element =>
  ({ id, type: 'sticky', label, x, y, width: 100, height: 100 }) as Element;

describe('selector rows', () => {
  it('a ref, any unique prefix or the id', () => {
    expect(ids('n3')).toEqual(['n3']);
    const tab = withElements(sticky('7f3a2c91-0000-4000-8000-000000000001', 'Idea'));
    expect(ids('7f3a', stateOf(tab))).toEqual(['7f3a2c91-0000-4000-8000-000000000001']);
    expect(ids('7f', stateOf(tab))).toEqual(['7f3a2c91-0000-4000-8000-000000000001']);
  });

  it('a quoted label, ignoring case and outer space; label~ for part of one', () => {
    expect(ids('"login"')).toEqual(['n3']);
    expect(ids('" Charge Card "')).toEqual(['n7']);
    expect(ids('label~card')).toEqual(['n5', 'n7']);
    expect(ids('LABEL~Retry')).toEqual(['t1']);
  });

  it('type: by kind word or element type; shape: by shape', () => {
    expect(ids('type:stadium')).toEqual(['n1', 'n8']);
    expect(ids('type:text')).toEqual(['t1']);
    expect(ids('type:shape shape:diamond')).toEqual(['n6']);
    expect(ids('Type:frame')).toEqual(['f2']);
  });

  it('in: the members of a frame or lane, never arrows', () => {
    expect(ids('in:f2')).toEqual(['n4', 'n5']);
    expect(ids('in:"Payment"')).toEqual(['n4', 'n5']);
  });

  it('in: through nested containers', () => {
    const lane = {
      id: 'l1',
      type: 'shape',
      shape: 'lane',
      x: -100,
      y: 250,
      width: 400,
      height: 300,
    } as Element;
    expect(ids('in:l1', stateOf(withElements(lane)))).toEqual(['f2', 'n4', 'n5', 'n6']);
  });

  it('arrows by their ends', () => {
    expect(ids('from:n6')).toEqual(['a6']);
    expect(ids('to:n6')).toEqual(['a5']);
    expect(ids('n6->n7')).toEqual(['a6']);
    expect(ids('n7->n6')).toEqual([]);
  });

  it('downstream and upstream along arrows, the start left out', () => {
    expect(ids('downstream:n6')).toEqual(['n7', 'n8']);
    expect(ids('upstream:n3')).toEqual(['n1', 'n2']);
    expect(ids('downstream:n4 in:f2')).toEqual(['n5']);
  });

  it("selected: the owner's selection", () => {
    expect(ids('selected', stateOf(checkoutFlow(), { selected: ['n3', 'gone', 'n4'] }))).toEqual([
      'n3',
      'n4',
    ]);
    expect(refusal('selected', stateOf(checkoutFlow(), { selected: [] })).details[0]).toBe(
      'nothing is selected',
    );
    expect(refusal('selected', stateOf(checkoutFlow(), { selected: null })).details[0]).toBe(
      'the selection could not be read',
    );
    expect(refusal('selected', stateOf()).details[0]).toBe('nothing is selected');
  });

  it('every term must match', () => {
    expect(ids('type:square label~c')).toEqual(['n2', 'n5', 'n7']);
    expect(ids('n3 type:diamond')).toEqual([]);
    expect(ids('type:diamond n3')).toEqual([]);
    expect(ids('type:square n3')).toEqual(['n3']);
  });
});

describe('selector refusals', () => {
  it('reads what does not parse as a parse error naming the selector', () => {
    expect(
      ['colour:red', 'type:', 'in:f2,n4', '->n4', 'all', '"open', ''].map(
        (s) => refusal(s).details[0],
      ),
    ).toEqual([
      'selector "colour:red": "colour:" is not a selector key; keys: type shape in from to downstream upstream',
      'selector "type:": type: needs a value',
      'selector "in:f2,n4": one value a term; join terms with spaces',
      'selector "->n4": a->b with an element on each side',
      'selector "all": "all" is a keyword; reach an element named so by its label or a longer prefix',
      'selector ""open": column 1: expected a closing "',
      'selector "": an empty selector',
    ]);
  });

  it('refuses in: on what is not a container, naming the containers', () => {
    expect(refusal('in:n3')).toMatchObject({
      code: 'invalid_value',
      details: ['in:n3: n3 is not a frame or lane', 'containers: f2'],
    });
    const tab = {
      ...checkoutFlow(),
      elements: checkoutFlow().elements.filter((el) => el.id !== 'f2'),
    };
    expect(refusal('in:n3', stateOf(tab)).details).toEqual(['in:n3: n3 is not a frame or lane']);
  });

  it('needs a word inside a term to name one element', () => {
    expect(refusal('in:type:frame').details[0]).toBe(
      '"type:frame" must name one element: a ref or a "label"',
    );
    expect(refusal('from:nope').code).toBe('target_not_found');
    expect(refusal('to:label~c').code).toBe('target_not_found');
    expect(refusal('from:"card"').code).toBe('target_not_found');
    const twins = stateOf(withElements(sticky('s1', 'Twin'), sticky('s2', 'Twin', 800)));
    expect(refusal('downstream:"twin"', twins).code).toBe('target_ambiguous');
    expect(refusal('n3->nope').code).toBe('target_not_found');
    expect(refusal('nope->n3').code).toBe('target_not_found');
  });

  it('refuses an ambiguous prefix with every candidate, marking a stale one', () => {
    const tab = withElements(sticky('0bcd0001-x', 'One'), sticky('0bcd0002-x', 'Two', 800));
    expect(refusal('0b', stateOf(tab)).details).toEqual([
      '"0b" matches 2 elements:',
      '  0bcd0001  sticky "One"',
      '  0bcd0002  sticky "Two"',
    ]);
    expect(refusal('0bcd', stateOf(tab)).details[0]).toBe(
      '"0bcd" matches 2 elements now; one was added since your read?',
    );
  });
});

describe('cardinality', () => {
  const state = () =>
    stateOf(
      withElements(sticky('n9', 'Pay', -300, 400), sticky('pay', 'Pay me', 900), {
        ...checkoutFlow().elements.find((el) => el.id === 'n7')!,
        id: 'n10',
        label: 'Pay',
        x: -10,
        y: 320,
        width: 60,
        height: 40,
      } as Element),
    );

  it('resolves exactly one, naming the matches otherwise: the spec example', () => {
    const many = resolveOne(state(), '"Pay"', 2);
    expect(
      'rejection' in many && formatRejections([{ ...many.rejection, op: 'set "Pay" fill=green' }]),
    ).toEqual([
      'error target_ambiguous · op 2 · set "Pay" fill=green',
      '  "Pay" matches 2 elements:',
      '    n9  sticky "Pay"',
      '    n10  square "Pay" in f2',
      '  hint: use a ref, narrow with type:sticky',
      'nothing was applied',
    ]);
    const none = resolveOne(state(), '"Pai"', 1);
    expect('rejection' in none && none.rejection.details).toEqual([
      '"Pai" matches nothing',
      'nearest:',
      '  n9  sticky "Pay"',
      '  n10  square "Pay" in f2',
      '  n2  square "Cart"',
      '  a6  arrow n6→n7 "yes"',
    ]);
    expect(resolveOne(state(), 'n3', 1)).toMatchObject({ el: { id: 'n3' } });
  });

  it('takes one or more with all, offering all when it is missing', () => {
    const some = resolveSome(state(), '"Pay"', 1, true);
    expect('els' in some && some.els.map((el) => el.id)).toEqual(['n9', 'n10']);
    const without = resolveSome(state(), '"Pay"', 1, false);
    expect('rejection' in without && without.rejection.hint).toBe(
      'use a ref, narrow with type:sticky, or add all',
    );
    const none = resolveSome(state(), 'type:table', 1, true);
    expect('rejection' in none && none.rejection.code).toBe('target_not_found');
    expect(resolveSome(state(), 'type:sticky', 1, true)).toMatchObject({
      els: [{ id: 'n9' }, { id: 'pay' }],
    });
    const error = resolveSome(state(), 'colour:red', 1, true);
    expect('rejection' in error && error.rejection.code).toBe('parse_error');
    expect('rejection' in resolveOne(state(), 'colour:red', 1)).toBe(true);
  });

  it('cuts a long candidate list, counting the rest', () => {
    const many = Array.from({ length: 14 }, (_, i) => sticky(`s${i}`, 'Same', 600 + i * 120));
    const out = resolveOne(stateOf(withElements(...many)), '"Same"', 1);
    expect('rejection' in out && out.rejection.details.slice(-2)).toEqual([
      '  s9  sticky "Same"',
      '  … 4 more',
    ]);
  });
});

describe('the working state', () => {
  it('finds what an earlier operation added, by its new ref', () => {
    const state = stateOf();
    putElement(state, sticky('verify', 'Verify email'), 1);
    expect(ids('verify', state)).toEqual(['verify']);
    expect(ids('"verify email"', state)).toEqual(['verify']);
  });

  it('notes each pre-existing element it resolves as a target, words included', () => {
    const state = stateOf();
    putElement(state, sticky('verify', 'New'), 1);
    ids('n6->n7', state);
    ids('verify', state);
    ids('in:f2', state);
    expect(state.targets).toEqual(['n6', 'n7', 'a6', 'f2', 'n4', 'n5']);
  });
});

describe('parseSelector and reachableFrom', () => {
  it('reads terms', () => {
    expect(
      parseSelector('"Orders service" label~pay type:square in:f2 n3->n4 selected n7'),
    ).toEqual([
      { kind: 'label', text: 'Orders service' },
      { kind: 'label~', text: 'pay' },
      { kind: 'type', value: 'square' },
      { kind: 'in', word: 'f2' },
      { kind: 'arrow', from: 'n3', to: 'n4' },
      { kind: 'selected' },
      { kind: 'ref', text: 'n7' },
    ]);
  });

  it('walks past cycles without returning the start', () => {
    const loop = [
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'x', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'y', anchor: 'w' },
      },
      {
        id: 'b',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'y', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'x', anchor: 'w' },
      },
      {
        id: 'c',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'pinned', elementId: 'x', anchor: 'w' },
      },
    ] as Element[];
    expect([...reachableFrom(loop, 'x', 'downstream')]).toEqual(['y']);
    expect([...reachableFrom(loop, 'x', 'upstream')]).toEqual(['y']);
  });
});
