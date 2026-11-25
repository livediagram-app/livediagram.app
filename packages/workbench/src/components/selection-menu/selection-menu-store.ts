// The selection menu's one open request (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection menu"):
// an article's writing, which is a ProseMirror view outside React, asks for it here, and the editor's SendToPlanHost
// draws it. A module-level relay, as the send entries are: one editor runs per page.
import type { MenuPoint } from '../primitives/usePortalMenuPlacement';

/** What the menu's rows do. A row whose verb is null is left out (Cut and Paste where the words can't be edited,
 *  Send to Diagram in an app that drafts no diagrams). */
export type SelectionMenuActions = {
  cut: (() => void) | null;
  copy: () => void;
  paste: (() => void) | null;
  sendToPlan: () => void;
  sendToDiagram: (() => void) | null;
};

export type SelectionMenuAsk = {
  // The writing the words are in: the menu's trigger, so a press in it never counts as outside the menu.
  anchor: HTMLElement;
  // Where it opens: the pointer, under the words, or the screen's edge when docked.
  at: MenuPoint;
  placement: 'below-start' | 'above-start';
  // Docked to the screen's edge on a touch screen, clear of the browser's own callout.
  docked: boolean;
  actions: SelectionMenuActions;
};

export type SelectionMenuRequest = SelectionMenuAsk & { id: number };

let current: SelectionMenuRequest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

const tell = () => {
  for (const l of [...listeners]) l();
};

/** Opens the menu (in place of any open one); answers its id, which closes it. */
export function openSelectionMenu(ask: SelectionMenuAsk): number {
  current = { ...ask, id: nextId++ };
  tell();
  return current.id;
}

/** Closes the menu: this one by its id, or whichever is open. */
export function closeSelectionMenu(id?: number): void {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  tell();
}

/** The open menu, or null. */
export const currentSelectionMenu = (): SelectionMenuRequest | null => current;

/** The host's subscription (useSyncExternalStore); answers the unsubscribe. */
export function onSelectionMenuChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Marks the menu's rows, so a press on one holds the menu through the words it clears. */
export const SELECTION_MENU_ATTR = 'data-selection-menu';
