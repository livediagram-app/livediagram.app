// The page each person was last on, per tab (docs/specs/007-editor/pages-mode.md "Back to
// the page you were on"): kept in this browser, so coming back to a tab of pages (switching tabs,
// a reload) frames that page rather than the first. Not a synced preference: those are capped at
// 4 KB, and tab ids would fill it. The most recent tabs are kept, the oldest dropped past
// LAST_PAGE_MAX.
import type { LaidOutPage } from '@livedesign/design';
import {
  readLocalStorageSafe,
  safeJson,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

// Kept under the mode's old name (Illustrate), so nobody loses the page they were on.
const STORAGE_KEY = 'livedesign:v2:last-illustrate-page';
/** How many tabs' pages are kept (about 20 KB of local storage at most). */
export const LAST_PAGE_MAX = 200;
/** How long the view rests before the page under it counts as the one you are on: a pan or a
 *  glide across the row records once, where it stops, not every page it passes. */
export const LAST_PAGE_SETTLE_MS = 400;

/** A tab's entry: its design's id with its own, so a tab id repeated across designs (a
 *  template's, a copy's) never borrows another design's page. */
export const lastPageKey = (designId: string, tabId: string) => `${designId}:${tabId}`;

type Remembered = Readonly<Record<string, string>>;

function readAll(): Remembered {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  const parsed = raw ? safeJson(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === 'string',
    ),
  );
}

/** The page id last recorded for entry `key` (lastPageKey), if any. */
export function readLastPage(key: string): string | undefined {
  return readAll()[key];
}

/** Records `pageId` as entry `key`'s page (moved to the most recent). A write that would change
 *  nothing is skipped. */
export function writeLastPage(key: string, pageId: string): void {
  const current = readAll();
  if (current[key] === pageId) return;
  const { [key]: _drop, ...rest } = current;
  const entries = [...Object.entries(rest), [key, pageId] as [string, string]];
  writeLocalStorageSafe(
    STORAGE_KEY,
    JSON.stringify(Object.fromEntries(entries.slice(-LAST_PAGE_MAX))),
  );
}

/** The page the view is on: the one under its centre, else the one whose centre is nearest it
 *  (the view resting in a gap between pages, or off the end of the row). */
export function pageNearestPoint(
  pages: readonly LaidOutPage[],
  point: { x: number; y: number },
): LaidOutPage | undefined {
  let best: LaidOutPage | undefined;
  let bestDistance = Infinity;
  for (const page of pages) {
    const { x, y, width, height } = page.rect;
    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) return page;
    const distance = Math.hypot(point.x - (x + width / 2), point.y - (y + height / 2));
    if (distance < bestDistance) {
      best = page;
      bestDistance = distance;
    }
  }
  return best;
}
