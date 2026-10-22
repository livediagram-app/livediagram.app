'use client';

// Which sheets hold a card table (docs/specs/029-sheets/sheet.md "Card tables"), for the main bundle: the sheet store
// lives in the lazily loaded sheet chunk, which marks each sheet it draws here (useSheetModel). Read by Plan mode's
// bottom-right strip (docs/specs/026-plan/items.md "The Plan strip"), which shows only while the tab has something that
// shows cards. A module store; listeners hear only a real change.
import { useMemo, useSyncExternalStore } from 'react';
import type { Element } from '@livepages/document';
import { createListeners } from '@/lib/listeners';

let held: ReadonlySet<string> = new Set();
const listeners = createListeners();

// The sheet drawn now holds a card table, or not.
export function markCardTableSheet(sheetId: string, has: boolean): void {
  if (!sheetId || held.has(sheetId) === has) return;
  const next = new Set(held);
  if (has) next.add(sheetId);
  else next.delete(sheetId);
  held = next;
  listeners.notify();
}

// Every mark forgotten (a test, a document left).
export function forgetCardTableSheets(): void {
  if (held.size === 0) return;
  held = new Set();
  listeners.notify();
}

const get = () => held;

// Whether `elements` include something that shows cards: a board, a view, or a Sheet holding a card table.
export function showsCards(
  elements: readonly Element[],
  cardTableSheets: ReadonlySet<string>,
): boolean {
  return elements.some(
    (el) =>
      el.type === 'shape' &&
      (el.shape === 'plan-board' ||
        el.shape === 'plan-view' ||
        (el.shape === 'plan-sheet' && !!el.planSheet && cardTableSheets.has(el.planSheet.sheetId))),
  );
}

export function useTabShowsCards(elements: readonly Element[]): boolean {
  const sheets = useSyncExternalStore(listeners.subscribe, get, get);
  return useMemo(() => showsCards(elements, sheets), [elements, sheets]);
}
