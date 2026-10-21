// Which tabs' empty-tab cards this browser has closed (docs/specs/007-editor/new-document-route.md "The empty-canvas
// hint"): a closed card never shows again on that tab, for this person on this device. Kept in localStorage, the
// newest EMPTY_CARD_DISMISSED_MAX tab ids, so the list stays small however many tabs are closed over time.
import { createListeners } from '@/lib/listeners';

export const EMPTY_CARD_DISMISSED_KEY = 'liveplanner:v2:empty-card-dismissed';
export const EMPTY_CARD_DISMISSED_MAX = 200;

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(EMPTY_CARD_DISMISSED_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// Closed this session where storage could not keep it (private mode, full storage), and the readers to tell of a
// change (a start panel and the tray that brings it back read the same key).
const closedNow = new Set<string>();
const listeners = createListeners();
const changed = () => {
  listeners.notify();
};

export function emptyCardDismissed(tabId: string): boolean {
  return closedNow.has(tabId) || read().includes(tabId);
}

function write(ids: string[]): boolean {
  try {
    localStorage.setItem(EMPTY_CARD_DISMISSED_KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

export function dismissEmptyCard(tabId: string): void {
  // Storage refused: the card closes for now and may show again next time.
  if (!write([...read().filter((id) => id !== tabId), tabId].slice(-EMPTY_CARD_DISMISSED_MAX)))
    closedNow.add(tabId);
  changed();
}

/** Brings a closed card (a start panel) back on that tab (docs/specs/007-editor/start-diagramming.md "Bringing it
 *  back"). */
export function restoreEmptyCard(tabId: string): void {
  closedNow.delete(tabId);
  write(read().filter((id) => id !== tabId));
  changed();
}

export const subscribeEmptyCardDismissed = listeners.subscribe;
