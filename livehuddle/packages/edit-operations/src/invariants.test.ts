// The engine's invariants (docs/specs/024-agents/blueprints/edit-operations.md "Behaviour and state",
// I1 to I7), held by one changeset per operation of the vocabulary on the checkout flow.

import { describe, expect, it } from 'vitest';
import { applyElementOps, type Element, type Tab } from '@livehuddle/document';
import { checkoutFlow } from './fixtures/checkout-flow';
import { applied } from './fixtures/outcomes';
import { run } from './fixtures/run';
import { EDIT_OPERATION_NAMES } from './vocabulary';

const SAMPLES: Readonly<Record<(typeof EDIT_OPERATION_NAMES)[number], string>> = {
  add: 'add sticky label="Fraud check" right-of:n5',
  set: 'set n3 label="Sign in" fill=green',
  rm: 'rm n7',
  move: 'move f2 by=300,0',
  order: 'order f2 front',
  layout: 'layout n5 n6 n7 n8',
  test: 'test n3 label=Login',
};

const samples = Object.entries(SAMPLES);
const frozen = (tab: Tab) => JSON.parse(JSON.stringify(tab)) as Tab;

describe('invariants', () => {
  it('has a sample for every operation', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...EDIT_OPERATION_NAMES].sort());
  });

  it.each(samples)(
    '%s: a rejected changeset carries no tab and the input is untouched (I1)',
    (_, text) => {
      const tab = checkoutFlow();
      const outcome = run(`${text}\ntest n1 label=Nope`, tab);
      expect(outcome).not.toHaveProperty('tab');
      expect(tab).toEqual(frozen(checkoutFlow()));
    },
  );

  it.each(samples)(
    '%s: the input tab is never mutated, and what stayed is the same object (I1, I2)',
    (_, text) => {
      const tab = checkoutFlow();
      const { tab: next } = applied(run(text, tab));
      expect(tab).toEqual(frozen(checkoutFlow()));
      const before = new Map(tab.elements.map((el) => [el.id, el]));
      for (const el of next.elements) {
        const was = before.get(el.id);
        if (was && JSON.stringify(was) === JSON.stringify(el)) expect(el).toBe(was);
      }
    },
  );

  it.each(samples)('%s: element ops and their inverse round trip (I4)', (_, text) => {
    const tab = checkoutFlow();
    const { tab: next, elementOps, inverse } = applied(run(text, tab));
    expect(applyElementOps(tab.elements, elementOps)).toEqual(next.elements);
    expect(applyElementOps(next.elements, inverse)).toEqual(tab.elements);
  });

  it.each(samples)('%s: the same input gives the same outcome (I5)', (_, text) => {
    expect(run(text)).toEqual(run(text));
  });

  // I6 (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3): a stored lane is a retired
  // element that holds nothing, so no operation reorders, settles or rewrites it.
  it.each(samples)(
    '%s: a stored lane is kept as stored, never sent to the back (I6)',
    (_, text) => {
      const lane = {
        id: 'lane',
        type: 'shape',
        shape: 'lane',
        x: -400,
        y: -100,
        width: 2000,
        height: 1200,
        headerSize: 96,
      } as unknown as Element;
      const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, lane] };
      const { tab: next } = applied(run(text, tab));
      expect(next.elements.find((el) => el.id === 'lane')).toBe(lane);
      // Never moved behind the rest: what came before it still does.
      const order = next.elements.map((el) => el.id);
      expect(order.indexOf('lane')).toBeGreaterThan(order.indexOf('n1'));
    },
  );
});
