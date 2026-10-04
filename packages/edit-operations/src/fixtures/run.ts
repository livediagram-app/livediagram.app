// Runs line-form operations on the checkout flow (or a given tab) with deterministic ids, and reads
// what came out; shared by the operation suites. A line that does not parse answers its errors.

import type { Element, Tab } from '@livediagram/document';
import { applyEditOperations } from '../apply';
import { parseEditOperations } from '../parse';
import type { ApplyOptions, ApplyOutcome } from '../types';
import { checkoutFlow, fixedIds } from './checkout-flow';

export function run(
  text: string,
  tab: Tab = checkoutFlow(),
  options: ApplyOptions = {},
): ApplyOutcome {
  const parsed = parseEditOperations(text);
  return 'errors' in parsed
    ? parsed
    : applyEditOperations(tab, parsed.operations, { makeId: fixedIds(), ...options });
}

// The checkout flow with its elements changed.
export function flowWith(change: (el: Element) => Element): Tab {
  const tab = checkoutFlow();
  return { ...tab, elements: tab.elements.map(change) };
}

export const lockedFlow = (...ids: string[]) =>
  flowWith((el) => (ids.includes(el.id) ? { ...el, locked: true } : el));

export const elementOf = (tab: Tab, id: string): Element | undefined =>
  tab.elements.find((e) => e.id === id);

// A box's x, y, width and height (NaN for what has none).
export function boxIn(tab: Tab, id: string): [number, number, number, number] {
  const el: object = Object(elementOf(tab, id));
  const read = (key: string) => Number(Reflect.get(el, key));
  return [read('x'), read('y'), read('width'), read('height')];
}
