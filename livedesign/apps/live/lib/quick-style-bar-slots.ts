// Where the Quick Style bar goes (docs/specs/008-canvas/quick-style-panel.md "Where it sits"). Each page's title-bar
// row registers its slot (the element just left of its title bar, and whether the title bar names its buttons); the
// bar portals into the slot of its page and publishes the room it takes there, so that page's label truncates to what
// is left. A small store, so a selection change re-renders the bar and the pages' row, never the editor.
import { useSyncExternalStore } from 'react';
import type { AppearanceRowItem } from '@liveworkspace/workbench/components/canvas/AppearanceRowList';

export type QuickStyleBarSlot = { el: HTMLElement; named: boolean };
// Screen px the bar takes beside a page's title bar (its width and the gap). One bar, so one page at a time.
export type QuickStyleBarRoom = { pageId: string; px: number };

const slots = new Map<string, QuickStyleBarSlot>();
let room: QuickStyleBarRoom | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A page's slot appearing, or changing whether its title bar is named. */
export function setQuickStyleBarSlot(pageId: string, slot: QuickStyleBarSlot): void {
  const was = slots.get(pageId);
  if (was && was.el === slot.el && was.named === slot.named) return;
  slots.set(pageId, slot);
  emit();
}

/** A page's slot going; only its own element, so a remounted row's new slot is never dropped by the old one's
 *  cleanup. */
export function clearQuickStyleBarSlot(pageId: string, el: HTMLElement): void {
  if (slots.get(pageId)?.el !== el) return;
  slots.delete(pageId);
  emit();
}

/** The bar's room beside a page's title bar; 0 or less when it leaves (only that page's room is given back). */
export function setQuickStyleBarRoom(pageId: string, px: number): void {
  const next = Math.max(0, Math.round(px));
  if (next === 0) {
    if (room?.pageId !== pageId) return;
    room = null;
  } else {
    if (room?.pageId === pageId && room.px === next) return;
    room = { pageId, px: next };
  }
  emit();
}

/** The slot of the page the bar sits on; null with no page or before its row has drawn. */
export function useQuickStyleBarSlot(pageId: string | null): QuickStyleBarSlot | null {
  return useSyncExternalStore(
    subscribe,
    () => (pageId ? (slots.get(pageId) ?? null) : null),
    () => null,
  );
}

/** On a phone, the Quick Style rows for its page's Appearance sheet (docs/specs/008-canvas/quick-style-panel.md "On a
 *  phone, in Appearance"), and how to open one's own sheet. One bar, so one page at a time. */
export type QuickStylePhoneRows = {
  pageId: string;
  rows: readonly AppearanceRowItem<string>[];
  open: (id: string) => void;
};

let phone: QuickStylePhoneRows | null = null;

/** The rows going on a page's Appearance; null takes them back (only that page's, so a move never drops the new
 *  page's). */
export function setQuickStylePhoneRows(pageId: string, rows: QuickStylePhoneRows | null): void {
  if (rows) phone = rows;
  else if (phone?.pageId === pageId) phone = null;
  else return;
  emit();
}

/** The phone's Quick Style rows, and the page whose Appearance lists them; null while nothing is styled. */
export function useQuickStylePhoneRows(): QuickStylePhoneRows | null {
  return useSyncExternalStore(
    subscribe,
    () => phone,
    () => null,
  );
}

/** The room the bar takes, and beside which page's title bar; null while it shows nowhere. */
export function useQuickStyleBarRoom(): QuickStyleBarRoom | null {
  return useSyncExternalStore(
    subscribe,
    () => room,
    () => null,
  );
}
