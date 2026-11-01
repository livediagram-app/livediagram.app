// What livehuddle still owns of Explorer Home (docs/specs/013-workspace/explorer-home.md): the editor's open
// marker, which the api reads to count an open, and the use window the offline opens share. Home's reads themselves
// are liveworkspace's index's.

import { utcDay } from '@liveworkspace/api-schema/within-reach';
import { DAY_MS } from '@livehuddle/document';

/** How many UTC days back, today included, a use day counts towards most used (spec). */
export const WITHIN_REACH_USE_WINDOW_DAYS = 90;

/** UTC midnight of the use window's first day: 89 days before today. */
export function windowStartOf(now: number): number {
  return Date.parse(`${utcDay(now - (WITHIN_REACH_USE_WINDOW_DAYS - 1) * DAY_MS)}T00:00:00.000Z`);
}

/** The editor's declaration that a tab read is an open (docs/specs/013-workspace/explorer-home.md
 *  "Opens"). Nothing else sends it, so a duplicate, an embed or a resync is never counted. */
export const DOCUMENT_OPEN_HEADER = 'X-Document-Open';

/** True when a request's `X-Document-Open` value declares an open. */
export function readDocumentOpen(value: string | null): boolean {
  return value === '1';
}
