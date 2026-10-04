// The engine's invariants (docs/specs/024-agents/blueprints/edit-operations.md "Behaviour and state",
// I1 to I7), held by one changeset per operation of the vocabulary on the checkout flow.

import { describe, expect, it } from 'vitest';
import {
  applyElementOps,
  deriveContainers,
  isContainer,
  type Element,
  type Tab,
} from '@livediagram/document';
import { checkoutFlow } from './fixtures/checkout-flow';
import { applied } from './fixtures/outcomes';
import { flowWith, run } from './fixtures/run';
import { EDIT_OPERATION_NAMES } from './vocabulary';

const SAMPLES: Readonly<Record<(typeof EDIT_OPERATION_NAMES)[number], string>> = {
  add: 'add sticky label="Fraud check" right-of:n5',
  set: 'set n3 label="Sign in" fill=green',
  rm: 'rm n7',
  move: 'move f2 by=300,0',
  connect: 'connect n2 -> n8 label=skip',
  rewire: 'rewire a6 to=n8',
  insert: 'insert square id=verify label="Verify email" between n3 n4',
  wrap: 'wrap n7 n8 in frame label=Payment',
  unwrap: 'unwrap f2',
  order: 'order f2 front',
  layout: 'layout n5 n6 n7 n8 direction=right',
  test: 'test n3 label=Login',
};

const samples = Object.entries(SAMPLES);
const frozen = (tab: Tab): Tab => JSON.parse(JSON.stringify(tab));

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

  it.each(samples)('%s: lanes first, and every container behind its members (I6)', (_, text) => {
    const lane: Element = {
      id: 'lane',
      type: 'shape',
      shape: 'lane',
      x: -400,
      y: -100,
      width: 2000,
      height: 1200,
    };
    const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, lane] };
    const { tab: next } = applied(run(text, tab));
    const order = next.elements.map((el) => el.id);
    const firstOther = next.elements.findIndex(
      (el) => !(el.type === 'shape' && el.shape === 'lane'),
    );
    expect(
      next.elements.slice(firstOther).some((el) => el.type === 'shape' && el.shape === 'lane'),
    ).toBe(false);
    const byId = new Map(next.elements.map((el) => [el.id, el]));
    for (const [id, holder] of deriveContainers(next.elements)) {
      if (holder && isContainer(byId.get(holder)!))
        expect(order.indexOf(holder)).toBeLessThan(order.indexOf(id));
    }
  });

  it.each(samples)('%s: no locked element changes (I7)', (_, text) => {
    for (const id of checkoutFlow().elements.map((el) => el.id)) {
      const tab = flowWith((el) => (el.id === id ? { ...el, locked: true } : el));
      const outcome = run(text, tab);
      if ('errors' in outcome) {
        expect(outcome.errors[0]!.code).toBe('element_locked');
        continue;
      }
      const lockedBefore = tab.elements.find((el) => el.id === id);
      expect(outcome.tab.elements.find((el) => el.id === id)).toEqual(lockedBefore);
    }
  });
});
