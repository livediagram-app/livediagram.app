// Where Share and the account button are drawn (docs/specs/030-knowledgebase/page-surface.md "The footer"): the
// right end of the top row. Each of the three views draws that row itself (the page's formatting row, Ask's and AI
// Knowledge's header), and the editor draws the two buttons once, into whichever row is on top. A row offers its
// slot with a rank; the highest rank on offer holds the buttons.
import { useSyncExternalStore } from 'react';

/** The row's height on a desktop, px (`--knowledge-top-row`, app/globals.css; a phone's is 56). */
export const TOP_ROW_HEIGHT_PX = 48;

/** The page's row, and a view drawn over the page (Ask, AI Knowledge), which outranks it. */
export type TopRowRank = 'page' | 'view';

const slots = new Map<TopRowRank, HTMLElement>();
const listeners = new Set<() => void>();

/** Offer (or, with null, take back) a row's slot. */
export function setTopRowSlot(rank: TopRowRank, el: HTMLElement | null): void {
  if ((slots.get(rank) ?? null) === el) return;
  if (el) slots.set(rank, el);
  else slots.delete(rank);
  listeners.forEach((listener) => listener());
}

/** The slot the buttons belong in now, or null while no row shows. */
export const topRowSlot = (): HTMLElement | null => slots.get('view') ?? slots.get('page') ?? null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTopRowSlot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, topRowSlot, () => null);
}
