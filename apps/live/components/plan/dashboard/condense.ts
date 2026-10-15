// A Dashboard on a phone (docs/specs/026-plan/plan-tabs.md "On a phone"): below 640 px of page width every slot takes
// the whole width, stacked in reading order (row by row, left to right), each at a height that suits what it holds
// rather than its row's: a Title as tall as its text, a written card as tall as it needs (never shorter than a small
// card), a figure a short tile, and a board, Sheet, chart or tab tall enough to work in, scrolling inside itself. Only
// the drawing changes: the stored rows, spans and heights stay, and the same dashboard on a wide screen is as it was.
import type { CSSProperties } from 'react';
import type { DashboardContent } from '@livediagram/document';

// Below this page width the dashboard stacks.
export const DASHBOARD_CONDENSE_PX = 640;

export const isCondensed = (width: number | undefined) =>
  width !== undefined && width < DASHBOARD_CONDENSE_PX;

// What a stacked slot is sized as: a Title (its text), a written card (its content, at least CARD_MIN_PX), a figure
// (a short tile), something worked in (most of the screen), or an empty slot (its Add to Slot).
export type PhoneSlotSize = 'title' | 'card' | 'figure' | 'work' | 'empty';

// A small card's least height: a heading and two or three lines (Note, Status, Key Date, a short Checklist or Links).
export const PHONE_CARD_MIN_PX = 168;
// A figure's tile: a metric's number, label and bar.
export const PHONE_FIGURE_PX = 176;
// An empty slot: its badge, title and Add to Slot.
export const PHONE_EMPTY_PX = 176;
// A board, Sheet, chart or shown tab: two thirds of the screen, so a row of cards or cells is workable and the next
// slot still peeks in below; never under 360 px (a short landscape screen).
export const PHONE_WORK_VH = 66;
export const PHONE_WORK_MIN_PX = 360;

// A plan view whose id names a metric tile (plan-views: `metric:<kind>`).
const isMetricView = (view: string | undefined) => !!view?.startsWith('metric:');

export function phoneSlotSize(
  content: DashboardContent | undefined,
  element?: { shape?: string; planView?: { view?: string } } | undefined,
): PhoneSlotSize {
  if (!content) return 'empty';
  switch (content.type) {
    case 'title':
      return 'title';
    case 'note':
    case 'status':
    case 'checklist':
    case 'key-date':
    case 'links':
      return 'card';
    case 'sheet-metric':
    case 'form-metric':
      return 'figure';
    case 'tab':
      return 'work';
    case 'element':
      return element?.shape === 'plan-view' && isMetricView(element.planView?.view)
        ? 'figure'
        : 'work';
  }
}

// The stacked slot's box: one full-width cell whose card fills it (a grid of one track, so a card stretches to the
// least height), at the height its size asks for.
export function phoneSlotStyle(size: PhoneSlotSize): CSSProperties {
  const cell: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' };
  switch (size) {
    case 'title':
      return { ...cell, gridTemplateRows: 'auto' };
    case 'card':
      return { ...cell, gridTemplateRows: '1fr', minHeight: PHONE_CARD_MIN_PX };
    case 'figure':
      return { ...cell, gridTemplateRows: '1fr', height: PHONE_FIGURE_PX };
    case 'empty':
      return { ...cell, gridTemplateRows: '1fr', height: PHONE_EMPTY_PX };
    case 'work':
      return {
        ...cell,
        gridTemplateRows: '1fr',
        height: `${PHONE_WORK_VH}svh`,
        minHeight: PHONE_WORK_MIN_PX,
      };
  }
}
