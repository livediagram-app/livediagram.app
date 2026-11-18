// A shape's live status binding (docs/specs/009-elements/live-status.md "The binding"): `statusUrl`, a public https
// URL held to the same rules as a webhook's (the shared `parsePublicHttpsUrl`), and the distinct URLs a document's
// room checks once a round.

import { parsePublicHttpsUrl } from '@liveworkspace/model-core/public-https-url';
import type { Tab } from './index';

export const STATUS_URL_MAX = 2048;

/** A stored `statusUrl`: trimmed, and one the shared public https address check takes. */
export function isStatusUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    parsePublicHttpsUrl(value, STATUS_URL_MAX).ok
  );
}

/** The distinct status URLs bound on the tabs' shapes, in tab then element order, at most `max`. */
export function statusUrlsOf(tabs: readonly Pick<Tab, 'elements'>[], max: number): string[] {
  const urls = new Set<string>();
  for (const tab of tabs) {
    for (const element of tab.elements) {
      if (urls.size >= max) return [...urls];
      if (element.type === 'shape' && typeof element.statusUrl === 'string') {
        urls.add(element.statusUrl);
      }
    }
  }
  return [...urls];
}
