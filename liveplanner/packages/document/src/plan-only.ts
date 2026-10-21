// Boards and Sheets only in Plan (docs/specs/026-plan/plan-tabs.md "Only in Plan"): a Plan board or a Sheet element is
// placed only on a tab in Plan. A tab keeps its mode once it has content, and a board's cards and a Sheet's cells take
// input only in Plan, so one anywhere else could never be worked. The editor's paste and the changeset engine both read
// these; pure.
import { isSheetAnchoredChart } from './chart-source';
import { opensInOf } from './editor-mode';
import type { Element } from './index';

type ModeTab = Parameters<typeof opensInOf>[0];

const isShape = (el: Element, shape: string) => el.type === 'shape' && el.shape === shape;

// A Plan board or a Sheet: the elements that go only on a tab in Plan.
export function isPlanOnlyElement(el: Element): boolean {
  return isShape(el, 'plan-board') || isShape(el, 'plan-sheet');
}

// The tab may take a new board or Sheet: it is in Plan (a Board, Sheet or Dashboard tab, or a general tab in Plan).
export function tabTakesPlanOnly(tab: ModeTab): boolean {
  return opensInOf(tab) === 'plan';
}

// The boards and Sheets `next` holds that `before` did not, when `next` is not in Plan: what a write must refuse.
// Those the tab already held are left alone.
export function planOnlyAddedOutsidePlan(
  before: readonly Element[],
  next: ModeTab & { elements: readonly Element[] },
): string[] {
  if (tabTakesPlanOnly(next)) return [];
  const had = new Set(before.map((el) => el.id));
  return next.elements.filter((el) => isPlanOnlyElement(el) && !had.has(el.id)).map((el) => el.id);
}

// `elements` without their boards, their Sheets and the charts those Sheets draw (a paste onto a tab not in Plan), and
// how many boards and Sheets went.
export function withoutPlanOnly(elements: readonly Element[]): {
  kept: Element[];
  boards: number;
  sheets: number;
} {
  const sheetIds = new Set<string>();
  for (const el of elements)
    if (el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet)
      sheetIds.add(el.planSheet.sheetId);
  let boards = 0;
  let sheets = 0;
  const kept = elements.filter((el) => {
    if (isShape(el, 'plan-board')) {
      boards += 1;
      return false;
    }
    if (isShape(el, 'plan-sheet')) {
      sheets += 1;
      return false;
    }
    return !(
      isSheetAnchoredChart(el) &&
      el.type === 'shape' &&
      !!el.chartSource &&
      sheetIds.has(el.chartSource.sheetId)
    );
  });
  return { kept, boards, sheets };
}
