// Which tabs this page has saved, and a wait for one (docs/specs/030-forms/forms.md "Starting a form"). A form's
// responses sheet is made on a Sheet tab created a moment before: sent at once, its create reached the server before
// the tab's save and was refused `tab_not_found` (404), which the store retried, but which the browser printed as a
// red "Failed to load resource" line on every new form. Autosave notes each tab it saves; a create that needs its tab
// waits for that note. Bounded, so a save that never comes (an error, a closed tab) falls back to the retrying create.

/** How long a create waits for its tab's first save before it is sent anyway (the store still retries). */
export const TAB_SAVE_WAIT_MS = 8_000;

const saved = new Set<string>();
const waiting = new Map<string, Set<() => void>>();
const key = (documentId: string, tabId: string) => `${documentId}\u0000${tabId}`;

/** A tab's save reached the server (autosave, after its PUT). */
export function noteTabSaved(documentId: string, tabId: string): void {
  const k = key(documentId, tabId);
  saved.add(k);
  const wake = waiting.get(k);
  if (!wake) return;
  waiting.delete(k);
  for (const resolve of wake) resolve();
}

/** Resolves true once the tab is saved (at once if it already was), false when `timeoutMs` passes first. */
export function whenTabSaved(
  documentId: string,
  tabId: string,
  timeoutMs = TAB_SAVE_WAIT_MS,
): Promise<boolean> {
  const k = key(documentId, tabId);
  if (saved.has(k)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      waiting.get(k)?.delete(done);
      resolve(false);
    }, timeoutMs);
    const set = waiting.get(k) ?? new Set();
    set.add(done);
    waiting.set(k, set);
  });
}
