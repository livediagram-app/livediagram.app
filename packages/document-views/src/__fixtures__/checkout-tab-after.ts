// The checkout tab after six changes (docs/specs/024-agents/blueprints/document-views.md "Testing"):
// e4a8 renamed, a "Redis cache" cylinder added in c991 with an arrow from 202b, arrow 0cee removed,
// 0c84's thread resolved, cb02 moved by +200,0.
import { createPinnedArrow, createShape, type Element, type Tab } from '@livediagram/document';
import { CHECKOUT_IDS, checkoutTab, pinnedId } from './checkout-tab';

export const CHECKOUT_AFTER_REV = 47;
export const REDIS_ID = pinnedId('7180', 31);

function changed(el: Element): Element[] {
  switch (el.id) {
    case CHECKOUT_IDS.payments:
      return [{ ...el, label: 'Payments' }];
    case CHECKOUT_IDS.order:
      return el.type === 'shape' ? [{ ...el, x: el.x + 200 }] : [el];
    case CHECKOUT_IDS.sticky:
      return el.type === 'sticky' && el.commentThread
        ? [{ ...el, commentThread: { ...el.commentThread, resolved: true } }]
        : [el];
    case pinnedId('0cee', 29):
      return [];
    default:
      return [el];
  }
}

export function checkoutTabAfter(): Tab {
  const before = checkoutTab();
  const redis = {
    ...createShape('cylinder', 720, 470),
    id: REDIS_ID,
    label: 'Redis cache',
    width: 160,
    height: 60,
  };
  const arrow = {
    ...createPinnedArrow(CHECKOUT_IDS.auth, 's', REDIS_ID, 'n'),
    id: pinnedId('5d21', 32),
  };
  return { ...before, elements: [...before.elements.flatMap(changed), redis, arrow] };
}
