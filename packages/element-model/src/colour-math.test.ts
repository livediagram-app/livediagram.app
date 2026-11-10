import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@liveworkspace/model-core/canvas-colors';
import {
  bestInk,
  canvasSurface,
  colourIsOpaque,
  contrastRatio,
  deriveShapeColours,
  deriveTextColorForBg,
  hexToRgb,
  inkOn,
  isLightColor,
  normaliseHex,
  rgbToHex,
  shade,
  tint,
} from './colour-math';

// Agents write `#fff` and `red` (each product's docs/specs/011-theme/light-and-dark.md "Colours an agent writes").
describe('reading a written colour', () => {
  it('reads hex in every CSS length and the named colours, alpha set aside', () => {
    expect(hexToRgb('#0ea5e9')).toEqual({ r: 14, g: 165, b: 233 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#0a58')).toEqual({ r: 0, g: 170, b: 85 });
    expect(hexToRgb('#0ea5e980')).toEqual({ r: 14, g: 165, b: 233 });
    expect(hexToRgb(' SlateGray ')).toEqual({ r: 112, g: 128, b: 144 });
    for (const bad of ['', '#', '#ff', 'transparent', 'rgb(0,0,0)', 'notacolour'])
      expect(hexToRgb(bad)).toBeNull();
  });

  it('normalises to #rrggbb and says whether a colour is opaque', () => {
    expect(normaliseHex('#FFF')).toBe('#ffffff');
    expect(normaliseHex('navy')).toBe('#000080');
    expect(normaliseHex('nope')).toBeNull();
    expect(colourIsOpaque('#fff')).toBe(true);
    expect(colourIsOpaque('#fff8')).toBe(false);
    expect(colourIsOpaque('transparent')).toBe(false);
  });

  it('writes channels back rounded and clamped', () => {
    expect(rgbToHex({ r: 300, g: -4, b: 15.6 })).toBe('#ff0010');
  });
});

describe('contrast', () => {
  it('is the WCAG ratio, order-independent, NaN on anything unread', () => {
    expect(contrastRatio('#fff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('black', 'white')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#777777'),
      10,
    );
    expect(contrastRatio('nope', '#ffffff')).toBeNaN();
  });

  it('picks the ink that reads better, dark for an unread fill', () => {
    expect(bestInk('#f97316', '#1e293b', '#f1f5f9')).toBe('#1e293b');
    expect(bestInk('#0f172a', '#1e293b', '#f1f5f9')).toBe('#f1f5f9');
    expect(bestInk('nope', '#1e293b', '#f1f5f9')).toBe('#1e293b');
    expect(inkOn('#000080')).toBe('#ffffff');
    expect(deriveTextColorForBg('#ffffff')).toBe('#1e293b');
  });
});

describe('tint, shade and lightness', () => {
  it('mixes toward white or black and hands an unread colour back', () => {
    expect(tint('#000000', 0.5)).toBe('#808080');
    expect(shade('red', 0.5)).toBe('#800000');
    expect(tint('nope', 0.5)).toBe('nope');
    expect(shade('nope', 0.5)).toBe('nope');
  });

  it('reads lightness and the paper a canvas colour amounts to', () => {
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isLightColor('#000000')).toBe(false);
    expect(isLightColor('nope')).toBe(true);
    expect(canvasSurface(undefined)).toBe('light');
    expect(canvasSurface('red')).toBe('light');
    expect(canvasSurface('#0d121a')).toBe('dark');
  });
});

describe('deriveShapeColours', () => {
  it('defers to the design system on a default tab', () => {
    expect(deriveShapeColours(DEFAULT_PATTERN_COLOR, DEFAULT_BACKGROUND_COLOR)).toBeNull();
  });
  it('spins a customised pattern colour into fill, stroke and text', () => {
    const c = deriveShapeColours('#0000ff', '#ffffff')!;
    expect(c.stroke).toBe('#0000ff');
    expect(isLightColor(c.fill)).toBe(true);
    expect(contrastRatio(c.text, '#ffffff')).toBeGreaterThan(4.5);
    expect(deriveShapeColours('nope', '#ffffff')).toBeNull();
  });
});

// It runs for every label drawn, so a named colour is a map read, not a scan.
it('reads 100k mixed colours in well under a second', () => {
  const inputs = ['#0ea5e9', '#fff', 'red', 'cornflowerblue', '#0ea5e980', 'nope'];
  const start = performance.now();
  for (let i = 0; i < 100_000; i++) hexToRgb(inputs[i % inputs.length]!);
  // Measured about 15 ms; the budget leaves room for a busy CI machine.
  expect(performance.now() - start).toBeLessThan(500);
});
