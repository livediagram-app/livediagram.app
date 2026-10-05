// Ten copies of the checkout tab side by side: 300 elements (docs/specs/024-agents/blueprints/
// document-views.md "Testing"). Each copy's ids are hashed, so refs read like real UUID prefixes.
import type { Element, Endpoint, Tab } from '@livediagram/document';
import { checkoutElements, CHECKOUT_TAB_ID } from './checkout-tab';

export const LARGE_COPIES = 10;
const COPY_OFFSET_X = 1700;

// FNV-1a with a murmur finaliser, as 8 hex characters.
function hash8(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0).toString(16).padStart(8, '0');
}

function copyOf(elements: readonly Element[], copy: number): Element[] {
  const idOf = (id: string) => `${hash8(`${id}/${copy}`)}${id.slice(8)}`;
  const end = (e: Endpoint): Endpoint => {
    if (e.kind === 'pinned') return { ...e, elementId: idOf(e.elementId) };
    if (e.kind === 'on-arrow') return { ...e, arrowId: idOf(e.arrowId) };
    return { ...e, x: e.x + copy * COPY_OFFSET_X };
  };
  return elements.map((el) =>
    el.type === 'arrow'
      ? { ...el, id: idOf(el.id), from: end(el.from), to: end(el.to) }
      : { ...el, id: idOf(el.id), x: el.x + copy * COPY_OFFSET_X },
  );
}

export function largeTab(): Tab {
  const elements = checkoutElements();
  return {
    id: CHECKOUT_TAB_ID,
    name: 'Checkout platform ×10',
    elements: Array.from({ length: LARGE_COPIES }, (_, copy) => copyOf(elements, copy)).flat(),
  };
}
