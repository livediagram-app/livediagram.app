// The use window Jump back in counts most used over (docs/specs/013-workspace/explorer-home.md): the editor's
// This Browser opens are kept to it (apps/editor/lib/offline/offline-opens.ts).

import { DAY_MS, utcDay } from './within-reach';

/** How many UTC days back, today included, a use day counts towards most used (spec). */
export const WITHIN_REACH_USE_WINDOW_DAYS = 90;

/** UTC midnight of the use window's first day: 89 days before today. */
export function windowStartOf(now: number): number {
  return Date.parse(`${utcDay(now - (WITHIN_REACH_USE_WINDOW_DAYS - 1) * DAY_MS)}T00:00:00.000Z`);
}
