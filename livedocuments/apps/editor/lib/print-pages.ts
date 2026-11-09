// Print (docs/specs/020-import-export/print.md): which pages a scope prints, and the print document that holds
// them, each page its own sheet at its own size. Pure: the drawing (renderTabToSvg, the PDF export's picture) is
// handed in, so the sheets and the page rules are tested without a browser.
import {
  laidOutPagesOf,
  offersPageKindChoice,
  pagesOf,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';

/** Current Page or Whole Document. */
export type PrintScope = 'page' | 'document';

/** One printed sheet: a page, and the tab it is drawn from. */
export type PrintSheet = { tab: Tab; page: LaidOutPage };

/** The sheets a scope prints. The current page is this tab's chosen page; the whole document is every tab's pages
 *  in tab order, this tab's as the editor lays them out and another's as stored, a tab still on the Start screen
 *  (nothing chosen, nothing on it) skipped. */
export function printSheets(
  scope: PrintScope,
  current: { tab: Tab; pages: readonly LaidOutPage[]; page: LaidOutPage },
  documentTabs: readonly Tab[],
): PrintSheet[] {
  if (scope === 'page') return [{ tab: current.tab, page: current.page }];
  // The dialog's tab may be one the document's list does not hold (a fresh copy): it still prints.
  const tabs = documentTabs.some((t) => t.id === current.tab.id) ? documentTabs : [current.tab];
  const sheets: PrintSheet[] = [];
  for (const t of tabs) {
    if (t.id === current.tab.id) {
      for (const page of current.pages) sheets.push({ tab: current.tab, page });
      continue;
    }
    const stored = pagesOf(t);
    if (stored[0] && offersPageKindChoice(stored, stored[0].id, t.elements.length)) continue;
    for (const page of laidOutPagesOf(t)) sheets.push({ tab: t, page });
  }
  return sheets;
}

/** How many tabs the sheets come from, for the panel's line. */
export function printTabCount(sheets: readonly PrintSheet[]): number {
  return new Set(sheets.map((s) => s.tab.id)).size;
}

const ID_ATTR = /(\s)id="([^"]+)"/g;
const ID_REF = /url\(#([^)"'\s]+)\)|((?:xlink:)?href)="#([^"]+)"/g;

/** One sheet's drawing with its ids and the references to them made its own (`p<sheet>-<id>`): the sheets share one
 *  HTML document, where `url(#id)` finds the first element with that id, and two tabs' drawings share ids (every
 *  tab's first page is `page-1`, a copied tab keeps its element ids), so a later sheet painted the earlier one's
 *  gradient, pattern, fade or clip. One pass to read the ids and one to rewrite: linear in the markup. */
export function sheetScopedSvg(svg: string, sheet: number): string {
  const ids = new Set<string>();
  for (const m of svg.matchAll(ID_ATTR)) ids.add(m[2]!);
  if (ids.size === 0) return svg;
  const own = (id: string) => `p${sheet}-${id}`;
  return svg
    .replace(ID_ATTR, (_, space: string, id: string) => `${space}id="${own(id)}"`)
    .replace(ID_REF, (all, url: string | undefined, attr: string | undefined, href: string) => {
      if (url !== undefined) return ids.has(url) ? `url(#${own(url)})` : all;
      return ids.has(href) ? `${attr}="#${own(href)}"` : all;
    });
}

// A page's size in whole CSS px, the unit its rect is in (an A4 page is 794 x 1123).
const px = (n: number) => Math.max(1, Math.round(n));

/** The print document: one named `@page` rule per page size (each sheet exactly its page, no margin, so the browser
 *  adds no header or footer), then one section per sheet holding its drawing. Backgrounds print
 *  (`print-color-adjust: exact`). `svgOf` draws a sheet as the PDF export does; each drawing's ids are made its
 *  sheet's own (sheetScopedSvg). */
export function printDocumentHtml(
  sheets: readonly PrintSheet[],
  svgOf: (sheet: PrintSheet) => string,
): string {
  const sizes = new Map<string, { w: number; h: number }>();
  const body: string[] = [];
  sheets.forEach((sheet, i) => {
    const w = px(sheet.page.rect.width);
    const h = px(sheet.page.rect.height);
    const name = `s${w}x${h}`;
    sizes.set(name, { w, h });
    const last = i === sheets.length - 1;
    body.push(
      `<section class="sheet" style="page:${name};width:${w}px;height:${h}px${last ? '' : ';break-after:page'}">${sheetScopedSvg(svgOf(sheet), i)}</section>`,
    );
  });
  const rules = [...sizes].map(([name, { w, h }]) => `@page ${name}{size:${w}px ${h}px;margin:0}`);
  // The first size is also the default sheet, for a browser without named pages.
  const first = [...sizes.values()][0];
  const fallback = first ? `@page{size:${first.w}px ${first.h}px;margin:0}` : '@page{margin:0}';
  const css = [
    fallback,
    ...rules,
    'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.sheet{display:block;overflow:hidden;break-inside:avoid;page-break-inside:avoid}',
    '.sheet>svg{display:block;width:100%;height:100%}',
  ].join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>${css}</style></head><body>${body.join('')}</body></html>`;
}
