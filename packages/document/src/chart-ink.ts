// A chart's ink on a page (docs/specs/007-editor/pages-mode.md "Re-inking", "Charts adapt
// as they are drawn"): a chart's series take their colours from a palette (the tab theme's, the
// chart's own, a slice's own), not from fields re-inking writes, so a page's fill can leave a
// series unreadable (Boardroom's dark slate line on a dark page). Each colour is instead adapted
// as the chart is drawn, against what the chart sits on: under 3:1 it is lightened or darkened,
// keeping its hue, by the least that reaches 3:1; the chart's own small text (axis labels, the
// key) is held to 4.5:1. Never stored. The canvas and every export draw through these, so the two
// match. Pure.
import { canvasSurface, type CanvasSurface } from './colors';
import { elementIndexFor } from './geometry';
import { pageAt, type LaidOutPage } from './page';
import { elementAnchorPoint, pageFillTone } from './page-content';
import { isChartShape } from './data-shapes';
import { isSankeyShape } from './sankey-model';
import { layerBands } from './layers';
import { inkToward } from './page-ink-contrast';
import { pageGroundUnder } from './page-ink-ground';
import {
  boxFill,
  inkKindOf,
  keptCover,
  PAGE_INK_CONTRAST,
  PAGE_INK_TARGET,
  PAGE_LINE_CONTRAST,
} from './page-ink-rules';
import { isBoxed, type Element } from './index';
import type { Layer } from './layers';
import { pointInRect, type Rect } from './geometry-primitives';

// A series (a line, a bar, a wedge, a Sankey node) against its ground: WCAG 2.2 SC 1.4.11
// non-text contrast, floor and target both, as re-inking holds lines and marks.
export const CHART_MARK_CONTRAST = PAGE_LINE_CONTRAST;
// A chart's own text (9px axis labels, the key, a Sankey's node names): moved under WCAG 2.2
// SC 1.4.3 AA, to AAA, as re-inking moves a page's text.
export const CHART_TEXT_CONTRAST = PAGE_INK_CONTRAST;
export const CHART_TEXT_TARGET = PAGE_INK_TARGET;
// How many adapted colours are remembered across draws (a hover re-draws a chart every move).
// A board's charts use a few dozen colours on a few grounds; past this the memory starts over.
// Safe range 64 to 4096: smaller recomputes on busy boards, larger only holds more strings.
const CHART_INK_MEMORY = 512;

const memory = new Map<string, string>();

function adapted(
  color: string,
  tones: readonly string[],
  floor: number,
  target: number = floor,
): string {
  const key = `${floor}|${target}|${color}|${tones.join(',')}`;
  const hit = memory.get(key);
  if (hit !== undefined) return hit;
  const out = inkToward(color, tones, floor, target);
  if (memory.size >= CHART_INK_MEMORY) memory.clear();
  memory.set(key, out);
  return out;
}

/** A series colour as drawn on `ground` (the tones the chart sits on): unchanged with no ground or
 *  while it reaches 3:1 against every tone; else the least change, keeping its hue, that does. */
export function chartMarkInk(color: string, ground: readonly string[] | undefined): string {
  return ground && ground.length > 0 ? adapted(color, ground, CHART_MARK_CONTRAST) : color;
}

/** A chart's own text colour as drawn on `ground`: kept at 4.5:1 or over, else taken to 7:1. */
export function chartTextInk(color: string, ground: readonly string[] | undefined): string {
  return ground && ground.length > 0
    ? adapted(color, ground, CHART_TEXT_CONTRAST, CHART_TEXT_TARGET)
    : color;
}

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
export function chartPageGrounds(
  elements: readonly Element[],
  pages: readonly LaidOutPage[],
  layers?: Layer[],
): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  if (!pages.some((p) => p.background?.fill) || !elements.some(isPaletteChart)) return out;
  const index = elementIndexFor(elements);
  // Each element's page, once; only pages with a fill and a chart on them are walked.
  const pageOf = new Map<string, LaidOutPage>();
  const walked = new Set<LaidOutPage>();
  for (const el of elements) {
    const page = pageAt(pages, elementAnchorPoint(el, index));
    if (!page?.background?.fill) continue;
    pageOf.set(el.id, page);
    if (isPaletteChart(el)) walked.add(page);
  }
  const painted = layerBands(elements as Element[], layers, { includeHidden: true }).flatMap(
    (b) => b.elements,
  );
  for (const page of walked) {
    const surface: CanvasSurface = canvasSurface(pageFillTone(page.background!.fill!));
    const covers: Cover[] = [];
    for (const el of painted) {
      if (pageOf.get(el.id) !== page || !isBoxed(el)) continue;
      const box = { x: el.x, y: el.y, width: el.width, height: el.height };
      if (isPaletteChart(el)) {
        const at = elementAnchorPoint(el, index);
        let ground: readonly string[] | null | undefined;
        for (let i = covers.length - 1; i >= 0 && ground === undefined; i -= 1) {
          if (pointInRect(covers[i]!.box, at)) ground = covers[i]!.tone ? [covers[i]!.tone!] : null;
        }
        if (ground === undefined) ground = pageGroundUnder(page.background, page.rect, box).tones;
        if (ground) out.set(el.id, ground);
        continue;
      }
      const kind = inkKindOf(el);
      if (kind === 'keep') {
        const tone = keptCover(el, surface);
        if (tone !== undefined) covers.push({ box, tone });
      } else if (kind === 'box' || (kind === 'table' && el.fillColor)) {
        const tone = boxFill(el, surface);
        if (tone) covers.push({ box, tone });
      }
    }
  }
  return out;
}
