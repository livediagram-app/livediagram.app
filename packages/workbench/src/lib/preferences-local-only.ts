// Whose preferences this page keeps in this browser alone (each editor's docs/specs/007-editor/user-preferences.md
// "This app or All"): the api answered that it keeps none for them (a deployment without liveworkspace accounts, or an
// owner the accounts database has no place for). One record for every editor, whichever version of the save queue it
// runs (each editor's `lib/preferences-sync.ts` writes here when the api says so and clears its own queue), so the
// Settings host reads one answer: with an account's preferences kept locally there is no account copy for All to show.
// Held for the page's life; a reload asks the api again.

const owners = new Set<string>();
const listeners = new Set<() => void>();

/** The api keeps no preferences for `ownerId`: they stay in this browser for the page's life. */
export function rememberPreferencesKeptLocally(ownerId: string): void {
  if (owners.has(ownerId)) return;
  owners.add(ownerId);
  for (const listener of listeners) listener();
}

/** Whether `ownerId`'s preferences stay in this browser; without an owner, whether anyone's do on this page. */
export function preferencesKeptLocally(ownerId?: string | null): boolean {
  if (ownerId === undefined) return owners.size > 0;
  return ownerId !== null && owners.has(ownerId);
}

/** Hears each new answer (the Settings host follows it, so an open Settings drops All the moment it comes). No React
 *  here: the save queue that writes it is also read while the page's first HTML is made. */
export function subscribePreferencesKeptLocally(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: forget every answer. */
export function __resetPreferencesKeptLocally(): void {
  owners.clear();
  for (const listener of listeners) listener();
}
