// A form template's starter, waiting for the editor (docs/specs/030-forms/forms.md "Starting a form"): /new makes the
// document with an empty Plan tab and leaves the starter here under the tab's id; the editor starts the form on that tab
// once it can (PendingFormStart). Kept in sessionStorage, as /new hands over to the editor with a page load; a memory
// copy covers storage refused.
import type { StarterId } from '@livediagram/forms';

const KEY = (tabId: string) => `livediagram:pending-form-start:${tabId}`;
const memory = new Map<string, StarterId>();

export function markPendingFormStart(tabId: string, starter: StarterId): void {
  memory.set(tabId, starter);
  try {
    sessionStorage.setItem(KEY(tabId), starter);
  } catch {
    // Storage refused: the memory copy serves this page.
  }
}

/** The starter waiting for `tabId`, taken (so it starts once), or null. */
export function takePendingFormStart(tabId: string): StarterId | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(KEY(tabId));
    sessionStorage.removeItem(KEY(tabId));
  } catch {
    // Storage refused: the memory copy, if any.
  }
  const held = memory.get(tabId) ?? stored;
  memory.delete(tabId);
  // An id no starter has starts Blank (formStarter); the forms package stays out of the page's first load.
  return held ? (held as StarterId) : null;
}

/** Whether a starter waits for `tabId`, without taking it. */
export function hasPendingFormStart(tabId: string): boolean {
  if (memory.has(tabId)) return true;
  try {
    return sessionStorage.getItem(KEY(tabId)) !== null;
  } catch {
    return false;
  }
}
