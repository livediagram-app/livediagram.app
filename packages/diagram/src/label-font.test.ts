import { describe, expect, it } from 'vitest';
import { LEGEND_FONT_PX, legendFontPx } from './label-font';
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
