// Setting a page design (docs/specs/011-theme/blueprints/page-designs.md "Data and persistence"): the tab's, and a
// page's own override. Each answers the same tab when nothing changes. Pure.
import type { Tab } from '../index';
import { pagesOf, withPages } from '../page';
import { pageLockRefuses, pagesSharing, type PageEdit } from '../pages-edits';
import {
  compactPageDesign,
  isNoDesign,
  PAGE_DESIGN_NONE,
  parsePageDesign,
  samePageDesign,
  type PageDesign,
  type PageDesignOverride,
} from './tuning';

type DesignTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
  pageDesign?: unknown;
};

/** The tab's design set (compacted), or cleared with null. */
export function withTabPageDesign<T extends DesignTab>(tab: T, design: PageDesign | null): T {
  const next = design ? compactPageDesign(design) : undefined;
  const now = parsePageDesign(tab.pageDesign);
  if (samePageDesign(now, next)) return tab;
  if (!next) {
    const { pageDesign: _drop, ...rest } = tab;
    return rest as T;
  }
  return { ...tab, pageDesign: next };
}

/** Every page wearing the tab's design again: each unlocked page's own design dropped (Page Design's Affect All Pages,
 *  docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"); a locked page keeps its own. */
export function withEveryPageOnTabDesign<T extends DesignTab>(tab: T): T {
  const pages = pagesOf(tab);
  if (!pages.some((p) => p.design !== undefined && !pageLockRefuses(pages, p.id))) return tab;
  return withPages(
    tab,
    pages.map((p) => {
      if (p.design === undefined || pageLockRefuses(pages, p.id)) return p;
      const { design: _drop, ...rest } = p;
      return rest;
    }),
  );
}

/** A page's own design: a design, none (`'none'`, while the tab has one), or null to wear the tab's again. An article
 *  page's reaches every page of its article, as its background does. */
export function pageDesignSet<T extends DesignTab>(
  tab: T,
  pageId: string,
  design: PageDesign | typeof PAGE_DESIGN_NONE | null,
): PageEdit<T> {
  const pages = pagesOf(tab);
  if (!pages.some((p) => p.id === pageId)) return { refused: 'unknown_page' };
  if (pageLockRefuses(pages, pageId)) return { refused: 'locked' };
  const next: PageDesignOverride | undefined =
    design === PAGE_DESIGN_NONE
      ? { id: PAGE_DESIGN_NONE }
      : design
        ? compactPageDesign(design)
        : undefined;
  const reach = pagesSharing(pages, pageId);
  if (pages.every((p) => !reach.has(p.id) || samePageDesign(p.design, next))) return { tab };
  return {
    tab: withPages(
      tab,
      pages.map((p) => {
        if (!reach.has(p.id)) return p;
        const { design: _drop, ...rest } = p;
        return next ? { ...rest, design: next } : rest;
      }),
    ),
  };
}

/** The design a page wears by name: its own, none, or the tab's. */
export function pageDesignIdOf(
  page: { design?: PageDesignOverride },
  tabDesign: PageDesign | undefined,
): string | null {
  if (isNoDesign(page.design)) return null;
  return (page.design ?? tabDesign)?.id ?? null;
}
