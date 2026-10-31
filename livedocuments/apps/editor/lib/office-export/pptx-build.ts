// A slide tab built into a deck (docs/specs/020-import-export/blueprints/office-export.md "buildDeck"): a slide a
// page, in order, each page's elements in the canvas's paint order as native shapes where they map and pictures
// where they do not, its background, and its slide's notes and hidden flag from the Slide Deck. The pictures come
// from an injected drawer, so everything here but the drawing runs in Node.

import {
  arrowLabelFontStack,
  arrowLabelPass,
  arrowRoutePoints,
  drawnBounds,
  layerBands,
  layerOpacityOf,
  pageDimensions,
  pageExportFrame,
  supportsShadow,
  type ArrowLabelPass,
  type Deck,
  type Element,
  type LaidOutPage,
  type PageRect,
  type Tab,
} from '@livedocuments/document';
import { ooxmlColour, NO_PAINT } from './ooxml-colour';
import { emuBox, nativeSlideItem, type SlidePlacement } from './pptx-native';
import type { PptxBackground, PptxDeck, PptxItem, PptxSlide } from './pptx-types';
import { throwIfCancelled, yieldToBrowser, type ExportProgress } from './progress';
import { slideOfPage } from './summary';

/** Draws what a native shape cannot: a picture of some of a page's elements, or of its background alone. */
export type PageDrawer = {
  /** A PNG of the elements as the page shows them, covering exactly `rect` (canvas px); null when nothing drew. */
  region(page: LaidOutPage, ids: ReadonlySet<string>, rect: PageRect): Promise<Uint8Array | null>;
  /** A PNG of the page's background (fill, picture, pattern) with nothing on it. */
  background(page: LaidOutPage): Promise<Uint8Array | null>;
};

/** EMU per page px: a 1920 px slide is PowerPoint's 13.33 in widescreen, a 1440 px one its 10 in standard. */
export const SLIDE_EMU_PER_PX = 6350;

// What a picture keeps around its element's box, px: a stroke's overhang and an arrowhead past the route's end.
const PICTURE_PAD = 4;
const ARROW_PAD = 16;

export type DeckInput = {
  tab: Tab;
  pages: readonly LaidOutPage[];
  deck?: Deck;
  title: string;
};

/** The deck's slide size: the first page's, at SLIDE_EMU_PER_PX. */
export function deckSize(pages: readonly LaidOutPage[]): { cx: number; cy: number } {
  const first = pages[0];
  const { width, height } = first ? pageDimensions(first) : { width: 1920, height: 1080 };
  return { cx: Math.round(width * SLIDE_EMU_PER_PX), cy: Math.round(height * SLIDE_EMU_PER_PX) };
}

/** Where a page lands on a slide of the deck's size: fitted inside, centred, never cropped. */
export function placementFor(page: LaidOutPage, cx: number, cy: number): SlidePlacement {
  const r = page.rect;
  const emuPerPx = Math.min(cx / r.width, cy / r.height);
  return {
    emuPerPx,
    ox: (cx - r.width * emuPerPx) / 2 - r.x * emuPerPx,
    oy: (cy - r.height * emuPerPx) / 2 - r.y * emuPerPx,
  };
}

/** A plain or solid page is a background colour (none for plain); anything else is drawn as a picture. */
export function backgroundKind(page: LaidOutPage): 'none' | 'solid' | 'picture' {
  const { fill, pattern } = page.background ?? {};
  if (pattern) return 'picture';
  if (!fill) return 'none';
  return fill.kind === 'solid' && ooxmlColour(fill.color) !== null ? 'solid' : 'picture';
}

/** The box a picture of the element covers, before the page's edge cuts it. */
export function pictureRect(el: Element, elements: Element[], labels: ArrowLabelPass): PageRect {
  if (el.type === 'arrow') {
    const pts = [...arrowRoutePoints(el, elements)];
    const l = labels.layouts.get(el.id);
    if (l) {
      pts.push(
        { x: l.center.x - l.width / 2, y: l.center.y - l.height / 2 },
        { x: l.center.x + l.width / 2, y: l.center.y + l.height / 2 },
      );
    }
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x = Math.min(...xs) - ARROW_PAD;
    const y = Math.min(...ys) - ARROW_PAD;
    return {
      x,
      y,
      width: Math.max(...xs) + ARROW_PAD - x,
      height: Math.max(...ys) + ARROW_PAD - y,
    };
  }
  const b = drawnBounds(el);
  const s = supportsShadow(el) && el.shadow ? el.shadow : undefined;
  const pad = PICTURE_PAD + (s ? Math.max(Math.abs(s.offsetX), Math.abs(s.offsetY)) + s.blur : 0);
  return { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 };
}

/** `a` cut to `b`, whole px outward; null when nothing is left. */
export function cutTo(a: PageRect, b: PageRect): PageRect | null {
  const x = Math.floor(Math.max(a.x, b.x));
  const y = Math.floor(Math.max(a.y, b.y));
  const right = Math.ceil(Math.min(a.x + a.width, b.x + b.width));
  const bottom = Math.ceil(Math.min(a.y + a.height, b.y + b.height));
  return right - x >= 1 && bottom - y >= 1 ? { x, y, width: right - x, height: bottom - y } : null;
}

/** The elements on the page, in paint order (layer bands bottom to top), each with its layer's opacity. */
function pageElements(tab: Tab, page: LaidOutPage): { el: Element; alpha: number }[] {
  const frame = pageExportFrame(page);
  return layerBands(tab.elements, tab.layers).flatMap((band) =>
    band.elements
      .filter((el) => el.type !== 'article-note' && frame.reaches(el, tab.elements))
      .map((el) => ({ el, alpha: layerOpacityOf(band.layer) })),
  );
}

async function slideOf(
  input: DeckInput,
  page: LaidOutPage,
  size: { cx: number; cy: number },
  labels: ArrowLabelPass,
  drawer: PageDrawer,
  progress: ExportProgress,
): Promise<PptxSlide> {
  const { tab } = input;
  const place = placementFor(page, size.cx, size.cy);
  const surface = pageExportFrame(page).surface;
  const items: PptxItem[] = [];
  for (const { el, alpha } of pageElements(tab, page)) {
    throwIfCancelled(progress.signal);
    const name = `${el.type === 'text' ? 'Text' : el.type === 'shape' ? 'Shape' : 'Picture'} ${items.length + 1}`;
    const native =
      el.type === 'arrow'
        ? null
        : nativeSlideItem(
            el,
            {
              place,
              surface,
              tabFont: tab.font,
              tabFinish: tab.finish,
              layerOpacity: alpha,
            },
            name,
          );
    if (native === 'empty') continue;
    if (native) {
      items.push(native);
      continue;
    }
    const rect = cutTo(pictureRect(el, tab.elements, labels), page.rect);
    if (!rect) continue;
    const png = await drawer.region(page, new Set([el.id]), rect);
    if (png)
      items.push({
        kind: 'picture',
        name: `Picture ${items.length + 1}`,
        box: emuBox(place, rect),
        png,
      });
  }
  let background: PptxBackground | null = null;
  const kind = backgroundKind(page);
  const fill = page.background?.fill;
  if (kind === 'solid' && fill?.kind === 'solid') {
    const c = ooxmlColour(fill.color);
    if (c && c !== NO_PAINT) background = { kind: 'solid', colour: c };
  } else if (kind === 'picture') {
    const png = await drawer.background(page);
    if (png) background = { kind: 'picture', png };
  }
  const slide = slideOfPage(input.deck, tab.id, page.id);
  const notes = slide?.notes?.trim();
  return {
    background,
    items,
    ...(notes ? { notes } : {}),
    ...(slide?.hidden ? { hidden: true } : {}),
  };
}

/** The tab's pages as a deck: a slide each, reporting each slide done. */
export async function buildDeck(
  input: DeckInput,
  drawer: PageDrawer,
  progress: ExportProgress,
): Promise<PptxDeck> {
  const size = deckSize(input.pages);
  // Every arrow's caption laid out once for the whole export, as the renderer lays them out.
  const labels = arrowLabelPass(input.tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, input.tab.font, input.tab.finish),
  });
  const slides: PptxSlide[] = [];
  for (const page of input.pages) {
    throwIfCancelled(progress.signal);
    slides.push(await slideOf(input, page, size, labels, drawer, progress));
    progress.onProgress?.(slides.length / input.pages.length);
    await yieldToBrowser();
  }
  return { title: input.title, ...size, slides };
}
