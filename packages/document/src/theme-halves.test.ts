import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { themeColourMap, themeHalf, viewElementInTheme } from './theme-halves';
import { THEMES } from './themes';
import { legacyShapeColorPresets, shapeColorPresets } from './theme-presets';
import { contrastRatio } from './colors';

// docs/specs/011-theme/light-and-dark.md "What a viewer sees": a box's text and fill are drawn as a pair.
const map = new Map([
  ['#ffffff', '#1e293b'], // a light fill the half draws dark
  ['#0c4a6e', '#e0f2fe'], // the theme's text, drawn light
  ['#0369a1', '#7dd3fc'], // the theme's outline
]);

describe('viewElementInTheme', () => {
  it('redraws every theme colour in the half', () => {
    const el = { fillColor: '#ffffff', textColor: '#0c4a6e', strokeColor: '#0369a1' };
    expect(viewElementInTheme(el, map)).toEqual({
      fillColor: '#1e293b',
      textColor: '#e0f2fe',
      strokeColor: '#7dd3fc',
    });
  });

  it('keeps the stored fill and text when redrawing only the fill would sink the text', () => {
    // A template's white box under its own slate text: the white is a theme colour, the slate is not.
    const el = { fillColor: '#ffffff', textColor: '#334155', strokeColor: '#0369a1' };
    expect(viewElementInTheme(el, map)).toEqual({ ...el, strokeColor: '#7dd3fc' });
  });

  it('returns the same object when only the pair would have changed', () => {
    const el = { fillColor: '#ffffff', textColor: '#334155' };
    expect(viewElementInTheme(el, map)).toBe(el);
  });

  it('never draws a short stored pair any worse', () => {
    // Stored white on a mid blue (3.9:1); the white alone would map to a dark slate (far worse).
    const el = { fillColor: '#4982ad', textColor: '#ffffff' };
    expect(viewElementInTheme(el, map)).toBe(el);
  });

  it('redraws a pair that reads better in the half', () => {
    const el = { fillColor: '#ffffff', textColor: '#cbd5e1' }; // stored 1.5:1
    expect(viewElementInTheme(el, map)).toEqual({ fillColor: '#1e293b', textColor: '#cbd5e1' });
  });

  it('leaves text-only and fill-only elements to the per-colour rule', () => {
    expect(viewElementInTheme({ textColor: '#0c4a6e' }, map)).toEqual({ textColor: '#e0f2fe' });
    expect(viewElementInTheme({ fillColor: '#ffffff' }, map)).toEqual({ fillColor: '#1e293b' });
  });
});

describe('themeColourMap and stored preset colours', () => {
  // A shape styled with Bold before every label met the text floor stores white on a mid-tone fill. The map reads
  // those colours too, so the box is drawn as today's Bold in the viewer's half.
  it('draws a box stored with the old Bold as the new Bold', () => {
    const pine = THEMES.find((t) => t.id === 'pine')!;
    const half = themeHalf(pine, 'dark');
    const was = legacyShapeColorPresets(half).find((p) => p.id === 'bold')!;
    const now = shapeColorPresets(half).find((p) => p.id === 'bold')!;
    expect(contrastRatio(was.text, was.fill)).toBeLessThan(4.5);
    const el = { fillColor: was.fill, strokeColor: was.stroke, textColor: was.text };
    const drawn = viewElementInTheme(el, themeColourMap(pine, 'dark'));
    expect(drawn.fillColor).toBe(now.fill);
    expect(drawn.strokeColor).toBe(now.stroke);
    expect(contrastRatio(drawn.textColor, drawn.fillColor)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('viewElementInTheme cost', () => {
  it('draws 5,000 boxes under 20 ms of CPU: the text-on-fill ratios are cached per pair', () => {
    const sky = THEMES.find((t) => t.id === 'sky')!;
    const skyMap = themeColourMap(sky, 'dark');
    const boxes = Array.from({ length: 5000 }, (_, i) => ({
      fillColor: i % 2 ? sky.elementFill! : '#ffffff',
      textColor: i % 3 ? sky.elementText! : '#334155',
      strokeColor: sky.elementStroke!,
    }));
    boxes.forEach((b) => viewElementInTheme(b, skyMap));
    expect(cpuMsOf(() => boxes.forEach((b) => viewElementInTheme(b, skyMap)))).toBeLessThan(20);
  });
});
