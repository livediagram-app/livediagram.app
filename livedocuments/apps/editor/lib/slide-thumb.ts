// One slide's picture (docs/specs/012-collaboration/presentation-mode.md, docs/specs/007-editor/
// pages-mode.md "Contents"): its elements drawn by the headless renderer the exports use,
// framed to the slide (a page slide to its page, on its background). Drawn for Contents' page
// thumbnails. The markup is
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
  type ArticleDrawOp,
  type CanvasSurface,
  type Slide,
  type Tab,
} from '@livedocuments/document';
import { pageRulingOf, pageWritingBars } from '@/lib/article/article-export';
import { articleOpsToSvg } from '@/lib/article/article-draw';
import { CANVAS_PAPER } from '@/lib/page-paint';
import { pageExportFrame } from '@/lib/export-page';
import { exportChartInk } from '@/lib/export-chart-ink';
import { thumbImageIds } from '@/lib/thumb-images';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';

// The picture whole (`markup`) and part by part (`parts`: the page, its writing, each element by id, in paint
// order), so Contents re-sets only the parts a change redrew (docs/specs/008-canvas/canvas-performance.md
// "Pictures of every page").
export type SlideThumb = {
  markup: string;
  viewBox: string;
  parts: readonly { key: string; markup: string }[];
};

// Each box's markup by its element, carried over from the last picture that drew it under the same `key` (everything
// svgBoxed reads beyond the element): a drop redraws the boxes it changed, not the page's thousand.
const boxedMarkup = new WeakMap<object, { key: string; svg: string }>();

export type SlideThumbOptions = {
  // Whether the icon catalogues have landed: until then icons draw as nothing.
  iconsLoaded: boolean;
  // The tab's arrow labels, laid out once for many slides of one tab; laid out here when absent.
  labels?: ReturnType<typeof arrowLabelPass>;
  // The canvas's surface: a page with no fill is drawn on the paper as the canvas shows it (slate
  // in dark mode, CANVAS_PAPER), its ink the canvas's. Light when absent.
  surface?: CanvasSurface;
  // A picture's URL by image id (thumb-images.ts's thumbImageHref): an image element and a page's
  // picture fill draw it, and without one (or before it arrives) the placeholder and the tone.
  resolveImageHref?: (imageId: string) => string | undefined;
  // An article page's writing as soft bars, read for many pages at once (writingBarsByPage); read here when absent.
  writingBars?: readonly ArticleDrawOp[];
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
  const elements = resolveSlide(slide, tab);
  // A page slide is its page: framed to it, painted on its background.
  const bounds = slideFrame(slide, tab);
  if (!bounds) return null;
  // Boxed first, then arrows, matching the canvas's own paint order so a connector never
  // disappears under the box it points at.
  const parts: { key: string; markup: string }[] = [];
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
      imageHref: opts.resolveImageHref,
      ruling: pageRulingOf(tab, page),
    });
    if (page.background?.fill) surface = frame.surface;
    parts.push({ key: 'page', markup: frame.backgroundSvg });
    // An article page's writing, as lines of text.
    const bars = opts.writingBars ?? pageWritingBars(page, undefined, tab);
    if (bars.length) parts.push({ key: 'writing', markup: articleOpsToSvg(bars) });
  }
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
    // Arrows resolve their endpoints against the WHOLE tab: an arrow is on the slide because
    // both its ends are, and it still needs their real positions to draw itself.
    if (el.type === 'arrow')
      parts.push({
        key: el.id,
        // Breaks only around the slide's own boxes, the ones drawn here.
        markup: svgArrow(
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
      });
  }
  const pad = 8;
  return {
    markup: parts.map((p) => p.markup).join(''),
    parts,
    viewBox: `${r2(bounds.x - pad)} ${r2(bounds.y - pad)} ${r2(bounds.w + pad * 2)} ${r2(
      bounds.h + pad * 2,
    )}`,
  };
}
