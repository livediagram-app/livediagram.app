// Where text reads in a paged model (each product's docs/specs/004-interface-design/colour-picker.md "Reading on its
// ground"): one copy for livedesign and livedocuments, bound in each to its own layers, pages and page tones.
import type { CanvasSurface } from './colour-math';
import type { BoxedElement, Element } from './element';
import { textGroundIn, type TextGround } from './text-contrast';

type Rect = { x: number; y: number; width: number; height: number };

/** A page laid out on the canvas: its rectangle and its background. */
export interface PlacedPage<Bg> {
  rect: Rect;
  background?: Bg;
}

/** The model's own helpers a paged binding reads. */
export interface PagedModel<T, E extends Element, L, Pg, P extends PlacedPage<Bg>, Bg> {
  layerBands: (elements: E[], layers: L[] | undefined) => { elements: E[] }[];
  pagesOf: (tab: T) => Pg[];
  layOutPages: (pages: readonly Pg[]) => P[];
  rowPageAt: (row: readonly P[], point: { x: number; y: number }) => P | undefined;
  pageGroundUnder: (background: Bg | undefined, rect: Rect, box: Rect) => { tones: string[] };
}

/**
 * `textGroundOf(el, tab, surface)` for a paged model: what the element's label is read against is its own fill;
 * else the topmost element painted before it (hidden layers left out) whose box holds its centre and covers it;
 * else its page's background under it. Null where that can't be judged: a picture (a page's picture background, an
 * image or widget under it), or off every page.
 */
export function pagedTextGroundFor<
  T,
  E extends Element,
  L,
  Pg,
  P extends PlacedPage<Bg>,
  Bg extends { fill?: { kind: string } },
>(m: PagedModel<T, E, L, Pg, P, Bg>) {
  return (
    el: BoxedElement,
    tab: T & { elements: E[]; layers?: L[] },
    surface: CanvasSurface,
  ): TextGround | null => {
    const painted = m.layerBands(tab.elements, tab.layers).flatMap((b) => b.elements);
    return textGroundIn(el, painted, surface, (box) => {
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const page = m.rowPageAt(m.layOutPages(m.pagesOf(tab)), centre);
      if (!page || page.background?.fill?.kind === 'image') return null;
      return { tones: m.pageGroundUnder(page.background, page.rect, box).tones, on: 'page' };
    });
  };
}
