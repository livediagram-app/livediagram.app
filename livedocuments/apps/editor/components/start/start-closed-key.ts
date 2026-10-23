// The key a tab's template start is closed under (empty-card-dismissed.ts): per tab, so a closed start is remembered,
// and brought back, for that tab.
export const startClosedKey = (tabId: string): string => `${tabId}:pages`;
