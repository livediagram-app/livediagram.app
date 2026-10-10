// Show Guides per logo page (docs/specs/007-editor/logo-pages.md "Construction guides"): a page's
// own choice, kept in this browser. A page with none follows the Logo Guides setting. Not a synced
// preference: those are capped at 4 KB, and page ids would fill it. The most recent choices are
// kept, the oldest dropped past LOGO_PAGE_GUIDES_MAX.
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';

const STORAGE_KEY = 'livediagram:v2:logo-page-guides';
/** How many pages' choices are kept (about 10 KB of local storage at most). */
export const LOGO_PAGE_GUIDES_MAX = 200;

/** A page's entry: its tab's id with its own, since page ids repeat across tabs and documents
 *  (every tab's first page is 'page-1'). */
export const logoPageGuidesKey = (tabId: string, pageId: string) => `${tabId}:${pageId}`;

export type LogoPageGuides = Readonly<Record<string, boolean>>;

export function readLogoPageGuides(): LogoPageGuides {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, boolean] => typeof e[1] === 'boolean',
      ),
    );
  } catch {
    return {};
  }
}

/** The choices with entry `id` (logoPageGuidesKey) set to `on` (moved to the most recent), saved. */
export function withLogoPageGuides(
  current: LogoPageGuides,
  id: string,
  on: boolean,
): LogoPageGuides {
  const { [id]: _drop, ...rest } = current;
  const entries = [...Object.entries(rest), [id, on] as [string, boolean]];
  const next = Object.fromEntries(entries.slice(-LOGO_PAGE_GUIDES_MAX));
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(next));
  return next;
}
