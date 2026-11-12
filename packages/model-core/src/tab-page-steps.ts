// A tab's pages changing page by page, for every product with pages (each product's docs/specs/012-collaboration/
// collab-race-hardening.md "Pages"): the steps a sender's change makes to its tab's page list, and those steps
// applied to a receiver's tab or to the stored one, by page id, so two Editors adding a page at once both keep it.
// The page list itself is the product's: `fallback` is its `pagesOf`, read for a tab that never stored its pages
// (one implicit first page).
import { applyIdListSteps, diffIdList, parseIdListSteps, type IdListStep } from './id-list-steps';
import { sameJsonValue } from './same-json-value';

type PageItem = { id: string };
type PagesTab = { pages?: unknown };

/** At most this many steps are read from a peer or a request: every page removed and every page put, many times
 *  over a product's page cap (100). */
export const MAX_PAGE_STEPS = 1_000;

const isPage = (p: unknown): p is PageItem =>
  !!p && typeof p === 'object' && typeof (p as PageItem).id === 'string';

/** The tab's page list as stored (entries without an id skipped), or `fallback`'s when it stored none. */
export function storedPageList<P extends PageItem>(
  tab: PagesTab | undefined,
  fallback: (tab: PagesTab | undefined) => P[],
): P[] {
  return Array.isArray(tab?.pages)
    ? (tab.pages as unknown[]).filter((p): p is P => isPage(p))
    : fallback(tab);
}

/** The steps from `before`'s pages to `after`'s; `previous` is the sender's last save still in flight, whose pages
 *  `after` lacks are removed too (diffIdList `gone`). Nothing when the page list is the same object. */
export function tabPageSteps<P extends PageItem>(
  before: PagesTab,
  after: PagesTab,
  fallback: (tab: PagesTab | undefined) => P[],
  previous?: PagesTab,
): IdListStep[] {
  const gone =
    previous && previous.pages !== after.pages
      ? storedPageList(previous, fallback).map((p) => p.id)
      : [];
  if (before.pages === after.pages && gone.length === 0) return [];
  return diffIdList(
    storedPageList(before, fallback),
    storedPageList(after, fallback),
    sameJsonValue,
    gone,
  );
}

/** A cap on a tab's pages: at most `max` of them, or of those `counts` picks (a product's page cap, and a cap on one
 *  kind of page). */
export type PageCap<P> = { max: number; counts?: (page: P) => boolean };

/** `pages` held to each cap (collab-race-hardening.md "Pages", "At the page cap"): while a cap is passed, the last
 *  page it counts that `had` lacks (one the merged change added) is left out. Pages `had` held always stay, and so
 *  does every other step of the change. */
export function withinPageCaps<P extends PageItem>(
  pages: P[],
  had: readonly P[],
  caps: readonly PageCap<P>[],
): P[] {
  let out = pages;
  const old = new Set(had.map((p) => p.id));
  for (const { max, counts = () => true } of caps) {
    let over = out.filter(counts).length - max;
    if (over <= 0) continue;
    const drop = new Set<string>();
    for (let i = out.length - 1; i >= 0 && over > 0; i--) {
      const page = out[i]!;
      if (counts(page) && !old.has(page.id)) {
        drop.add(page.id);
        over--;
      }
    }
    out = out.filter((p) => !drop.has(p.id));
  }
  return out;
}

/** `local`'s pages with a sender's `steps` applied, each page taken from `sent` (the sender's whole list), held to
 *  `caps`: a sender's added page that would pass one is left out here. */
export function pagesWithSteps<P extends PageItem>(
  local: PagesTab,
  steps: readonly IdListStep[],
  sent: readonly P[],
  fallback: (tab: PagesTab | undefined) => P[],
  caps: readonly PageCap<P>[] = [],
): P[] {
  const had = storedPageList(local, fallback);
  return withinPageCaps(applyIdListSteps(had, steps, sent), had, caps);
}

/** A peer's or a request's page steps, read defensively; null when absent or malformed (the sender's whole list
 *  then stands, as from a sender that sends none). */
export function parsePageSteps(v: unknown): IdListStep[] | null {
  return v === undefined ? null : parseIdListSteps(v, MAX_PAGE_STEPS);
}

/** The pages a save stores, given the stored tab, the saved one and the save's page steps
 *  (collab-race-hardening.md "A save is merged with the stored tab"): no steps, the saved pages as sent; steps that
 *  change nothing, the stored pages as they are; else the steps applied over the stored pages, by id, held to
 *  `caps` (a page the save added that no longer fits beside a peer's is left out; the rest of the save stands). */
export function savedPagesOver<P extends PageItem>(
  stored: PagesTab,
  saved: PagesTab,
  steps: readonly IdListStep[] | undefined,
  fallback: (tab: PagesTab | undefined) => P[],
  caps: readonly PageCap<P>[] = [],
): unknown {
  if (steps === undefined) return saved.pages;
  if (steps.length === 0) return stored.pages === undefined ? saved.pages : stored.pages;
  return pagesWithSteps(stored, steps, storedPageList(saved, fallback), fallback, caps);
}
