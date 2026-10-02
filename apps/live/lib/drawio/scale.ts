// The page scale (docs/specs/020-import-export/drawio-import.md "The page scale", blueprint steps
// 15.0 and 15.9): draw.io sets labels smaller and lighter than livediagram does, so the whole page
// grows until every label has the room draw.io gave it, in livediagram's own type. Positions,
// sizes, waypoints and label offsets scale; strokes, presets and font sizes do not.

import {
  LABEL_FONT_PX,
  PADDING_PX,
  isBoxed,
  type Element,
  type Endpoint,
} from '@livediagram/document';
import type { DrawioGraph } from './cells';
import { cellLabel } from './label';
import {
  DRAWIO_LINE_HEIGHT,
  HELVETICA_EM_ADVANCE,
  LABEL_EM_ADVANCE,
  LABEL_LINE_HEIGHT,
  elementTextSize,
} from './text-size';

/** The largest scale a page of tiny draw.io text gets (D40). Safe range: 1.3 to 2. */
export const DRAWIO_MAX_PAGE_SCALE = 1.6;
/** draw.io's default stylesheet font size. */
export const DRAWIO_DEFAULT_FONT_PX = 12;
/** draw.io's default vertex width, the reference box when a page has no labelled vertex (D42). */
export const DRAWIO_DEFAULT_BOX_PX = 120;
/** draw.io's default label `spacing`, on each side. */
export const DRAWIO_LABEL_SPACING = 2;

const commonest = (values: number[]): number => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0]!;
  for (const [v, n] of counts) {
    const bestN = counts.get(best)!;
    if (n > bestN || (n === bestN && v < best)) best = v;
  }
  return best;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** How much the page grows so its commonest label fits as draw.io fitted it (blueprint 15.0). */
export function pageScale(graph: DrawioGraph): number {
  const labelled = [...graph.cells.values()].filter(
    (c) => c.visible && (c.vertex || c.edge) && cellLabel(c).plain.trim() !== '',
  );
  if (labelled.length === 0) return 1;
  const px = commonest(labelled.map((c) => c.style.num('fontSize') ?? DRAWIO_DEFAULT_FONT_PX));
  const widths = labelled.filter((c) => c.vertex && c.geometry).map((c) => c.geometry!.width);
  const w = widths.length > 0 ? median(widths) : DRAWIO_DEFAULT_BOX_PX;
  const target = LABEL_FONT_PX[elementTextSize(px, 'label')];
  const rw = (target * LABEL_EM_ADVANCE) / (px * HELVETICA_EM_ADVANCE);
  const rh = (target * LABEL_LINE_HEIGHT) / (px * DRAWIO_LINE_HEIGHT);
  const rp = w > 0 ? (rw * (w - 2 * DRAWIO_LABEL_SPACING) + 2 * PADDING_PX.sm) / w : rw;
  return Math.min(DRAWIO_MAX_PAGE_SCALE, Math.max(1, rw, rh, rp));
}

const scaleEnd = (end: Endpoint, k: number): Endpoint =>
  end.kind === 'free' ? { ...end, x: end.x * k, y: end.y * k } : end;

/** Every element grown by `k` about the page origin (blueprint 15.9); the same array at 1. */
export function scalePage(elements: Element[], k: number): Element[] {
  if (k === 1) return elements;
  return elements.map((el): Element => {
    if (el.type === 'arrow') {
      return {
        ...el,
        from: scaleEnd(el.from, k),
        to: scaleEnd(el.to, k),
        ...(el.curvePoints
          ? { curvePoints: el.curvePoints.map((p) => ({ dx: p.dx * k, dy: p.dy * k })) }
          : {}),
        ...(el.curveOffset
          ? { curveOffset: { dx: el.curveOffset.dx * k, dy: el.curveOffset.dy * k } }
          : {}),
        ...(el.labelOffset
          ? { labelOffset: { ...el.labelOffset, offset: el.labelOffset.offset * k } }
          : {}),
      };
    }
    if (!isBoxed(el)) return el;
    const grown = { ...el, x: el.x * k, y: el.y * k, width: el.width * k, height: el.height * k };
    if ('headerSize' in grown && typeof grown.headerSize === 'number') grown.headerSize *= k;
    if (grown.type === 'table') {
      if (grown.rowHeights)
        grown.rowHeights = grown.rowHeights.map((h) => (h === null ? h : h * k));
      if (grown.colWidths) grown.colWidths = grown.colWidths.map((w) => (w === null ? w : w * k));
    }
    return grown as Element;
  });
}
