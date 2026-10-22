// The row's pages and the choice of the first page's kind (docs/specs/007-editor/pages-mode.md
// "Page actions", "Page kinds"): moving a page to a new place, and turning the tab's only, untouched
// page into the kind chosen for it.
import {
  pagesOf,
  newLogoPage,
  newWireframePage,
  withPages,
  type Page,
  type PageKind,
} from './page';
import type { Tab } from './index';
import type { WireframeDeviceId } from './wireframe-device';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
};

/** One thing in the row that moves as one: a page. Kept as a unit so the row's reorder and contents
 *  read the same whether or not a kind ever spans pages again. */
type PageUnit = { pageIds: string[] };

/** The row as units, in order: one per page. */
export function pageUnits(pages: readonly Page[]): PageUnit[] {
  return pages.map((p) => ({ pageIds: [p.id] }));
}

/** The pages a page-wide change reaches: the page itself. */
export function pagesSharing(pages: readonly Page[], pageId: string): Set<string> {
  return pages.some((p) => p.id === pageId) ? new Set([pageId]) : new Set();
}

/** The row with a page moved to `to` (its place among the pages, 0 first), its content moving
 *  with it. Null when nothing moves. */
export function withUnitMoved<T extends PagesTab>(
  tab: T,
  pageId: string,
  to: number,
): (T & { pages: Page[] }) | null {
  const pages = pagesOf(tab);
  const from = pages.findIndex((p) => p.id === pageId);
  if (from < 0) return null;
  const place = Math.max(0, Math.min(to, pages.length - 1));
  if (place === from) return null;
  const next = [...pages];
  const [moved] = next.splice(from, 1);
  next.splice(place, 0, moved!);
  return withPages(tab, next);
}

/** Whether a page still offers the choice of its kind (docs/specs/007-editor/pages-mode.md
 *  "Page kinds"): the tab's only page, never chosen, with nothing on it. */
export function offersPageKindChoice(
  pages: readonly Page[],
  pageId: string,
  contentCount: number,
): boolean {
  return pages.length === 1 && pages[0]!.id === pageId && !pages[0]!.kind && contentCount === 0;
}

/** The tab with its first page's kind chosen: a logo page (the 1024 artboard) or a wireframe page
 *  (the device). Null when the page no longer offers the choice. */
export function withPageKindChosen<T extends PagesTab>(
  tab: T,
  pageId: string,
  kind: PageKind,
  // A wireframe page's device (docs/specs/007-editor/wireframe-pages.md "Choosing the device").
  device?: WireframeDeviceId,
): (T & { pages: Page[] }) | null {
  const pages = pagesOf(tab);
  const page = pages.find((p) => p.id === pageId);
  if (!page || pages.length !== 1 || page.kind) return null;
  const { name } = page;
  if (kind === 'logo') {
    // The artboard keeps the page's name and fill; a logo page takes no pattern.
    const fill = page.background?.fill;
    return withPages(tab, [
      {
        ...newLogoPage(page.id),
        ...(fill ? { background: { fill } } : {}),
        ...(name ? { name } : {}),
      },
    ]);
  }
  // The device keeps the page's name and background, which paints its screen.
  return withPages(tab, [
    {
      ...newWireframePage(page.id, device),
      ...(page.background ? { background: page.background } : {}),
      ...(name ? { name } : {}),
    },
  ]);
}
