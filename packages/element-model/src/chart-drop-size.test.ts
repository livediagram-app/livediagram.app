import { describe, expect, it } from 'vitest';
import { chartDropInBox } from './chart-drop-size';
import { chartFrame } from './chart-frame';
import type { ShapeElement } from './element';

// A chart dropped on a slide or infographic page is sized for the page (docs/specs/009-elements/pie-chart.md
// "Behaviour").
describe('chart drop size', () => {
  // A 1920 x 1080 slide's content box, less its 7% margin.
  const slide = { x: 76, y: 76, width: 1768, height: 928 };

  it('takes 60% of a slide’s content box, centred on the drop', () => {
    const at = chartDropInBox('bar-chart', 'slide', slide, 960, 540)!;
    expect(at.width).toBe(Math.round(1768 * 0.6));
    expect(at.height).toBe(Math.round(928 * 0.6));
    expect(at.x + at.width / 2).toBeCloseTo(960, -1);
    expect(at.y + at.height / 2).toBeCloseTo(540, -1);
  });

  it('stays inside the content box when dropped near its edge, and keeps a chart’s shape on a tall page', () => {
    const at = chartDropInBox('pie-chart', 'infographic', slide, 80, 1000)!;
    expect(at.x).toBe(76);
    expect(at.y + at.height).toBe(76 + 928);
    const tall = chartDropInBox(
      'line-chart',
      'infographic',
      { x: 0, y: 0, width: 800, height: 2000 },
      400,
      1000,
    )!;
    expect(tall.height).toBe(Math.round(tall.width * 0.75));
  });

  it('leaves a non-chart and an article page to their own sizes', () => {
    expect(chartDropInBox('rectangle', 'slide', slide, 960, 540)).toBeNull();
    expect(chartDropInBox('bar-chart', 'article', slide, 960, 540)).toBeNull();
  });
});

describe('a column chart is one hue', () => {
  const el = (extra: Partial<ShapeElement>): ShapeElement => ({
    id: 'c',
    type: 'shape',
    shape: 'bar-chart',
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    pieSlices: [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ],
    ...extra,
  });
  const palette = ['#257de0', '#f47230'];

  it('draws every bar in the lead and hides the key its axis names make redundant', () => {
    const f = chartFrame(el({}), palette);
    expect(f.colorAt(1, f.data[1]!)).toBe(f.colorAt(0, f.data[0]!));
    expect(f.showLegend).toBe(false);
  });

  it('keeps a bar’s own colour, and then its key', () => {
    const f = chartFrame(
      el({
        pieSlices: [
          { label: 'A', value: 1 },
          { label: 'B', value: 2, color: '#00b894' },
        ],
      }),
      palette,
    );
    expect(f.colorAt(1, f.data[1]!)).not.toBe(f.colorAt(0, f.data[0]!));
    expect(f.showLegend).toBe(true);
  });

  it('still colours a pie’s wedges apart', () => {
    const f = chartFrame(el({ shape: 'pie-chart' }), palette);
    expect(f.colorAt(1, f.data[1]!)).not.toBe(f.colorAt(0, f.data[0]!));
  });
});
