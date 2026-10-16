// What a Dashboard slot is filled with when it is made new (docs/specs/026-plan/plan-tabs.md "Filling a slot"): a plan
// view an element of the dashboard itself, drawn in the slot; a new board or Sheet a tab of its own, made as Start
// Planning makes a Board or Sheet tab, which the slot then shows. Pure, so the hook (usePlanTabActions) only commits.
import { createShape, type Element, type Tab } from '@livediagram/document';
import { isPlanViewId, planViewSize } from '@livediagram/items';
import { isSheetTemplateId } from '@livediagram/sheets';
import { planBoardPlacement } from '@/lib/plan-board-placement';
import { newTabSeed } from '@/lib/new-tab-seed';
import { placeNewSheet, placedSheetTitle, sheetTitleForTab } from '@/lib/sheet-seeds';
import type { DashboardItem } from './dashboard-drop';

// Every board of `elements` drawing its cards Detailed (no card size kept): a Board tab's board fills the screen.
export function detailedBoards(elements: Element[]): Element[] {
  return elements.map((el) => {
    if (el.type !== 'shape' || el.shape !== 'plan-board' || !el.planBoard?.cardSize) return el;
    const { cardSize: _drop, ...setup } = el.planBoard;
    return { ...el, planBoard: setup };
  });
}

// A plan view for a slot: placed out of sight under the page (the slot draws it at its own size).
export function dashboardViewElement(view: string): Element {
  return {
    ...createShape('plan-view', 0, 0),
    ...(isPlanViewId(view) ? { planView: { view } } : {}),
    ...planViewSize(view),
  };
}

// A plan view's element, or a new board or Sheet: a board of its preset, named after it; a Sheet of its start, named
// as Start Planning names it ("Sheet", or its template's name).
export function dashboardElement(
  item: Extract<DashboardItem, { kind: 'view' | 'board' | 'sheet' }>,
): Element {
  if (item.kind === 'view') return dashboardViewElement(item.view);
  if (item.kind === 'board') {
    const placed = planBoardPlacement(item.preset, '');
    return { ...createShape('plan-board', 0, 0), ...placed };
  }
  return {
    ...createShape('plan-sheet', 0, 0),
    // Made for a slot it goes straight to work, never through Setup Sheet (plan-tabs.md "Slot content"): an empty
    // sheet a blank grid, a template already set up from it; only a Card Table still asks which cards.
    planSheet: placeNewSheet({
      title: sheetTitleForTab('', item.start),
      ...(item.start === 'cards'
        ? { start: 'cards' as const }
        : isSheetTemplateId(item.start)
          ? { setUp: item.start }
          : { blank: true as const }),
    }),
  };
}

// The name a new Board or Sheet tab takes from what fills it: the board's title, or the title its Sheet is placed with.
function nameOf(el: Element): string {
  if (el.type === 'shape' && el.shape === 'plan-board')
    return el.planBoard?.title.trim() || 'Board';
  if (el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet)
    return placedSheetTitle(el.planSheet.sheetId)?.trim() || 'Sheet';
  return 'Board';
}

// A new board or Sheet picked for a slot: a Board or Sheet tab of its own, opening in Plan, named after what fills
// it, its board drawing its cards Detailed. Made once, outside any update (its ids are new each call).
export function newSlotTab(item: Extract<DashboardItem, { kind: 'board' | 'sheet' }>): Tab {
  const el = dashboardElement(item);
  return {
    id: crypto.randomUUID(),
    name: nameOf(el),
    elements: detailedBoards([el]),
    defaultTextSize: 'sm',
    kind: item.kind,
    opensIn: 'plan',
  };
}

// `made` looking like the dashboard's tab it was made from (newTabSeed: theme, background, font, text size).
export function withLookOf(made: Tab, dashboard: Tab): Tab {
  return { ...made, ...newTabSeed(dashboard), id: made.id, name: made.name };
}
