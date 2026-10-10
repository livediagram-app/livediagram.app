// Share reopens by itself after a Local only document syncs from the Share dialog
// (docs/specs/006-document/offline-mode.md "Sharing a guest's Local only document"). Sync Document reloads
// the page, so the intent crosses the reload as a one-shot sessionStorage flag holding the document id:
// set just before the reload, cleared when read, honoured only by the document it names.

const KEY = 'livediagram:v2:share-after-sync';

export function markShareAfterSync(documentId: string): void {
  try {
    sessionStorage.setItem(KEY, documentId);
  } catch {
    // Storage blocked: the page reloads without reopening Share, which is the old behaviour.
  }
}

// Whether `documentId` asked for Share on arrival. Reading clears the flag whichever document it named,
// so a stale one never fires on a later open.
export function takeShareAfterSync(documentId: string): boolean {
  try {
    const wanted = sessionStorage.getItem(KEY);
    if (wanted === null) return false;
    sessionStorage.removeItem(KEY);
    return wanted === documentId;
  } catch {
    return false;
  }
}
