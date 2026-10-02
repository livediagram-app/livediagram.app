import { describe, expect, it } from 'vitest';
import {
  LABEL_FONT_PX,
  LEGEND_FONT_PX,
  NOTE_FONT_PX,
  RUN_XS_PX,
  legendFontPx,
  runFontPx,
} from './label-font';
import { svgPieChart } from './svg-render-charts';
import { svgLegendShape } from './svg-render-shapes';
import { createShape } from './factories';

describe('legendFontPx (docs/specs/009-elements/pie-chart.md)', () => {
  it('reads larger than the old fixed 11px chart key by default', () => {
    expect(legendFontPx(undefined)).toBe(LEGEND_FONT_PX.md);
    expect(legendFontPx(undefined)).toBeGreaterThan(11);
  });

  it('grows with the preset', () => {
    expect(legendFontPx('sm')).toBeLessThan(legendFontPx('md'));
    expect(legendFontPx('md')).toBeLessThan(legendFontPx('lg'));
  });

  it('draws the export at the same size the canvas does', () => {
    const pie = {
      ...createShape('pie-chart', 0, 0),
      width: 400,
      height: 400,
      textSize: 'lg' as const,
    };
    expect(svgPieChart(pie, '#000')).toContain(`font-size="${LEGEND_FONT_PX.lg}"`);
    const legend = { ...createShape('legend', 0, 0), textSize: 'sm' as const };
    expect(svgLegendShape(legend, '#fff', '#000', '#000')).toContain(
      `font-size="${LEGEND_FONT_PX.sm}"`,
    );
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Extra-small runs".
describe('runFontPx', () => {
  it('draws xs at 10 px on every scale, below sm', () => {
    expect(RUN_XS_PX).toBe(10);
    expect(runFontPx('xs', false)).toBe(10);
    expect(runFontPx('xs', true)).toBe(10);
    expect(runFontPx('sm', false)).toBe(LABEL_FONT_PX.sm);
    expect(runFontPx('sm', true)).toBe(NOTE_FONT_PX.sm);
    expect(runFontPx('lg', true)).toBe(NOTE_FONT_PX.lg);
    for (const multiline of [false, true]) {
      expect(runFontPx('xs', multiline)).toBeLessThan(runFontPx('sm', multiline));
    }
  });
});
