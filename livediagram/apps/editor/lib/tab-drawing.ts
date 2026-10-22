// A tab drawn where it is shown away from its own canvas (docs/specs/009-elements/tab-window.md "The drawing",
// docs/specs/007-editor/split-view.md "The other pane"): a Form tab its form on its tab's look, as respondents see it;
// a Pages tab its pages where they lie on the canvas, each as its page export draws it; any other tab its canvas
// (renderTabToSvg). Shared by useTabSvg (a tab window, the split view's other pane and its drop preview, a Dashboard's
// Diagram slot) and a window in an export (tabWindowArts), so each draws a tab the same way.
import {
  endpointPosition,
  exportFontIds,
  formLook,
  laidOutPagesOf,
  opensInOf,
  pagesWithWriting,
  prefixSvgIds,
  r2,
  resolveFontStack,
  tabKindOf,
  type ArrowElement,
  type Element,
  type Endpoint,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { readForm } from '@livediagram/forms';
import { formArt } from '@livediagram/plan-art';
import { pageWritingFonts } from './article/article-export';
import { renderTabToSvg, type ImageExportOpts } from './export-tab';

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" ';

/** The tab drawn, as a whole SVG document whose viewBox is in the tab's canvas space. */
export function renderTabDrawingSvg(tab: Tab, opts: ImageExportOpts = {}): string {
  if (tabKindOf(tab) === 'form') {
    const form = readForm(tab.form);
    if (form) {
      const look = formLook(tab);
      return formArt(form, look, resolveFontStack(look.font)).svg;
    }
  }
  const pages = laidOutPagesOf(tab);
  return pages.length ? pagesAsLaidOut(tab, pages, opts) : renderTabToSvg(tab, opts);
}

// Each page drawn as its page export (its sheet, background, writing and what reaches onto it, cut at its edges) and
// nested at its own rect, so the desk shows between them as on the canvas. Each page's ids are its own: two pages'
// backgrounds or markers never meet. Each page is drawn from the elements that reach it (pageElements), so a deck
// costs about one drawing of its tab rather than one per page.
function pagesAsLaidOut(tab: Tab, pages: readonly LaidOutPage[], opts: ImageExportOpts): string {
  // Estimated once for the whole tab, and only when a page carries writing.
  const estimatedWriting = pages.some((p) => p.flow) ? pagesWithWriting(tab).writing : undefined;
  const perPage = pageElements(tab.elements, pages);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { rect } of pages) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const parts = [
    `${SVG_OPEN}width="${r2(w)}" height="${r2(h)}" viewBox="${r2(minX)} ${r2(minY)} ${r2(w)} ${r2(h)}">`,
  ];
  pages.forEach((page, i) => {
    const markup = renderTabToSvg(
      { ...tab, elements: perPage[i]! },
      { ...opts, page, estimatedWriting },
    );
    const { x, y } = page.rect;
    parts.push(
      prefixSvgIds(markup, `pg${i}-`).replace(SVG_OPEN, `<svg x="${r2(x)}" y="${r2(y)}" `),
    );
  });
  parts.push('</svg>');
  return parts.join('\n');
}

/** For each page, the tab's elements (in their order) that may reach it: those whose box, or an arrow's span between
 *  its resolved ends, overlaps the page (the page frame's own `reaches` test, edges included), with the elements and
 *  arrows an arrow there is pinned to, so its ends resolve as on the whole tab. The renderer still asks `reaches` of
 *  each, so this only narrows what it walks. */
export function pageElements(
  elements: readonly Element[],
  pages: readonly LaidOutPage[],
): Element[][] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const all = elements as Element[];
  const spans = elements.map((el) => {
    if (el.type !== 'arrow') return { x: el.x, y: el.y, r: el.x + el.width, b: el.y + el.height };
    const a = endpointPosition(el.from, all);
    const b = endpointPosition(el.to, all);
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      r: Math.max(a.x, b.x),
      b: Math.max(a.y, b.y),
    };
  });
  return pages.map(({ rect }) => {
    const keep = new Set<string>();
    elements.forEach((el, i) => {
      const s = spans[i]!;
      const over =
        s.x <= rect.x + rect.width && s.r >= rect.x && s.y <= rect.y + rect.height && s.b >= rect.y;
      if (!over) return;
      keep.add(el.id);
      if (el.type === 'arrow') keepEnds(el, byId, keep, 0);
    });
    return elements.filter((el) => keep.has(el.id));
  });
}

// An arrow's ends: the element each is pinned to, or the arrow it sits on and that arrow's own ends (as
// endpointPosition follows them, a few hops at most).
function keepEnds(
  arrow: ArrowElement,
  byId: ReadonlyMap<string, Element>,
  keep: Set<string>,
  depth: number,
): void {
  if (depth > 4) return;
  for (const end of [arrow.from, arrow.to] as Endpoint[]) {
    if (end.kind === 'free') continue;
    const id = end.kind === 'on-arrow' ? end.arrowId : end.elementId;
    const target = byId.get(id);
    if (!target) continue;
    keep.add(id);
    if (target.type === 'arrow') keepEnds(target, byId, keep, depth + 1);
  }
}

/** The typefaces the drawing of this tab writes in: its elements', a form's, and its pages' writing. */
export function tabDrawingFontIdsOf(tab: Tab): string[] {
  const ids = new Set(exportFontIds(tab.elements, tab.font, undefined, tab.finish));
  if (tabKindOf(tab) === 'form' && tab.font) ids.add(tab.font);
  if (opensInOf(tab) === 'pages') {
    for (const page of laidOutPagesOf(tab))
      for (const id of pageWritingFonts(tab, page)) ids.add(id);
  }
  return [...ids];
}
