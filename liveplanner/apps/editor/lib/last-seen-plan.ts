// What a plan's last seen copy adds to the shared copy (docs/specs/006-project/offline-mode.md "Warm open of a cloud
// project", blueprints/last-seen-copy.md): the cards the board read, the first tab's sheets and the tabs a Dashboard
// first tab shows, each capped, and which first tabs can paint from what the copy holds. Pure: no React, no storage.
import type { Project } from '@liveplanner/api-schema';
import type { ItemStoreState } from '@liveplanner/items';
import { readDashboard, tabKindOf, type Tab } from '@liveplanner/project';
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

/** The tabs a Dashboard first tab's tiles show, as loaded, and each shown Sheet tab's sheets as last read. */
export type KeptRefs = { tabs: Tab[]; sheets: KeptSheets[] };

/** The copy's item: the plan as loaded, plus what the first tab draws from, each absent until followed and null past
 *  its cap. */
export type PlanCopyItem = Project & {
  cards?: ItemStoreState | null;
  sheets?: KeptSheets | null;
  refs?: KeptRefs | null;
};

/** What a warm paint hands the stores and a Dashboard's tiles: the kept cards (or null), every kept sheets list (the
 *  first tab's and each shown Sheet tab's), and the shown tabs' bodies. */
export type WarmPlan = {
  cards: ItemStoreState | null;
  sheets: readonly KeptSheets[];
  refTabs: readonly Tab[];
};

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

/** The ids of the tabs a Dashboard's tab tiles draw, in slot order, each once; none for any other tab. */
export function dashboardShownTabs(tab: { kind?: string; dashboard?: unknown }): string[] {
  if (tab.kind !== 'dashboard') return [];
  const ids: string[] = [];
  for (const row of readDashboard(tab.dashboard)?.rows ?? [])
    for (const slot of row.slots)
      if (slot.content?.type === 'tab' && !ids.includes(slot.content.tabId))
        ids.push(slot.content.tabId);
  return ids;
}

/** The shown tabs to keep, or null when a Sheet's read was past its cap or their cells together pass the cap. */
export function refsForCopy(
  tabs: readonly Tab[],
  sheets: readonly (KeptSheets | null)[],
): KeptRefs | null {
  let cells = 0;
  for (const kept of sheets) {
    if (!kept) return null;
    for (const sheet of kept.sheets) cells += sheet.cells.length;
  }
  return cells <= PLAN_COPY_MAX_CELLS ? { tabs: [...tabs], sheets: sheets as KeptSheets[] } : null;
}

// Whether a copy's Dashboard first tab can draw every slot: each shown tab kept (a Sheet with its sheets, never a
// Form; one no longer in the tab list paints as deleted), and no slot reading a sheet's figures or a form's.
function dashboardPaints(
  copy: LastSeenCopy<PlanCopyItem, unknown>,
  tab: { kind?: string; dashboard?: unknown },
): boolean {
  const layout = readDashboard(tab.dashboard);
  for (const row of layout?.rows ?? [])
    for (const slot of row.slots)
      if (slot.content?.type === 'sheet-metric' || slot.content?.type === 'form-metric')
        return false;
  const listed = new Set(copy.item.tabs.map((t) => t.id));
  const shown = dashboardShownTabs(tab).filter((id) => listed.has(id));
  if (shown.length === 0) return true;
  const refs = copy.item.refs;
  if (!refs) return false;
  return shown.every((id) => {
    const kept = refs.tabs.find((t) => t.id === id);
    if (!kept) return false;
    const kind = tabKindOf(kept);
    if (kind === 'form') return false;
    return kind !== 'sheet' || refs.sheets.some((s) => s.tabId === id);
  });
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
 *  sheet, with its own sheets kept; a Dashboard with every tab its tiles show kept too; any other tab from its body. */
export function planCopyPaints(copy: LastSeenCopy<PlanCopyItem, unknown>): boolean {
  const first = copy.firstTab;
  if (!first) return false;
  const tab = first.tab as { kind?: string; elements?: readonly TabElement[]; dashboard?: unknown };
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
  return kind !== 'dashboard' || dashboardPaints(copy, tab);
}

/** The warm plan a copy hands the stores at the paint. */
export function warmPlanOf(copy: LastSeenCopy<PlanCopyItem, unknown>): WarmPlan {
  const { cards, sheets, refs } = copy.item;
  return {
    cards: cards ?? null,
    sheets: [...(sheets ? [sheets] : []), ...(refs?.sheets ?? [])],
    refTabs: refs?.tabs ?? [],
  };
}
