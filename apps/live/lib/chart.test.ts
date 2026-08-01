import { PIE_DEFAULT_SLICES, type ShapeElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { chartFrame } from './chart';

const el = (over: Record<string, unknown> = {}): ShapeElement =>
  ({
    id: 'c',
    type: 'shape',
    shape: 'pie',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...over,
  }) as unknown as ShapeElement;

describe('chartFrame', () => {
  // The default is BELOW the plot: a side legend spent up to 130px of a
  // 280px-wide chart on series names and squeezed the plot into a third of
  // the card (spec/53).
  it('lays out a legend below the plot by default (horizontal band)', () => {
    const f = chartFrame(el());
    expect(f.showLegend).toBe(true);
    // legendH = min(100 * 0.32, 72) = 32
    expect(f.area).toEqual({ x: 0, y: 0, w: 200, h: 68 });
    expect(f.legend).toEqual({ show: true, pos: 'bottom', x: 0, y: 68, w: 200, h: 32 });
  });

  it('lays out a right-hand legend when asked for one (vertical strip)', () => {
    const f = chartFrame(el({ chartLegendPosition: 'right' }));
    expect(f.area).toEqual({ x: 0, y: 0, w: 120, h: 100 }); // legendW = min(200*0.4, 130) = 80
    expect(f.legend).toEqual({ show: true, pos: 'right', x: 120, y: 0, w: 80, h: 100 });
  });

  it('reclaims the full body and zeroes the strip when the legend is hidden', () => {
    const f = chartFrame(el({ chartLegend: false, chartLegendPosition: 'right' }));
    expect(f.showLegend).toBe(false);
    expect(f.area).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(f.legend.show).toBe(false);
    expect(f.legend.w).toBe(0);
  });

  it('offsets the body for a left legend', () => {
    const f = chartFrame(el({ chartLegendPosition: 'left' }));
    expect(f.area).toEqual({ x: 80, y: 0, w: 120, h: 100 });
    expect(f.legend.x).toBe(0);
  });

  it('uses a horizontal band for a top legend', () => {
    const f = chartFrame(el({ chartLegendPosition: 'top' })); // legendH = min(100*0.32, 72) = 32
    expect(f.area).toEqual({ x: 0, y: 32, w: 200, h: 68 });
    expect(f.legend).toEqual({ show: true, pos: 'top', x: 0, y: 0, w: 200, h: 32 });
  });

  it('pins a bottom legend to the foot', () => {
    const f = chartFrame(el({ chartLegendPosition: 'bottom' }));
    expect(f.area).toEqual({ x: 0, y: 0, w: 200, h: 68 });
    expect(f.legend.y).toBe(68);
    expect(f.legend.h).toBe(32);
  });

  it('caps the legend strip on large charts', () => {
    expect(chartFrame(el({ width: 1000, chartLegendPosition: 'right' })).legend.w).toBe(130); // capped from 400
    expect(chartFrame(el({ height: 1000, chartLegendPosition: 'top' })).legend.h).toBe(72); // capped from 320
  });

  it('clamps width/height to at least 1', () => {
    const f = chartFrame(el({ width: 0, height: 0, chartLegend: false }));
    expect(f.w).toBe(1);
    expect(f.h).toBe(1);
  });

  it('prefers an explicit slice colour, else cycles the palette', () => {
    const f = chartFrame(el(), ['#a', '#b']);
    expect(f.colorAt(0, {})).toBe('#a');
    expect(f.colorAt(1, {})).toBe('#b');
    expect(f.colorAt(2, {})).toBe('#a'); // wraps
    expect(f.colorAt(0, { color: '#fff' })).toBe('#fff');
  });

  it('falls back to the default slices when the element has none', () => {
    expect(chartFrame(el()).data).toBe(PIE_DEFAULT_SLICES);
    const custom = [{ label: 'x', value: 1 }];
    expect(chartFrame(el({ pieSlices: custom })).data).toBe(custom);
  });
});
