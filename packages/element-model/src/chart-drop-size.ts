// A chart dropped on a slide or an infographic page (docs/specs/009-elements/pie-chart.md "Behaviour"): sized for the
// page rather than at its small board default, so a chart dropped on a 1920 x 1080 slide is a slide's chart, not a
// 260 px chip with 9 px text. Pure; each product with pages hands in the page's content box.
import { isChartShape } from './data-shapes';
type ShapeKind = string;

// The share of the page's content box a dropped chart takes, across and down.
export const CHART_PAGE_SHARE = 0.6;
// Never taller than this share of its own width, so a chart on a portrait page keeps a chart's shape.
const CHART_PAGE_ASPECT = 0.75;

type Box = { x: number; y: number; width: number; height: number };

/**
 * A chart kind's box on a page of `pageKind` whose content box is `box`: 60% of it across, as much down but never
 * taller than three quarters of its width, centred on (`x`, `y`) and kept inside the box. Null for a kind that is not
 * a chart, or an article or flashcard page (a chart in writing takes its zone's size).
 */
export function chartDropInBox(
  kind: ShapeKind,
  pageKind: string | undefined,
  box: Box,
  x: number,
  y: number,
): Box | null {
  if (!isChartShape(kind)) return null;
  if (pageKind !== undefined && pageKind !== 'slide' && pageKind !== 'infographic') return null;
  const width = Math.round(box.width * CHART_PAGE_SHARE);
  const height = Math.round(Math.min(box.height * CHART_PAGE_SHARE, width * CHART_PAGE_ASPECT));
  const within = (at: number, size: number, lo: number, span: number) =>
    Math.round(Math.min(Math.max(at - size / 2, lo), lo + span - size));
  return {
    x: within(x, width, box.x, box.width),
    y: within(y, height, box.y, box.height),
    width,
    height,
  };
}
