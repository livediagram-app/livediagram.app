// Which tabs' empty-tab cards this browser has closed (docs/specs/007-editor/new-document-route.md "The empty-canvas
// hint"): a closed card never shows again on that tab, for this person on this device. Kept in localStorage, the
// newest EMPTY_CARD_DISMISSED_MAX tab ids, so the list stays small however many tabs are closed over time.
export const EMPTY_CARD_DISMISSED_KEY = 'livediagram:v2:empty-card-dismissed';
export const EMPTY_CARD_DISMISSED_MAX = 200;

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(EMPTY_CARD_DISMISSED_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function emptyCardDismissed(tabId: string): boolean {
  return read().includes(tabId);
}

export function dismissEmptyCard(tabId: string): void {
  const ids = [...read().filter((id) => id !== tabId), tabId].slice(-EMPTY_CARD_DISMISSED_MAX);
  try {
    localStorage.setItem(EMPTY_CARD_DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full storage: the card closes for now and may show again next time.
  }
}
