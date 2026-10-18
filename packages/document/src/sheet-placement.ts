// Sheets only in Plan (docs/specs/029-sheets/sheet.md "Only in Plan"): a Sheet element is placed only on a tab in Plan.
// A tab keeps its mode once it has content, and a Sheet is edited only in Plan, so one anywhere else could never be
// edited. The editor's paste and the changeset engine both read these; pure.
import { isSheetAnchoredChart } from './chart-source';
import { opensInOf } from './editor-mode';
import type { Element } from './index';

type ModeTab = Parameters<typeof opensInOf>[0];

export function isSheetElement(el: Element): boolean {
  return el.type === 'shape' && el.shape === 'plan-sheet';
}

// The tab may take a new Sheet: it is in Plan (a Sheet tab, a Dashboard, or a general tab in Plan).
export function tabTakesSheets(tab: ModeTab): boolean {
  return opensInOf(tab) === 'plan';
}

// The Sheet elements `next` holds that `before` did not, when `next` is not in Plan: what a write must refuse. Sheets
// the tab already held are left alone.
export function sheetsAddedOutsidePlan(
  before: readonly Element[],
  next: ModeTab & { elements: readonly Element[] },
): string[] {
  if (tabTakesSheets(next)) return [];
  const had = new Set(before.map((el) => el.id));
  return next.elements.filter((el) => isSheetElement(el) && !had.has(el.id)).map((el) => el.id);
}

// `elements` without their Sheets and the charts those Sheets draw (a paste onto a tab not in Plan), and how many
// Sheets went.
export function withoutSheets(elements: readonly Element[]): {
  kept: Element[];
  sheets: number;
} {
  const sheetIds = new Set<string>();
  for (const el of elements)
    if (el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet)
      sheetIds.add(el.planSheet.sheetId);
  let sheets = 0;
  const kept = elements.filter((el) => {
    if (isSheetElement(el)) {
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
  return { kept, sheets };
}
