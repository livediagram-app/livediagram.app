// What each chart on a page sits on (docs/specs/007-editor/pages-mode.md "Re-inking"): the ground chartMarkInk
// adapts a chart's palette to. One copy for every product with pages; each binds chartPageGroundsFor to its own page
// model (where a page is, an element's anchor, a fill's tone, its layer bands) at its chart-ink.ts.
import { pointInRect, type Point, type Rect } from '@liveworkspace/model-core/geometry-primitives';
import { canvasSurface, type CanvasSurface } from './colour-math';
import { isChartShape } from './data-shapes';
import type { BoxedElement, Element } from './element';
import { elementIndexFor, type ElementIndex } from './geometry';
import type { PageGround } from './page-ink-ground';
import { boxFill, inkKindOf, keptCover } from './page-ink-rules';
import { isSankeyShape } from './sankey-model';

/** A laid-out page as the ground reads it: its fill and where it is. */
type GroundPage<F> = { background?: { fill?: F }; rect: Rect };

export type ChartPageGroundDeps<E extends Element, F, P extends GroundPage<F>, L> = {
  isBoxed: (el: E) => boolean;
  pageAt: (pages: readonly P[], point: Point) => P | undefined;
  elementAnchorPoint: (el: E, index: ElementIndex<E>) => Point;
  pageFillTone: (fill: F) => string;
  layerBands: (
    elements: E[],
    layers: L[] | undefined,
    opts: { includeHidden: boolean },
  ) => { elements: E[] }[];
  pageGroundUnder: (background: P['background'], rect: Rect, box: Rect) => PageGround;
};

/** Whether an element is a chart whose series come from a palette: a pie, doughnut, bar, column,
 *  line, area, scatter or Sankey. */
function isPaletteChart(el: Element): boolean {
  return el.type === 'shape' && (isChartShape(el.shape) || isSankeyShape(el.shape));
}

// A surface under later elements: its box and tone, or null for a surface of unknown tone.
type Cover = { box: Rect; tone: string | null };

/**
 * What each chart on a page with a fill of its own sits on, by element id: the tones re-inking
 * would measure it against (the topmost card under its centre, as drawn, else the page under its
 * box: a gradient's every tone across it). A chart on the plain paper, on no page, or over a
 * surface of unknown tone (a picture, a widget, a Sheet) is absent and drawn as it is.
 */
export function chartPageGroundsFor<E extends Element, F, P extends GroundPage<F>, L>(
  deps: ChartPageGroundDeps<E, F, P, L>,
): (elements: readonly E[], pages: readonly P[], layers?: L[]) => Map<string, readonly string[]> {
  const { isBoxed, pageAt, elementAnchorPoint, pageFillTone, layerBands, pageGroundUnder } = deps;
  return (elements, pages, layers) => {
    const out = new Map<string, readonly string[]>();
    if (!pages.some((p) => p.background?.fill) || !elements.some(isPaletteChart)) return out;
    const index = elementIndexFor(elements);
    // Each element's page, once; only pages with a fill and a chart on them are walked.
    const pageOf = new Map<string, P>();
    const walked = new Set<P>();
    for (const el of elements) {
      const page = pageAt(pages, elementAnchorPoint(el, index));
      if (!page?.background?.fill) continue;
      pageOf.set(el.id, page);
      if (isPaletteChart(el)) walked.add(page);
    }
    const painted = layerBands(elements as E[], layers, { includeHidden: true }).flatMap(
      (b) => b.elements,
    );
    for (const page of walked) {
      const surface: CanvasSurface = canvasSurface(pageFillTone(page.background!.fill!));
      const covers: Cover[] = [];
      for (const el of painted) {
        if (pageOf.get(el.id) !== page || !isBoxed(el)) continue;
        const boxed = el as unknown as BoxedElement;
        const box = { x: boxed.x, y: boxed.y, width: boxed.width, height: boxed.height };
        if (isPaletteChart(el)) {
          const at = elementAnchorPoint(el, index);
          let ground: readonly string[] | null | undefined;
          for (let i = covers.length - 1; i >= 0 && ground === undefined; i -= 1) {
            if (pointInRect(covers[i]!.box, at))
              ground = covers[i]!.tone ? [covers[i]!.tone!] : null;
          }
          if (ground === undefined) ground = pageGroundUnder(page.background, page.rect, box).tones;
          if (ground) out.set(el.id, ground);
          continue;
        }
        const kind = inkKindOf(el);
        if (kind === 'keep') {
          const tone = keptCover(el, surface);
          if (tone !== undefined) covers.push({ box, tone });
        } else if (kind === 'box' || (kind === 'table' && boxed.fillColor)) {
          const tone = boxFill(boxed, surface);
          if (tone) covers.push({ box, tone });
        }
      }
    }
    return out;
  };
}
