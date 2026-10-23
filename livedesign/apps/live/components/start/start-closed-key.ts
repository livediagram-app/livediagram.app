import type { EditorMode } from '@livedesign/design';

// The key a tab's template start is closed under (empty-card-dismissed.ts): per tab and mode, so a closed start is
// remembered, and brought back, for that tab.
export const startClosedKey = (tabId: string, mode: EditorMode): string => `${tabId}:${mode}`;
