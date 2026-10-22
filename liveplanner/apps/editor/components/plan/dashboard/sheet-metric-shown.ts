// What a figure from a Sheet shows (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"): its name, its figure as
// the sheet formats it, the line under it, and its bar, change or sparkline, read from the sheet now; or why it shows
// nothing. Pure: the Dashboard slot (DashboardSheetMetric) and its still picture in an image export both read it.
import {
  COLUMN_STAT_NAMES,
  columnTrend,
  formatLike,
  sheetColumn,
  sheetFigure,
  sparklineOf,
  summarise,
} from '@liveplanner/sheets';
import type { SheetMetricContent } from '@liveplanner/project';
import type { SheetRead } from './useSheetReader';
import type { SheetMetricShown } from '@liveplanner/plan-art';

// Its shape is shared with the figure's picture in an image export.
export type { SheetMetricShown };

// What the card shows of its source now, or why it shows nothing.
export function sheetMetricShown(
  content: SheetMetricContent,
  read: Pick<Extract<SheetRead, { state: 'ready' }>, 'sheet' | 'wb' | 'locale'>,
): SheetMetricShown | 'cell-gone' | 'unset' {
  const { sheet, wb, locale } = read;
  const where = sheet.title;
  if (content.metric === 'figure') {
    if (!content.cell) return 'unset';
    const f = sheetFigure(wb, sheet, content.cell, locale);
    if (!f) return 'cell-gone';
    const t = content.target ? sheetFigure(wb, sheet, content.target, locale) : null;
    const progress =
      t && t.value && f.value !== null
        ? {
            share: Math.max(0, Math.min(1, f.value / t.value)),
            met: f.value >= t.value,
            of: t.text,
          }
        : undefined;
    return {
      label: f.label,
      hero: f.text || '–',
      line: `${where} · ${f.a1}`,
      ...(progress ? { progress } : {}),
    };
  }
  if (!content.col) return 'unset';
  const col = sheetColumn(wb, sheet, content.col);
  if (!col) return 'cell-gone';
  const spark = col.values.length > 1 ? sparklineOf(col.values) : undefined;
  if (content.metric === 'summary') {
    const stat = content.stat ?? 'sum';
    const v = summarise(col.values, stat);
    const hero =
      v === null
        ? '–'
        : stat === 'count' || !col.first
          ? String(v)
          : formatLike(sheet, col.first, v, locale);
    return {
      label: `${COLUMN_STAT_NAMES[stat]} of ${col.label}`,
      hero,
      line: where,
      ...(spark ? { spark } : {}),
    };
  }
  const trend = columnTrend(col.values);
  if (!trend || !col.first) return { label: col.label, hero: '–', line: where };
  const hero = formatLike(sheet, col.first, trend.last, locale);
  const change =
    trend.change === null || trend.change === 0
      ? { text: trend.change === 0 ? 'No change' : 'One value so far', dir: 'flat' as const }
      : {
          text: `${trend.change > 0 ? '▲' : '▼'} ${formatLike(sheet, col.first, Math.abs(trend.change), locale)}${trend.ratio === null ? '' : ` (${Math.round(Math.abs(trend.ratio) * 100)}%)`}`,
          dir: trend.change > 0 ? ('up' as const) : ('down' as const),
        };
  return { label: col.label, hero, line: where, change, ...(spark ? { spark } : {}) };
}
