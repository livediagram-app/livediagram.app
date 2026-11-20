// Where the Quick Style bar goes (docs/specs/008-canvas/quick-style-panel.md "Where it sits"). Each page's title-bar
// row registers its slot (the element left of its title bar, and whether the title bar names its buttons); the bar
// portals into the slot of the selection's page and publishes the room it takes there, so that page's label
// truncates to what is left. A small store, so a selection change re-renders the bar and the one page whose label
// moves, never the rest of the pages.
import { useSyncExternalStore } from 'react';
import type { AppearanceRowItem } from '@liveworkspace/workbench/components/canvas/AppearanceRowList';

export type QuickStyleBarSlot = { el: HTMLElement; named: boolean };

const slots = new Map<string, QuickStyleBarSlot>();
// Screen px the bar takes beside a page's title bar (its width and the gap), by page.
const rooms = new Map<string, number>();
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

/** The bar's room beside a page's title bar; 0 or less when it leaves. */
export function setQuickStyleBarRoom(pageId: string, room: number): void {
  const next = Math.max(0, Math.round(room));
  if ((rooms.get(pageId) ?? 0) === next) return;
  if (next === 0) rooms.delete(pageId);
  else rooms.set(pageId, next);
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

/** The room the bar takes beside this page's title bar (0 while it is elsewhere). */
export function useQuickStyleBarRoom(pageId: string): number {
  return useSyncExternalStore(
    subscribe,
    () => rooms.get(pageId) ?? 0,
    () => 0,
  );
}

/** On a phone, the selection's Quick Style rows for its page's Appearance sheet (docs/specs/008-canvas/
 *  quick-style-panel.md "On a phone, in Appearance"), and how to open one's own sheet. */
export type QuickStylePhoneRows = {
  rows: readonly AppearanceRowItem<string>[];
  open: (id: string) => void;
};

const phones = new Map<string, QuickStylePhoneRows>();

export function setQuickStylePhoneRows(pageId: string, rows: QuickStylePhoneRows | null): void {
  if (rows) phones.set(pageId, rows);
  else if (phones.has(pageId)) phones.delete(pageId);
  else return;
  emit();
}

/** The selection's rows for this page's Appearance, or null while nothing on it is styled. */
export function useQuickStylePhoneRows(pageId: string): QuickStylePhoneRows | null {
  return useSyncExternalStore(
    subscribe,
    () => phones.get(pageId) ?? null,
    () => null,
  );
}
