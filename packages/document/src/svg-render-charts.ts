// Chart elements in the headless render (docs/specs/009-elements/pie-chart.md): every chart type, plus the key
// they share. The marks come from `chart-marks`, which the canvas views draw from too.
//
// These drew NOTHING before this: the exporter had no branch for them, so a
// chart fell through to the generic box and came out of an export as an empty
// rectangle with its kind name in it. For an element whose entire content is
// its data, that is not a degraded render, it is a blank.
//
// The layout comes from the same `chartFrame` the canvas lays out with, so the
// plot and the legend land in the same rects; only the drawing primitives
// differ. Hover, readouts and the looping animations are the canvas's alone
// and have no meaning in a still image.

import { chartFrame, type ChartLegendRect } from './chart-frame';
import { chartTextInk } from './chart-ink';
import { AREA_FILL_OPACITY, barMarks, lineMarks, pieMarks } from './chart-marks';
import { chartTypeOf, lineVariantOf } from './chart-types';
import { LINE_DEFAULT_CATEGORIES, LINE_DEFAULT_SERIES, type PieSlice } from './data-shapes';
import type { BoxedElement, ShapeElement } from './index';
import { legendFontPx } from './label-font';
import { r2, xmlEscape } from './svg-render-primitives';

type Chart = BoxedElement & { type: 'shape' };

const AXIS = '#cbd5e1';
const AXIS_FAINT = '#e2e8f0';

// The key: a swatch and a name per series, laid out in the strip chartFrame
// left for it. Mirrors ChartLegend's own gates, so a legend too small to read
// is omitted here exactly as it is on the canvas.
function svgChartLegend(
  el: Chart,
  items: readonly PieSlice[],
  colorAt: (i: number, d: { color?: string }) => string,
  legend: ChartLegendRect,
  textColor: string,
  fontFamily?: string,
): string {
  const vertical = legend.pos === 'left' || legend.pos === 'right';
  if (!legend.show || (vertical ? legend.w < 48 : legend.h < 18)) return '';
  const font = fontFamily ? ` font-family="${xmlEscape(fontFamily)}"` : '';
  // Text Size (docs/specs/009-elements/pie-chart.md), on the canvas's scale; the swatch and row pitch keep
  // their proportion to it, as ChartLegend's do.
  const fontPx = legendFontPx(el.textSize);
  const swatch = Math.round(fontPx * 0.8);
  const rowH = Math.round(fontPx * 1.3);
  const parts: string[] = [];
  if (vertical) {
    // A column, centred in the strip.
    const top = el.y + legend.y + legend.h / 2 - (items.length * rowH) / 2;
    items.forEach((item, i) => {
      const y = top + i * rowH + rowH / 2;
      const x = el.x + legend.x + 6;
      parts.push(
        `<rect x="${r2(x)}" y="${r2(y - swatch / 2)}" width="${swatch}" height="${swatch}" rx="2" fill="${xmlEscape(colorAt(i, item))}"/>`,
        `<text x="${r2(x + swatch + 4)}" y="${r2(y)}"${font} font-size="${fontPx}" fill="${xmlEscape(textColor)}" dominant-baseline="central">${xmlEscape(item.label || '—')}</text>`,
      );
    });
    return parts.join('');
  }
  // A row, wrapped and centred: measured the way the wrapped-label emitter
  // measures, off the character count, since there is no DOM to ask.
  const itemW = (item: PieSlice) =>
    swatch + 4 + Math.max(8, (item.label || '—').length * fontPx * 0.51) + 10;
  const rows: PieSlice[][] = [[]];
  let used = 0;
  for (const item of items) {
    const width = itemW(item);
    if (used + width > legend.w - 4 && rows[rows.length - 1]!.length > 0) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1]!.push(item);
    used += width;
  }
  const top = el.y + legend.y + legend.h / 2 - (rows.length * rowH) / 2;
  let index = 0;
  rows.forEach((row, ri) => {
    const rowW = row.reduce((sum, item) => sum + itemW(item), 0);
    let x = el.x + legend.x + legend.w / 2 - rowW / 2;
    const y = top + ri * rowH + rowH / 2;
    for (const item of row) {
      parts.push(
        `<rect x="${r2(x)}" y="${r2(y - swatch / 2)}" width="${swatch}" height="${swatch}" rx="2" fill="${xmlEscape(colorAt(index, item))}"/>`,
        `<text x="${r2(x + swatch + 4)}" y="${r2(y)}"${font} font-size="${fontPx}" fill="${xmlEscape(textColor)}" dominant-baseline="central">${xmlEscape(item.label || '—')}</text>`,
      );
      x += itemW(item);
      index += 1;
    }
  });
  return parts.join('');
}

/** A pie chart (or doughnut): wedges clockwise from twelve o'clock, plus the key. */
export function svgPieChart(
  el: Chart,
  labelColor: string,
  palette?: readonly string[],
  fontFamily?: string,
  // What the chart sits on (chartPageGrounds): its series and text drawn adapted to it.
  ground?: readonly string[],
): string {
  const textColor = chartTextInk(labelColor, ground);
  const { data, colorAt, area, legend } = chartFrame(el as ShapeElement, palette, ground);
  const doughnut = chartTypeOf(el) === 'doughnut';
  const { cx, cy, rad, wedges } = pieMarks(area, data, doughnut, el.x, el.y);
  const marks = wedges
    .map((wedge, i) => {
      const fill = xmlEscape(colorAt(i, data[i]!));
      if (wedge.full && !doughnut)
        return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rad)}" fill="${fill}"/>`;
      if (!wedge.d) return '';
      return `<path d="${wedge.d}"${doughnut ? ' fill-rule="evenodd"' : ''} fill="${fill}"/>`;
    })
    .join('');
  return marks + svgChartLegend(el, data, colorAt, legend, textColor, fontFamily);
}

/** A column chart (or, horizontal, a bar chart): a baseline and one bar per value, plus the key. */
export function svgBarChart(
  el: Chart,
  labelColor: string,
  palette?: readonly string[],
  fontFamily?: string,
  // What the chart sits on (chartPageGrounds): its series and text drawn adapted to it.
  ground?: readonly string[],
): string {
  const textColor = chartTextInk(labelColor, ground);
  const { data, colorAt, area, legend } = chartFrame(el as ShapeElement, palette, ground);
  const { baseline: b, bars } = barMarks(area, data, chartTypeOf(el) === 'bar', el.x, el.y);
  const baseline = `<path d="M ${r2(b.x1)} ${r2(b.y1)} L ${r2(b.x2)} ${r2(b.y2)}" stroke="${AXIS}" stroke-width="1"/>`;
  const rects = bars
    .map(
      (bar, i) =>
        `<rect x="${r2(bar.x)}" y="${r2(bar.y)}" width="${r2(bar.w)}" height="${r2(bar.h)}" rx="${r2(bar.rx)}" fill="${xmlEscape(colorAt(i, data[i]!))}"/>`,
    )
    .join('');
  return baseline + rects + svgChartLegend(el, data, colorAt, legend, textColor, fontFamily);
}

/** A line, area or scatter chart: axes, its marks per series, the x labels, the key. */
export function svgLineChart(
  el: Chart,
  labelColor: string,
  palette?: readonly string[],
  fontFamily?: string,
  // What the chart sits on (chartPageGrounds): its series and text drawn adapted to it.
  ground?: readonly string[],
): string {
  const textColor = chartTextInk(labelColor, ground);
  const { colorAt, area, legend } = chartFrame(el as ShapeElement, palette, ground);
  const categories =
    el.lineCategories && el.lineCategories.length > 0 ? el.lineCategories : LINE_DEFAULT_CATEGORIES;
  const series = el.lineSeries && el.lineSeries.length > 0 ? el.lineSeries : LINE_DEFAULT_SERIES;
  const m = lineMarks(area, categories, series, lineVariantOf(el), el.x, el.y);
  const { x, y, w, h } = m.plot;
  const axes =
    `<path d="M ${r2(x)} ${r2(y)} L ${r2(x)} ${r2(y + h)}" stroke="${AXIS_FAINT}" stroke-width="1"/>` +
    `<path d="M ${r2(x)} ${r2(y + h)} L ${r2(x + w)} ${r2(y + h)}" stroke="${AXIS}" stroke-width="1"/>`;
  const marks = series
    .map((s, si) => {
      const color = xmlEscape(colorAt(si, s));
      const fill = m.areas[si]
        ? `<path d="${m.areas[si]}" fill="${color}" fill-opacity="${AREA_FILL_OPACITY}"/>`
        : '';
      const line = m.lines[si]
        ? `<polyline points="${m.lines[si]}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
        : '';
      const dots = m.points[si]!.map(
        (p) => `<circle cx="${r2(p.x)}" cy="${r2(p.y)}" r="${m.dot}" fill="${color}"/>`,
      ).join('');
      return fill + line + dots;
    })
    .join('');
  const font = fontFamily ? ` font-family="${xmlEscape(fontFamily)}"` : '';
  const labels = m.labels
    .map(
      (l) =>
        `<text x="${r2(l.x)}" y="${r2(y + h + 13)}" text-anchor="middle"${font} font-size="9" fill="${xmlEscape(textColor)}">${xmlEscape(l.text)}</text>`,
    )
    .join('');
  const legendItems = series.map((s) => ({ label: s.name, value: 0, color: s.color }));
  return (
    axes + marks + labels + svgChartLegend(el, legendItems, colorAt, legend, textColor, fontFamily)
  );
}
