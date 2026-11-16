// What a plan's last seen copy adds to the shared copy (docs/specs/006-project/offline-mode.md "Warm open of a cloud
// project", blueprints/last-seen-copy.md): the cards the board read and the first tab's sheets, each capped, and which
// first tabs can paint from what the copy holds. Pure: no React, no storage.
import type { Project } from '@liveplanner/api-schema';
import type { ItemStoreState } from '@liveplanner/items';
import { tabKindOf } from '@liveplanner/project';
import type { SheetJson } from '@liveplanner/sheets';
import type { LastSeenCopy } from '@liveworkspace/workbench/lib/api/last-seen-copies';

/** The most cards a copy keeps. A typical card's JSON is about 670 characters (measured), so 1,000 cards are about
 *  670 KB, under the shared store's 1,000,000-character cap with the plan's meta and first tab. Past it the copy keeps
 *  none, and a Board or Dashboard first tab opens as it always did. Safe range: 200 to 1,400. */
export const PLAN_COPY_MAX_CARDS = 1_000;

/** The most sheet cells a copy keeps, across the first tab's sheets. A cell's JSON is 40 to 60 characters, so 10,000
 *  cells are about 500 KB. Past it the copy keeps none, and a Sheet first tab opens as it always did. Safe range:
 *  1,000 to 15,000. */
export const PLAN_COPY_MAX_CELLS = 10_000;

/** The first tab's sheets as its last read answered them. */
export type KeptSheets = { tabId: string; sheets: SheetJson[] };

/** The copy's item: the plan as loaded, plus what the first tab draws from, each absent until followed and null past
 *  its cap. */
export type PlanCopyItem = Project & {
  cards?: ItemStoreState | null;
  sheets?: KeptSheets | null;
};

/** What a warm paint hands the stores: the kept cards and sheets, or null for each it has none of. */
export type WarmPlan = { cards: ItemStoreState | null; sheets: KeptSheets | null };

/** The cards to keep: the store itself (no copy is made; the JSON is built only when the copy is written), or null
 *  past the cap. */
export function cardsForCopy(store: ItemStoreState): ItemStoreState | null {
  return store.items.length <= PLAN_COPY_MAX_CARDS ? store : null;
}

/** The first tab's sheets to keep, or null when they hold more cells than the cap together. */
export function sheetsForCopy(tabId: string, sheets: readonly SheetJson[]): KeptSheets | null {
  let cells = 0;
  for (const sheet of sheets) cells += sheet.cells.length;
  return cells <= PLAN_COPY_MAX_CELLS ? { tabId, sheets: [...sheets] } : null;
}

// What a tab draws from beyond its body: the plan's cards (a board, a card, a view of the cards), its sheets (a Sheet,
// a chart drawn from a sheet's cells).
type TabElement = {
  planBoard?: unknown;
  planCard?: unknown;
  planView?: unknown;
  planSheet?: unknown;
  chartSource?: unknown;
};

/** Whether a copy's first tab can paint from what the copy holds: a Form never (its link and responses are the
 *  server's); a Board or Dashboard, or any tab drawing the cards, with cards kept; a Sheet, or any tab drawing a
 *  sheet, with its own sheets kept; any other tab from its body. */
export function planCopyPaints(copy: LastSeenCopy<PlanCopyItem, unknown>): boolean {
  const first = copy.firstTab;
  if (!first) return false;
  const tab = first.tab as { kind?: string; elements?: readonly TabElement[] };
  const kind = tabKindOf(tab);
  if (kind === 'form') return false;
  const elements = tab.elements ?? [];
  const drawsCards =
    kind === 'board' ||
    kind === 'dashboard' ||
    elements.some((el) => el.planBoard || el.planCard || el.planView);
  const drawsSheets = kind === 'sheet' || elements.some((el) => el.planSheet || el.chartSource);
  if (drawsCards && !copy.item.cards) return false;
  if (drawsSheets && copy.item.sheets?.tabId !== first.id) return false;
  return true;
}

/** The warm plan a copy hands the stores at the paint. */
export function warmPlanOf(copy: LastSeenCopy<PlanCopyItem, unknown>): WarmPlan {
  return { cards: copy.item.cards ?? null, sheets: copy.item.sheets ?? null };
}
