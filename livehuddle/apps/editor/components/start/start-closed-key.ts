import type { TemplateStartMode } from './start-template-items';

// The key a tab's template start is closed under (empty-card-dismissed.ts): per tab and mode, so each mode's start
// is closed, and brought back, on its own.
export const startClosedKey = (tabId: string, mode: TemplateStartMode): string =>
  `${tabId}:${mode}`;
