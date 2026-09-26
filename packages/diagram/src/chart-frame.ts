// A chart's layout (docs/specs/009-elements/pie-chart.md): the box, the data, the colour accessor, and
// where the plot and the legend sit inside it.
//
// In the diagram package because BOTH renderers need it. The canvas laid its
// charts out from here while the exporter drew nothing at all, so a pie chart
// came out of an export as an empty box with its kind name in it. Sharing the
// layout is what lets the two draw the same chart rather than two charts that
// happen to agree.

import { chartPaletteColors } from './chart-palettes';
import { PIE_DEFAULT_SLICES, PIE_PALETTE, type PieSlice } from './data-shapes';
import type { ShapeElement } from './index';

export type ChartRect = { x: number; y: number; w: number; h: number };
export type ChartLegendRect = ChartRect & {
  show: boolean;
  pos: 'top' | 'right' | 'bottom' | 'left';
};

export function chartFrame(element: ShapeElement, palette?: readonly string[]) {
  // Three rungs, narrowest first (docs/specs/009-elements/pie-chart.md): the chart's own palette if it has
  // been given one, then the tab theme's, then the built-in ramp. A per-datum
  // colour beats all three, in `colorAt` below.
  const chosen = chartPaletteColors(element.chartPalette);
  const colors = chosen ?? (palette && palette.length > 0 ? palette : PIE_PALETTE);
  const w = Math.max(1, element.width);
  const h = Math.max(1, element.height);
  const data: readonly PieSlice[] =
    element.pieSlices && element.pieSlices.length > 0 ? element.pieSlices : PIE_DEFAULT_SLICES;
  const showLegend = element.chartLegend !== false;
  const colorAt = (i: number, d: { color?: string }) => d.color ?? colors[i % colors.length]!;
  // Legend placement (docs/specs/009-elements/pie-chart.md). A left/right legend takes a vertical strip; a
  // top/bottom legend a horizontal band. `area` is the rect left for the chart
  // body (each renderer draws inside it); `legend` is the strip the key goes
  // into.
  //
  // BELOW by default: a side legend spends up to 130px of a 280px-wide chart on
  // series names, which squeezes the plot into a third of the card, and it is
  // the plot people are reading. A bottom band costs height, which these charts
  // have more of to give.
  const pos = element.chartLegendPosition ?? 'bottom';
  const vertical = pos === 'left' || pos === 'right';
  const legendW = showLegend && vertical ? Math.max(0, Math.min(w * 0.4, 130)) : 0;
  const legendH = showLegend && !vertical ? Math.max(0, Math.min(h * 0.32, 72)) : 0;
  const area: ChartRect = {
    x: pos === 'left' ? legendW : 0,
    y: pos === 'top' ? legendH : 0,
    w: w - legendW,
    h: h - legendH,
  };
  const legend: ChartLegendRect = {
    show: showLegend,
    pos,
    x: pos === 'right' ? w - legendW : 0,
    y: pos === 'bottom' ? h - legendH : 0,
    w: vertical ? legendW : w,
    h: vertical ? h : legendH,
  };
  return { w, h, data, showLegend, colorAt, area, legend };
}
