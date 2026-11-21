// Which knowledgebases this browser tab offers the start screen on (docs/specs/030-knowledgebase/describe-to-set-up.md
// "The start screen"): the one `/new` just made, until a choice closes it. Kept in sessionStorage, so a reload keeps it
// and nothing about it is ever stored on the knowledgebase: no other person, device or browser tab sees it. Storage
// that throws (a private window, blocked site data) reads as not offered, so the knowledgebase opens on its page.
import { useSyncExternalStore } from 'react';

const KEY_PREFIX = 'liveknowledge:v2:start-offered:';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const keyOf = (tabId: string) => `${KEY_PREFIX}${tabId}`;

/** Offers the start on the tab `/new` made. */
export function offerKnowledgebaseStart(tabId: string): void {
  try {
    sessionStorage.setItem(keyOf(tabId), '1');
  } catch {
    // No storage: the knowledgebase opens on its page.
  }
  notify();
}

/** Closes the start for good: a choice was made. */
export function closeKnowledgebaseStart(tabId: string): void {
  try {
    sessionStorage.removeItem(keyOf(tabId));
  } catch {
    // Nothing kept, nothing to remove.
  }
  notify();
}

/** Whether the tab is offered the start, read outside React. */
export function knowledgebaseStartOffered(tabId: string): boolean {
  try {
    return sessionStorage.getItem(keyOf(tabId)) === '1';
  } catch {
    return false;
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether the tab is offered the start, following offers and closes. */
export function useKnowledgebaseStartOffered(tabId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => knowledgebaseStartOffered(tabId),
    () => false,
  );
}
