// Chart elements in the headless render (spec/53): pie, bar and line, plus the
// key they share.
//
// These drew NOTHING before this: the exporter had no branch for them, so a
// chart fell through to the generic box and came out of an export as an empty
// rectangle with its kind name in it. For an element whose entire content is
// its data, that is not a degraded render, it is a blank.
//
// The layout comes from the same `chartFrame` the canvas lays out with, so the
// plot and the legend land in the same rects; only the drawing primitives
// differ. Hover, tooltips and the looping animations are the canvas's alone
// and have no meaning in a still image.

import { chartFrame, type ChartLegendRect, type ChartRect } from './chart-frame';
import { LINE_DEFAULT_CATEGORIES, LINE_DEFAULT_SERIES, type PieSlice } from './data-shapes';
import type { BoxedElement, ShapeElement } from './index';
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
  const rowH = 14;
  const parts: string[] = [];
  if (vertical) {
    // A column, centred in the strip.
    const top = el.y + legend.y + legend.h / 2 - (items.length * rowH) / 2;
    items.forEach((item, i) => {
      const y = top + i * rowH + rowH / 2;
      const x = el.x + legend.x + 6;
      parts.push(
        `<rect x="${r2(x)}" y="${r2(y - 4.5)}" width="9" height="9" rx="2" fill="${xmlEscape(colorAt(i, item))}"/>`,
        `<text x="${r2(x + 13)}" y="${r2(y)}"${font} font-size="11" fill="${xmlEscape(textColor)}" dominant-baseline="central">${xmlEscape(item.label || '—')}</text>`,
      );
    });
    return parts.join('');
  }
  // A row, wrapped and centred: measured the way the wrapped-label emitter
  // measures, off the character count, since there is no DOM to ask.
  const itemW = (item: PieSlice) => 9 + 4 + Math.max(8, (item.label || '—').length * 5.6) + 10;
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
        `<rect x="${r2(x)}" y="${r2(y - 4.5)}" width="9" height="9" rx="2" fill="${xmlEscape(colorAt(index, item))}"/>`,
        `<text x="${r2(x + 13)}" y="${r2(y)}"${font} font-size="11" fill="${xmlEscape(textColor)}" dominant-baseline="central">${xmlEscape(item.label || '—')}</text>`,
      );
      x += itemW(item);
      index += 1;
    }
  });
  return parts.join('');
}

/** A pie chart: wedges clockwise from twelve o'clock, plus the key. */
export function svgPieChart(
  el: Chart,
  textColor: string,
  palette?: readonly string[],
  fontFamily?: string,
): string {
  const { data, colorAt, area, legend } = chartFrame(el as ShapeElement, palette);
  const total = data.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  const rad = Math.max(10, (Math.min(area.w, area.h) * 0.86) / 2);
  const cx = el.x + area.x + area.w / 2;
  const cy = el.y + area.y + area.h / 2;
  let angle = -Math.PI / 2;
  const wedges = data
    .map((s, i) => {
      const frac = Math.max(0, s.value) / total;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2;
      angle = a1;
      const fill = xmlEscape(colorAt(i, s));
      // A single 100% slice is a full circle: an arc from a point back to
      // itself is degenerate and draws nothing.
      if (frac >= 0.999)
        return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rad)}" fill="${fill}"/>`;
      if (frac <= 0) return '';
      const large = frac > 0.5 ? 1 : 0;
      const p = (a: number) => `${r2(cx + rad * Math.cos(a))} ${r2(cy + rad * Math.sin(a))}`;
      return `<path d="M ${r2(cx)} ${r2(cy)} L ${p(a0)} A ${r2(rad)} ${r2(rad)} 0 ${large} 1 ${p(a1)} Z" fill="${fill}"/>`;
    })
    .join('');
  return wedges + svgChartLegend(el, data, colorAt, legend, textColor, fontFamily);
}

/** A bar chart: a baseline and one bar per value, plus the key. */
export function svgBarChart(
  el: Chart,
  textColor: string,
  palette?: readonly string[],
  fontFamily?: string,
): string {
  const { data, colorAt, area, legend } = chartFrame(el as ShapeElement, palette);
  const maxVal = data.reduce((m, d) => Math.max(m, Math.max(0, d.value)), 0) || 1;
  const padX = Math.min(20, area.w * 0.08);
  const topPad = el.y + area.y + area.h * 0.1;
  const baseY = el.y + area.y + area.h * 0.88;
  const innerW = Math.max(1, area.w - padX * 2);
  const slot = innerW / data.length;
  const barW = Math.min(slot * 0.7, 48);
  const fullH = Math.max(1, baseY - topPad);
  const x0 = el.x + area.x + padX;
  const baseline = `<path d="M ${r2(x0)} ${r2(baseY)} L ${r2(x0 + innerW)} ${r2(baseY)}" stroke="${AXIS}" stroke-width="1"/>`;
  const bars = data
    .map((d, i) => {
      const barH = (Math.max(0, d.value) / maxVal) * fullH;
      const cx = x0 + slot * (i + 0.5);
      return `<rect x="${r2(cx - barW / 2)}" y="${r2(baseY - barH)}" width="${r2(barW)}" height="${r2(barH)}" rx="${r2(Math.min(3, barW / 4))}" fill="${xmlEscape(colorAt(i, d))}"/>`;
    })
    .join('');
  return baseline + bars + svgChartLegend(el, data, colorAt, legend, textColor, fontFamily);
}

/** A line chart: axes, a polyline + points per series, category labels, key. */
export function svgLineChart(
  el: Chart,
  textColor: string,
  palette?: readonly string[],
  fontFamily?: string,
): string {
  const { colorAt, area, legend } = chartFrame(el as ShapeElement, palette);
  const categories =
    el.lineCategories && el.lineCategories.length > 0 ? el.lineCategories : LINE_DEFAULT_CATEGORIES;
  const series = el.lineSeries && el.lineSeries.length > 0 ? el.lineSeries : LINE_DEFAULT_SERIES;
  const n = categories.length;
  const padL = 10;
  const padTop = 12;
  const padBottom = 22;
  const plotX0 = el.x + area.x + padL;
  const plotW = Math.max(1, area.w - padL - 8);
  const plotY0 = el.y + area.y + padTop;
  const plotH = Math.max(1, area.h - padTop - padBottom);
  // Zero is always in range so the baseline reads naturally; the degenerate
  // all-equal case is guarded so the line isn't flat against the top edge.
  let minV = 0;
  let maxV = 0;
  for (const s of series)
    for (const v of s.values) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  if (maxV === minV) maxV = minV + 1;
  const xAt = (i: number) => (n <= 1 ? plotX0 + plotW / 2 : plotX0 + (i / (n - 1)) * plotW);
  const yAt = (v: number) => plotY0 + plotH - ((v - minV) / (maxV - minV)) * plotH;
  const valAt = (s: number, i: number) => series[s]?.values[i] ?? 0;
  const axes =
    `<path d="M ${r2(plotX0)} ${r2(plotY0)} L ${r2(plotX0)} ${r2(plotY0 + plotH)}" stroke="${AXIS_FAINT}" stroke-width="1"/>` +
    `<path d="M ${r2(plotX0)} ${r2(plotY0 + plotH)} L ${r2(plotX0 + plotW)} ${r2(plotY0 + plotH)}" stroke="${AXIS}" stroke-width="1"/>`;
  const lines = series
    .map((s, si) => {
      const color = xmlEscape(colorAt(si, s));
      const pts = categories.map((_, i) => `${r2(xAt(i))},${r2(yAt(valAt(si, i)))}`).join(' ');
      const dots = categories
        .map(
          (_, i) =>
            `<circle cx="${r2(xAt(i))}" cy="${r2(yAt(valAt(si, i)))}" r="3" fill="${color}"/>`,
        )
        .join('');
      return (
        `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
        dots
      );
    })
    .join('');
  const font = fontFamily ? ` font-family="${xmlEscape(fontFamily)}"` : '';
  const labels = categories
    .map(
      (c, i) =>
        `<text x="${r2(xAt(i))}" y="${r2(plotY0 + plotH + 13)}" text-anchor="middle"${font} font-size="9" fill="${xmlEscape(textColor)}">${xmlEscape(c.length > 6 ? `${c.slice(0, 5)}…` : c)}</text>`,
    )
    .join('');
  const legendItems = series.map((s) => ({ label: s.name, value: 0, color: s.color }));
  return (
    axes + lines + labels + svgChartLegend(el, legendItems, colorAt, legend, textColor, fontFamily)
  );
}

export type { ChartRect };
