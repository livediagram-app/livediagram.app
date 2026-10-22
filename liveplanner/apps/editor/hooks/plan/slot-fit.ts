// What fits a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Filling a slot"): content goes only where it looks
// good. Add to Slot offers only what fits, and a dragged or pressed tile lands only in a slot big enough for it.
import {
  DASHBOARD_GAP_PX,
  DASHBOARD_SPANS,
  type DashboardContent,
  type DashboardLayout,
  type DashboardRow,
  type DashboardSlot,
  type Element,
} from '@liveplanner/project';
import type { DashboardItem } from './dashboard-drop';
import { DASHBOARD_CONDENSE_PX } from '@/components/plan/dashboard/condense';

// What each kind of content needs to look good in a slot, in px: a board its header, three columns and two or three
// cards under them (less shows one card and reads as cramped), a sheet its toolbar and eight rows, a chart its axes; a
// metric or a note fits any slot.
export type SlotFitKind = 'board' | 'sheet' | 'chart' | 'metric' | 'note';
const SLOT_FIT: Record<SlotFitKind, { width: number; height: number }> = {
  board: { width: 480, height: 440 },
  sheet: { width: 320, height: 240 },
  chart: { width: 300, height: 220 },
  metric: { width: 0, height: 0 },
  note: { width: 0, height: 0 },
};

export function fitKindOf(item: DashboardItem): SlotFitKind | null {
  switch (item.kind) {
    case 'tab':
      return item.of;
    case 'board':
    case 'sheet':
      return item.kind;
    case 'view':
      return item.view.startsWith('metric:') ? 'metric' : 'chart';
    case 'note':
    case 'card':
      return 'note';
    case 'sheet-metric':
    case 'form-metric':
      return 'metric';
    case 'sheet-chart':
      return 'chart';
    default:
      return null;
  }
}

export type SlotSize = { width: number; height: number };

export function fitsSlot(item: DashboardItem, size: SlotSize | null): boolean {
  const kind = fitKindOf(item);
  if (!kind) return false;
  if (!size) return true;
  const need = SLOT_FIT[kind];
  return size.width >= need.width && size.height >= need.height;
}

// The gap between a row's slots, in px: the dashboard model's (DashboardRowView draws it).
export { DASHBOARD_GAP_PX };

// What a slot's content needs, given the dashboard tab's elements: a Board or Sheet tab as a board or sheet, a plan
// view as a metric or a chart, a board or Sheet element as itself, any other element (a chart from a Sheet) a chart.
export function contentFitKind(
  content: DashboardContent | undefined,
  elements: ReadonlyMap<string, Element>,
): SlotFitKind | null {
  if (!content) return null;
  if (content.type === 'tab') return content.of ?? 'board';
  if (content.type === 'sheet-metric' || content.type === 'form-metric') return 'metric';
  if (content.type !== 'element') return 'note';
  const el = elements.get(content.elementId);
  if (!el || el.type !== 'shape') return null;
  const shape = el;
  if (shape.shape === 'plan-board') return 'board';
  if (shape.shape === 'plan-sheet') return 'sheet';
  if (shape.shape === 'plan-view')
    return shape.planView?.view.startsWith('metric:') ? 'metric' : 'chart';
  return 'chart';
}

export type FitOf = (content: DashboardContent | undefined) => SlotFitKind | null;

// A slot's width in px on a row `rowWidth` wide: its twelfths of the row, less its share of the gaps.
export const spanPx = (span: number, rowWidth: number) =>
  (span * (rowWidth + DASHBOARD_GAP_PX)) / DASHBOARD_SPANS - DASHBOARD_GAP_PX;

const contentKey = (c: DashboardContent) => JSON.stringify(c);

// The contents of `layout` drawn too small to look good, by content (so a slot's content is followed as it moves).
function misfits(layout: DashboardLayout, fitOf: FitOf, rowWidth: number): Set<string> {
  const out = new Set<string>();
  for (const row of layout.rows)
    for (const s of row.slots) {
      const kind = fitOf(s.content);
      if (!kind || !s.content) continue;
      const need = SLOT_FIT[kind];
      // A row that fills the page is as tall as anything needs.
      if (spanPx(s.span, rowWidth) < need.width || (!row.fill && row.height < need.height))
        out.add(contentKey(s.content));
    }
  return out;
}

// Whether the change from `before` to `after` keeps everything looking good (plan-tabs.md "Filling a slot"): nothing
// that fitted its slot before is squeezed below what it needs (a slot added beside it, a slot moved into a short or
// narrow place, a swap). Something already too small (an older layout) does not block other changes. A row narrower
// than the condensed width is not checked: there each slot takes half or all of the line (condense.ts).
export function keepsFit(
  before: DashboardLayout,
  after: DashboardLayout,
  fitOf: FitOf,
  rowWidth: number | null,
): boolean {
  if (after === before || !rowWidth || rowWidth < DASHBOARD_CONDENSE_PX) return true;
  const was = misfits(before, fitOf, rowWidth);
  for (const key of misfits(after, fitOf, rowWidth)) if (!was.has(key)) return false;
  return true;
}

// The least height a row may be dragged to: what its tallest-needing content needs.
export function rowHeightFloor(row: DashboardRow, fitOf: FitOf): number {
  return Math.max(0, ...row.slots.map((s) => SLOT_FIT[fitOf(s.content) ?? 'note'].height));
}

// The least width, in px, the slot may be dragged to.
export const slotWidthFloor = (slot: DashboardSlot, fitOf: FitOf) =>
  SLOT_FIT[fitOf(slot.content) ?? 'note'].width;
