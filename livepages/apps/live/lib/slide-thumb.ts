// One slide's picture (docs/specs/012-collaboration/presentation-mode.md, docs/specs/007-editor/
// pages-mode.md "Contents"): its elements drawn by the headless renderer the exports use,
// framed to the slide (a page slide to its page, on its background). Shared by the Slide Deck's
// rows and the Contents popover's page thumbnails, so a page looks the same in both. The markup is
// our own renderer's output (user text is xmlEscaped inside it), so injecting it is safe.
import {
  r2,
  resolveSlide,
  slideFrame,
  pagesOf,
  layOutPages,
  arrowLabelFontStack,
  arrowLabelPass,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  type CanvasSurface,
  type Slide,
  type Tab,
  tabWireframeFrameTheme,
} from '@livepages/document';
import type { Item, ItemTypeDef } from '@livepages/items';
import { pageRulingOf, pageWritingBars } from '@/lib/article/article-export';
import { articleOpsToSvg } from '@/lib/article/article-draw';
import { CANVAS_PAPER } from '@/lib/page-paint';
import { pageExportFrame } from '@/lib/export-page';
import { exportChartInk } from '@/lib/export-chart-ink';
import { resolveIconArtLoaded, resolveStickerArtLoaded } from '@/lib/icon-registry';

export type SlideThumb = { markup: string; viewBox: string };

export type SlideThumbOptions = {
  // Whether the icon catalogues have landed: until then icons draw as nothing.
  iconsLoaded: boolean;
  items?: ReadonlyMap<string, Item>;
  itemTypes?: readonly ItemTypeDef[];
  // The tab's arrow labels, laid out once for many slides of one tab; laid out here when absent.
  labels?: ReturnType<typeof arrowLabelPass>;
  // The canvas's surface: a page with no fill is drawn on the paper as the canvas shows it (slate
  // in dark mode, CANVAS_PAPER), its ink the canvas's. Light when absent.
  surface?: CanvasSurface;
};

/** The tab's arrow labels as the canvas lays them out, for slideThumbFor's `labels`. */
export function tabArrowLabels(tab: Tab): ReturnType<typeof arrowLabelPass> {
  return arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
}

/** A slide's picture, or null when it has nothing to frame. */
export function slideThumbFor(slide: Slide, tab: Tab, opts: SlideThumbOptions): SlideThumb | null {
  const art = opts.iconsLoaded
    ? { resolveIconArt: resolveIconArtLoaded, resolveStickerArt: resolveStickerArtLoaded }
    : {};
  const { items, itemTypes } = opts;
  const elements = resolveSlide(slide, tab);
  // A page slide is its page: framed to it, painted on its background.
  const bounds = slideFrame(slide, tab);
  if (!bounds) return null;
  // Boxed first, then arrows, matching the canvas's own paint order so a connector never
  // disappears under the box it points at.
  const parts: string[] = [];
  const page = slide.pageId
    ? layOutPages(pagesOf(tab)).find((p) => p.id === slide.pageId)
    : undefined;
  // A page's surface sets its ink, as the canvas draws it: light ink on a dark page, and a page with
  // no fill on the canvas's own paper in the canvas's ink.
  const canvasSurface = opts.surface ?? 'light';
  let surface: CanvasSurface = canvasSurface;
  if (page) {
    const frame = pageExportFrame(page, {
      paper: CANVAS_PAPER[canvasSurface === 'dark' ? 'dark' : 'light'],
      idPrefix: `lvd-slide-${slide.id}`,
      ruling: pageRulingOf(tab, page),
      frameTheme: tabWireframeFrameTheme(tab),
    });
    if (page.background?.fill) surface = frame.surface;
    parts.push(frame.backgroundSvg);
    // An article page's writing, as lines of text.
    const bars = pageWritingBars(page);
    if (bars.length) parts.push(articleOpsToSvg(bars));
  }
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(elements, tab.finish);
  // Charts in the tab theme's colours and, on a filled page, adapted to what they sit on, as on the
  // canvas and in the exports (without the palette every chart fell back to the built-in ramp).
  const { chartPalette, chartGrounds } = exportChartInk(tab, page);
  for (const el of elements) {
    if (el.type !== 'arrow') {
      parts.push(
        svgBoxed(el, {
          ...art,
          tabFont: tab.font,
          tabFinish: tab.finish,
          sketchBackdrop: backdrops.has(el.id),
          surface,
          chartPalette,
          chartGrounds,
          ...(items ? { items } : {}),
          ...(itemTypes ? { itemTypes } : {}),
        }),
      );
    }
  }
  // Labels are laid out against the whole tab, as the canvas lays them out.
  const labels = elements.some((e) => e.type === 'arrow')
    ? (opts.labels ?? tabArrowLabels(tab))
    : undefined;
  for (const el of elements) {
    // Arrows resolve their endpoints against the WHOLE tab: an arrow is on the slide because
    // both its ends are, and it still needs their real positions to draw itself.
    if (el.type === 'arrow')
      parts.push(
        // Breaks only around the slide's own boxes, the ones drawn here.
        svgArrow(
          el,
          tab.elements,
          surface,
          tab.font,
          labels,
          `lvd-slide-${slide.id}-ko-`,
          elements,
          undefined,
          tab.finish,
        ),
      );
  }
  const pad = 8;
  return {
    markup: parts.join(''),
    viewBox: `${r2(bounds.x - pad)} ${r2(bounds.y - pad)} ${r2(bounds.w + pad * 2)} ${r2(
      bounds.h + pad * 2,
    )}`,
  };
}
