// A chart not linked to a sheet yet (each product's pie-chart.md "Not linked yet", Work Tracker 1281): the chip's words
// by the chart's size, and the export's fade and chip, one copy for every product.
import { describe, expect, it } from 'vitest';
import {
  SHEET_PENDING_CHIP,
  SHEET_PENDING_SHORT,
  SHEET_PENDING_WORDS,
  sheetPendingChipWidth,
  sheetPendingWords,
} from './chart-sheet-pending';
import { svgBarChart, svgSheetPendingChip } from './svg-render-charts';

const bar = (o: Record<string, unknown> = {}) =>
  ({
    id: 'c',
    type: 'shape',
    shape: 'bar-chart',
    x: 10,
    y: 20,
    width: 320,
    height: 200,
    pieSlices: [{ label: 'Nov', value: 6 }],
    ...o,
  }) as Parameters<typeof svgBarChart>[0];

describe('sheetPendingWords', () => {
  it('says the long words where they fit, the short ones where only they do, and none when neither does', () => {
    expect(sheetPendingWords(320, 200)).toBe(SHEET_PENDING_WORDS);
    const short = Math.ceil(sheetPendingChipWidth(SHEET_PENDING_SHORT)) + 8;
    expect(sheetPendingWords(short, 200)).toBe(SHEET_PENDING_SHORT);
    expect(sheetPendingWords(short - 2, 200)).toBeNull();
    expect(sheetPendingWords(320, SHEET_PENDING_CHIP.height + 3)).toBeNull();
  });
});

describe('the export', () => {
  it('fades a chart not linked yet and centres the chip on it', () => {
    const svg = svgBarChart(bar({ chartSheetPending: true }), '#111111');
    expect(svg.startsWith('<g opacity="0.3">')).toBe(true);
    expect(svg).toContain(`>${SHEET_PENDING_WORDS}</text></g>`);
    const chip = svgSheetPendingChip(bar(), 'Inter');
    expect(chip).toContain('font-family="Inter"');
    // Centred: its rect's middle is the chart's.
    const x = Number(/<rect x="([\d.]+)"/.exec(chip)![1]);
    const w = Number(/width="([\d.]+)" height="22"/.exec(chip)![1]);
    expect(Math.round(x + w / 2)).toBe(10 + 160);
  });

  it('draws a plain chart, and one linked since, as it is', () => {
    expect(svgBarChart(bar(), '#111111')).not.toContain('opacity="0.3"');
    const linked = svgBarChart(
      bar({ chartSheetPending: true, chartSheetSource: { app: 'liveplanner' } }),
      '#111111',
    );
    expect(linked).not.toContain('Not linked');
    expect(svgSheetPendingChip(bar({ width: 30 }))).toBe('');
  });
});
