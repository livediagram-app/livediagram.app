// A three-tab document (docs/specs/024-agents/blueprints/document-views.md "Testing"): the checkout tab,
// a 42-element lanes tab, and a 24-element retro tab.
import {
  createComment,
  createShape,
  createSticky,
  createText,
  type Element,
  type ShapeKind,
  type Tab,
} from '@livehuddle/document';
import { createPinnedArrow } from './build';
import { checkoutTab, FIXED_EPOCH, pinnedId } from './checkout-tab';

export const CHECKOUT_DOCUMENT = {
  id: '7f3a2c91-0000-4000-8000-000000000000',
  name: 'Checkout platform',
  savedAt: FIXED_EPOCH,
};

// 6 stored lanes (a retired kind, docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3)
// with 3 boxes on each, joined in a ring of 18 arrows.
function sequenceTab(): Tab {
  const elements: Element[] = [];
  for (let lane = 0; lane < 6; lane++) {
    elements.push({
      ...createShape('square', 0, lane * 200),
      shape: 'lane' as ShapeKind,
      id: pinnedId('51a0', lane),
      label: `Lane ${lane + 1}`,
      width: 1200,
      height: 180,
    });
    for (let step = 0; step < 3; step++) {
      elements.push({
        ...createShape('square', 100 + step * 300, lane * 200 + 50),
        id: pinnedId('51b0', lane * 3 + step),
        label: `Step ${lane + 1}.${step + 1}`,
      });
    }
  }
  // A ring: each step points at the next, the last at the first.
  for (let i = 0; i < 18; i++) {
    const arrow = createPinnedArrow(pinnedId('51b0', i), 'e', pinnedId('51b0', (i + 1) % 18), 'w');
    elements.push({ ...arrow, id: pinnedId('51c0', i) });
  }
  return { id: pinnedId('51c9', 100), name: 'Payment sequence', elements };
}

function retroTab(): Tab {
  const thread = (n: number) => ({
    comments: [
      {
        ...createComment(`Thought ${n}`, { name: 'Sam', color: '#000' }),
        id: pinnedId('c0c1', n),
        createdAt: FIXED_EPOCH,
      },
    ],
    resolved: false,
  });
  const stickies: Element[] = Array.from({ length: 22 }, (_, i) => ({
    ...createSticky((i % 6) * 220, Math.floor(i / 6) * 220),
    id: pinnedId('9e10', i),
    label: `Event ${i + 1}`,
    ...(i < 3 ? { commentThread: thread(i) } : {}),
  }));
  return {
    id: pinnedId('9e02', 101),
    name: 'Incident retro',
    elements: [
      { ...createText(0, -100), id: pinnedId('9e20', 0), label: 'Timeline' },
      { ...createText(600, -100), id: pinnedId('9e20', 1), label: 'Hotspots' },
      ...stickies,
    ],
  };
}

export function checkoutDocumentTabs(): Tab[] {
  return [checkoutTab(), sequenceTab(), retroTab()];
}
