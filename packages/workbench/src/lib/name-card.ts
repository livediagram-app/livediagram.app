// Whether a visitor asked for the name card (liveworkspace/docs/specs/011-workbench/first-edit.md "A visitor's name"):
// a visitor's name is defaulted, not asked, so the card opens only from the name tray's Change Name. Held outside
// React so the tray (in the canvas chrome) and the editor state that gates the card read one value. Every editor's
// arrival still marks the name as offered (its `identityPromptOpen`); this says whether the card or the tray shows it.
import { useSyncExternalStore } from 'react';
import { createListeners } from './listeners';

let asked = false;
const listeners = createListeners();

/** The visitor pressed Change Name: the name card opens over the canvas. */
export function askNameCard(): void {
  if (asked) return;
  asked = true;
  listeners.notify();
}

/** The card was answered (Join or Cancel) or the tray's Keep It pressed: back to the tray's state. */
export function closeNameCard(): void {
  if (!asked) return;
  asked = false;
  listeners.notify();
}

export function nameCardAsked(): boolean {
  return asked;
}

export function useNameCardAsked(): boolean {
  return useSyncExternalStore(listeners.subscribe, nameCardAsked, () => false);
}

/** Split an offered name between the card and the tray: the card only once asked for. */
export function nameChoiceViews(offered: boolean, askedForCard: boolean) {
  return { card: offered && askedForCard, tray: offered && !askedForCard };
}

/** Tests: forget a press. */
export function resetNameCardForTests(): void {
  asked = false;
  listeners.clear();
}
