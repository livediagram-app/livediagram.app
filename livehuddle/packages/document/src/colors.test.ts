import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  contrastRatio,
  MIN_TEXT_CONTRAST,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  createShape,
  deriveShapeColours,
  deriveTextColorForBg,
  inkOn,
  bestInk,
  hexToRgb,
  colourIsOpaque,
  normaliseHex,
  isLightColor,
  rgbToHex,
  shade,
  supportsBorderRadius,
  supportsFillColor,
  type Element,
  type RetiredArrowElement,
  type ShapeKind,
} from './index';

const channels = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!;
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
};

const arrow = (overrides: Partial<RetiredArrowElement> = {}): RetiredArrowElement => ({
  id: 'e',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 10 },
  ...overrides,
});

describe('hexToRgb / rgbToHex', () => {
  it('parses #rrggbb with or without the #, in either case', () => {
    expect(hexToRgb('#0ea5E9')).toEqual({ r: 14, g: 165, b: 233 });
    expect(hexToRgb('0ea5e9')).toEqual({ r: 14, g: 165, b: 233 });
  });

  // Agents write `#fff` and `red` (docs/specs/011-theme/light-and-dark.md "Colours an agent writes").
  it('reads shorthand hex, hex with alpha and CSS named colours, alpha set aside', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#0A5')).toEqual({ r: 0, g: 170, b: 85 });
    expect(hexToRgb('#0a58')).toEqual({ r: 0, g: 170, b: 85 });
    expect(hexToRgb('#0ea5e980')).toEqual({ r: 14, g: 165, b: 233 });
    expect(hexToRgb('red')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb(' SlateGray ')).toEqual({ r: 112, g: 128, b: 144 });
  });

  it('is null for anything else', () => {
    for (const bad of ['', '#', '#ff', '#fffff', 'fff', 'transparent', 'rgb(0,0,0)', 'notacolour'])
      expect(hexToRgb(bad)).toBeNull();
  });

  it('normalises any colour it reads to #rrggbb, and says whether it is opaque', () => {
    expect(normaliseHex('#FFF')).toBe('#ffffff');
    expect(normaliseHex('navy')).toBe('#000080');
    expect(normaliseHex('nope')).toBeNull();
    expect(colourIsOpaque('#fff')).toBe(true);
    expect(colourIsOpaque('#fff8')).toBe(false);
    expect(colourIsOpaque('#0ea5e9ff')).toBe(true);
    expect(colourIsOpaque('#0ea5e980')).toBe(false);
    expect(colourIsOpaque('transparent')).toBe(false);
  });

  // It runs for every label drawn, so a named colour is a map read, not a scan.
  it('reads 100k mixed colours in well under a second', () => {
    const inputs = ['#0ea5e9', '#fff', 'red', 'cornflowerblue', '#0ea5e980', 'nope'];
    // CPU time, not wall-clock: a busy machine's wait for a core is not the reader's cost. Measured about 15 ms.
    const spent = cpuMsOf(() => {
      for (let i = 0; i < 100_000; i++) hexToRgb(inputs[i % inputs.length]!);
    });
    expect(spent).toBeLessThan(cpuBudgetMs(150));
  });

  it('writes channels back rounded and clamped into 0-255', () => {
    expect(rgbToHex({ r: 14, g: 165, b: 233 })).toBe('#0ea5e9');
    expect(rgbToHex({ r: -4, g: 300, b: 127.6 })).toBe('#00ff80');
  });

  it('shade mixes toward black and leaves unparseable input alone', () => {
    // The avatar sprite's shaded side is this 22% shade.
    expect(shade('#0ea5e9', 0.22)).toBe('#0b81b6');
    expect(shade('nope', 0.5)).toBe('nope');
    expect(shade('red', 0.5)).toBe('#800000');
  });
});

describe('isLightColor', () => {
  it('treats white as light and black as dark', () => {
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isLightColor('#000000')).toBe(false);
  });

  it('tolerates a missing leading hash', () => {
    expect(isLightColor('ffffff')).toBe(true);
  });

  it('fails safe to light for unparseable input', () => {
    expect(isLightColor('not-a-color')).toBe(true);
    expect(isLightColor('')).toBe(true);
  });
});

describe('deriveTextColorForBg', () => {
  it('uses dark slate text on a light background', () => {
    expect(deriveTextColorForBg('#ffffff')).toBe('#1e293b');
  });

  it('uses light slate text on a dark background', () => {
    expect(deriveTextColorForBg('#000000')).toBe('#f1f5f9');
  });

  // A brightness cut-off gave a mid-tone light text it could not carry (orange at 2.6:1): it now takes whichever ink
  // reads better.
  it('gives a mid-tone the ink that reads on it, and an unreadable colour dark text', () => {
    for (const paper of ['#f97316', '#f87171', '#8f8f97', '#0ea5e9'])
      expect(contrastRatio(deriveTextColorForBg(paper), paper)).toBeGreaterThanOrEqual(4.5);
    expect(deriveTextColorForBg('not a colour')).toBe('#1e293b');
  });

  it('gives a mid-tone button and chip the ink that reads on it too (inkOn, bestInk)', () => {
    for (const fill of ['#f97316', '#0ea5e9', '#ef4444', '#10b981']) {
      expect(contrastRatio(inkOn(fill), fill)).toBeGreaterThanOrEqual(4.5);
      // The better of the two, whatever the pair: no fill gets the weaker ink.
      const ink = bestInk(fill, '#1f2937', '#ffffff');
      const other = ink === '#ffffff' ? '#1f2937' : '#ffffff';
      expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(contrastRatio(other, fill));
    }
  });
});

describe('deriveShapeColours', () => {
  it('returns null when both backdrop colours are the design defaults', () => {
    expect(deriveShapeColours(DEFAULT_PATTERN_COLOR, DEFAULT_BACKGROUND_COLOR)).toBeNull();
  });

  it('returns null when the pattern colour is unparseable', () => {
    expect(deriveShapeColours('garbage', '#222222')).toBeNull();
  });

  it('returns the normalised pattern colour as the stroke', () => {
    const result = deriveShapeColours('#0ea5e9', '#ffffff');
    expect(result).not.toBeNull();
    expect(result!.stroke).toBe('#0ea5e9');
  });

  it('makes the fill lighter and the text darker than the pattern colour', () => {
    const [pr, pg, pb] = channels('#0ea5e9');
    const { fill, text } = deriveShapeColours('#0ea5e9', '#ffffff')!;
    const [fr, fg, fb] = channels(fill);
    const [tr, tg, tb] = channels(text);
    // Fill is mixed toward white: every channel is >= the original.
    expect(fr).toBeGreaterThanOrEqual(pr);
    expect(fg).toBeGreaterThanOrEqual(pg);
    expect(fb).toBeGreaterThanOrEqual(pb);
    // Text is a darkened version: every channel is <= the original.
    expect(tr).toBeLessThanOrEqual(pr);
    expect(tg).toBeLessThanOrEqual(pg);
    expect(tb).toBeLessThanOrEqual(pb);
  });
});

describe('supportsBorderRadius', () => {
  // Only the free-corner rectangles expose a user-adjustable radius;
  // every other shape bakes its rounding into the silhouette or is an
  // SVG outline, so the Radius control is hidden for them.
  const RADIUS_SHAPES: ShapeKind[] = ['square'];
  const NO_RADIUS_SHAPES: ShapeKind[] = [
    'circle',
    'diamond',
    'cylinder',
    'parallelogram',
    'hexagon',
    'document',
    'stadium',
    'actor',
    'cloud',
  ];

  it('is true for the free-corner rectangle shapes', () => {
    for (const kind of RADIUS_SHAPES) {
      expect(supportsBorderRadius(createShape(kind, 0, 0))).toBe(true);
    }
  });

  it('is false for every other shape kind', () => {
    for (const kind of NO_RADIUS_SHAPES) {
      expect(supportsBorderRadius(createShape(kind, 0, 0))).toBe(false);
    }
  });

  it('covers the whole ShapeKind union (radius + non-radius = all kinds)', () => {
    const seen = new Set<ShapeKind>([...RADIUS_SHAPES, ...NO_RADIUS_SHAPES]);
    expect(seen.size).toBe(RADIUS_SHAPES.length + NO_RADIUS_SHAPES.length);
  });

  it('is false for non-shape elements', () => {
    expect(supportsBorderRadius(arrow())).toBe(false);
  });
});

describe('supportsFillColor', () => {
  // The Background row is only worth showing where a fill is actually
  // painted. An icon's wrapper is self-painting, so the control sat there
  // doing nothing but writing to the element on every pick.
  const shape = (s: string): Element =>
    ({ id: 'e', type: 'shape', shape: s, x: 0, y: 0, width: 10, height: 10 }) as Element;

  it('is off for icons, whose renderers never read a fill', () => {
    expect(supportsFillColor(shape('icon'))).toBe(false);
  });

  it('stays on for the shapes that do paint one', () => {
    expect(supportsFillColor(shape('square'))).toBe(true);
    // A frame's fill defaults to transparent but is real once picked.
    expect(supportsFillColor(shape('frame'))).toBe(true);
    // The progress track is drawn FROM fillColor, self-painting or not.
    expect(supportsFillColor(shape('progress-bar'))).toBe(true);
  });
});

// docs/specs/011-theme/blueprints/multicolour-themes.md, the contrast helper.
describe('contrastRatio', () => {
  it('rates black on white at 21 and a colour on itself at 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#7c2d12', '#7c2d12')).toBeCloseTo(1, 5);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio('#1e3a8a', '#dbeafe')).toBe(contrastRatio('#dbeafe', '#1e3a8a'));
  });

  it('matches the WCAG reference value for #767676 on white', () => {
    // The lightest grey that passes AA on white: 4.54:1.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('reads shorthand and named colours, and is NaN for anything else, so no threshold check can pass', () => {
    expect(contrastRatio('#fff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('white', 'black')).toBeCloseTo(21, 5);
    expect(contrastRatio('nope', '#ffffff')).toBeNaN();
  });

  it('names the AA threshold for normal text', () => {
    expect(MIN_TEXT_CONTRAST).toBe(4.5);
  });
});
