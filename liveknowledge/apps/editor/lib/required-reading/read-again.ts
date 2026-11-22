// Ask Everyone to Read Again (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): the draft bar's
// toggle, one page at a time, off by default. Save is a sync commit with no room for a flag, so the toggle's state
// lives here: Save takes it (useEditorPageEditing.save) and, when it was on, the sender the toggle registered asks
// the api; the toggle leaving (Save or Cancel ends edit mode) turns it off.
import { useSyncExternalStore } from 'react';

const on = new Set<string>();
const listeners = new Set<() => void>();
let sender: ((tab: string) => void) | null = null;

const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function readAgainOf(tab: string): boolean {
  return on.has(tab);
}

export function setReadAgain(tab: string, value: boolean): void {
  if (on.has(tab) === value) return;
  if (value) on.add(tab);
  else on.delete(tab);
  notify();
}

/** The one sender: the toggle's, which knows the caller and the knowledgebase. Answers how to let it go. */
export function registerReadAgainSender(send: (tab: string) => void): () => void {
  sender = send;
  return () => {
    if (sender === send) sender = null;
  };
}

/** Save's: whether the page was saved asking everyone again, which it then asks. Turns the toggle off. */
export function takeReadAgain(tab: string): boolean {
  if (!on.has(tab)) return false;
  setReadAgain(tab, false);
  if (!sender) return false;
  sender(tab);
  return true;
}

export function useReadAgain(tab: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => on.has(tab),
    () => false,
  );
}
