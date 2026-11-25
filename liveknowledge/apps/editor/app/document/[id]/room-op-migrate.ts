// Room ops as they arrive from peers (docs/specs/006-document/stroke-points.md "Migration of
// stored strokes"): a peer whose browser loaded before a deploy still sends elements in a former
// stored shape, so every op that carries elements (a whole tab, an added or updated
// element) runs the stored-element migrations before anything applies it. Pure; the op
// itself back when nothing needed migrating.
import {
  CONTINUOUS_PAGE_WIDTH,
  migrateIncomingElements,
  migrateIncomingTab,
  type Page,
  type Tab,
} from '@liveknowledge/document';
import type { RoomOp } from '@liveknowledge/api-schema';

export function migrateRoomOp(op: RoomOp): RoomOp {
  if (op.kind === 'tab') {
    const tab = migrateIncomingTab(op.tab) as Tab;
    return tab === op.tab ? op : { ...op, tab };
  }
  if (op.kind === 'el' && (op.op.kind === 'add' || op.op.kind === 'update')) {
    // Untrusted: a non-object element is left for applyElementOp's own guards.
    const [element] = migrateIncomingElements([op.op.element]);
    return !element || element === op.op.element ? op : { ...op, op: { ...op.op, element } };
  }
  if (op.kind === 'tab-meta' && Array.isArray(op.patch.pages)) {
    const pages = op.patch.pages.map(atContinuousWidth);
    return pages.every((p, i) => p === op.patch.pages![i])
      ? op
      : { ...op, patch: { ...op.patch, pages } };
  }
  return op;
}

// A peer still on a continuous page's first width (856 px, a browser loaded before Work Tracker 1418) sends its pages
// at that width: read at the continuous width, its height kept, so no editor here holds or saves the first width again
// (docs/specs/030-knowledgebase/blueprints/continuous-page.md "Pages stored at the first width").
function atContinuousWidth(page: Page): Page {
  if (page?.kind !== 'article' || page.size !== 'fit' || typeof page.fit !== 'object' || !page.fit)
    return page;
  if (page.fit.width === CONTINUOUS_PAGE_WIDTH) return page;
  return { ...page, fit: { ...page.fit, width: CONTINUOUS_PAGE_WIDTH } };
}
