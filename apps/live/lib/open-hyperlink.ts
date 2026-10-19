import { track } from '@/lib/telemetry';

// Open a Sheet cell's HYPERLINK in a new tab (docs/specs/029-sheets/formulas.md "Text"). The target came through
// safeHyperlink (http, https or mailto only); `noopener,noreferrer` keeps the opened page from reaching back into the
// editor. Telemetry names the act, never the address.
export function openHyperlink(url: string): void {
  track('Sheet', 'Opened', 'Hyperlink');
  window.open(url, '_blank', 'noopener,noreferrer');
}
