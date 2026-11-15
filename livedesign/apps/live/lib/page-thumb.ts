// One page's picture (docs/specs/007-editor/pages-mode.md "Contents"): what is on the page drawn by the headless
// renderer the exports use, framed to the page, on its background. The Contents list's thumbnails. The markup is
// our own renderer's output (user text is xmlEscaped inside it), so injecting it is safe.
import {
  r2,
  pagesOf,
  layOutPages,
  elementIdsOnPage,
  arrowLabelFontStack,
  arrowLabelPass,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  type CanvasSurface,
  type Tab,
  tabWireframeFrameTheme,
} from '@livedesign/design';
import { CANVAS_PAPER } from '@/lib/page-paint';
import { pageExportFrame } from '@/lib/export-page';
import { exportChartInk } from '@/lib/export-chart-ink';
import { thumbImageIds } from '@/lib/thumb-images';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';

// The picture whole (`markup`) and part by part (`parts`: the page, then each element by id, in paint order), so
// Contents re-sets only the parts a change redrew (docs/specs/008-canvas/canvas-performance.md "Pictures of every
// page").
export type PageThumb = {
  markup: string;
  viewBox: string;
  parts: readonly { key: string; markup: string }[];
};

// Each box's markup by its element, carried over from the last picture that drew it under the same `key` (everything
// svgBoxed reads beyond the element): a drop redraws the boxes it changed, not the page's thousand.
const boxedMarkup = new WeakMap<object, { key: string; svg: string }>();

export type PageThumbOptions = {
  // Whether the icon catalogues have landed: until then icons draw as nothing.
  iconsLoaded: boolean;
  // The tab's arrow labels, laid out once for many pages of one tab; laid out here when absent.
  labels?: ReturnType<typeof arrowLabelPass>;
  // The canvas's surface: a page with no fill is drawn on the paper as the canvas shows it (slate
  // in dark mode, CANVAS_PAPER), its ink the canvas's. Light when absent.
  surface?: CanvasSurface;
  // A picture's URL by image id (thumb-images.ts's thumbImageHref): an image element and a page's
  // picture fill draw it, and without one (or before it arrives) the placeholder and the tone.
  resolveImageHref?: (imageId: string) => string | undefined;
  // A photo page's picture (its preview's URL) by page id (docs/specs/031-photo/photo-pages.md "Exports and other
  // views"): without one the page draws the checkerboard and a picture glyph.
  photoHref?: (pageId: string) => string | undefined;
};

/** The tab's arrow labels as the canvas lays them out, for pageThumbFor's `labels`. */
export function tabArrowLabels(tab: Tab): ReturnType<typeof arrowLabelPass> {
  return arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
}

/** A page's picture, or null when the tab has no such page. */
export function pageThumbFor(pageId: string, tab: Tab, opts: PageThumbOptions): PageThumb | null {
  const laid = layOutPages(pagesOf(tab));
  const page = laid.find((p) => p.id === pageId);
  if (!page) return null;
  const art = opts.iconsLoaded
    ? { resolveIconArt: resolveIconArtLoaded, resolveStickerArt: resolveStickerArtLoaded }
    : {};
  // What is on the page, in the tab's own paint order.
  const on = elementIdsOnPage(tab.elements, laid, pageId);
  const elements = tab.elements.filter((el) => on.has(el.id));
  // Boxed first, then arrows, matching the canvas's own paint order so a connector never
  // disappears under the box it points at.
  const parts: { key: string; markup: string }[] = [];
  // A page's surface sets its ink, as the canvas draws it: light ink on a dark page, and a page with
  // no fill on the canvas's own paper in the canvas's ink.
  const canvasSurface = opts.surface ?? 'light';
  let surface: CanvasSurface = canvasSurface;
  const frame = pageExportFrame(page, {
    paper: CANVAS_PAPER[canvasSurface === 'dark' ? 'dark' : 'light'],
    idPrefix: `lvd-thumb-${pageId}`,
    imageHref: opts.resolveImageHref,
    ...(opts.photoHref ? { photoHref: opts.photoHref } : {}),
    frameTheme: tabWireframeFrameTheme(tab),
  });
  if (page.background?.fill) surface = frame.surface;
  parts.push({ key: 'page', markup: frame.backgroundSvg });
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(elements, tab.finish);
  // Charts in the tab theme's colours and, on a filled page, adapted to what they sit on, as on the
  // canvas and in the exports (without the palette every chart fell back to the built-in ramp).
  const { chartPalette, chartGrounds } = exportChartInk(tab, page);
  const shared = `${opts.iconsLoaded}|${tab.font}|${tab.finish}|${surface}|${chartPalette.join(',')}`;
  for (const el of elements) {
    if (el.type !== 'arrow') {
      // A box reads, beyond the shared key, whether it is a backdrop, what a chart sits on and its pictures' URLs.
      const hrefs = opts.resolveImageHref
        ? thumbImageIds([el], undefined).map((id) => opts.resolveImageHref!(id) ?? '')
        : [];
      const key = `${shared}|${backdrops.has(el.id)}|${chartGrounds?.get(el.id)?.join(',') ?? ''}|${hrefs.join(' ')}`;
      let box = boxedMarkup.get(el);
      if (box?.key !== key) {
        box = {
          key,
          svg: svgBoxed(el, {
            ...art,
            resolveImageHref: opts.resolveImageHref,
            tabFont: tab.font,
            tabFinish: tab.finish,
            sketchBackdrop: backdrops.has(el.id),
            surface,
            chartPalette,
            chartGrounds,
          }),
        };
        boxedMarkup.set(el, box);
      }
      parts.push({ key: el.id, markup: box.svg });
    }
  }
  // Labels are laid out against the whole tab, as the canvas lays them out.
  const labels = elements.some((e) => e.type === 'arrow')
    ? (opts.labels ?? tabArrowLabels(tab))
    : undefined;
  for (const el of elements) {
    // Arrows resolve their endpoints against the WHOLE tab: an arrow is on the page where it is
    // anchored, and it still needs its ends' real positions to draw itself.
    if (el.type === 'arrow')
      parts.push({
        key: el.id,
        // Breaks only around the page's own boxes, the ones drawn here.
        markup: svgArrow(
          el,
          tab.elements,
          surface,
          tab.font,
          labels,
          `lvd-thumb-${pageId}-ko-`,
          elements,
          undefined,
          tab.finish,
        ),
      });
  }
  const pad = 8;
  const { x, y, width, height } = page.rect;
  return {
    markup: parts.map((p) => p.markup).join(''),
    parts,
    viewBox: `${r2(x - pad)} ${r2(y - pad)} ${r2(width + pad * 2)} ${r2(height + pad * 2)}`,
  };
}
