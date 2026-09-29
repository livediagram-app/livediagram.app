import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  MIN_TEXT_CONTRAST,
  ARROW_THICKNESS_PX,
  ARROWHEAD_SHAPES,
  ARROWHEAD_SIZE_PX,
  DEFAULT_ARROW_THICKNESS,
  DEFAULT_ARROWHEAD_SHAPE,
  DEFAULT_ARROWHEAD_SIZE,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  arrowStyleOf,
  arrowThicknessOf,
  arrowheadShapeOf,
  arrowheadSizeOf,
  createShape,
  deriveShapeColours,
  deriveTextColorForBg,
  hexToRgb,
  isLightColor,
  rgbToHex,
  shade,
  supportsBorderRadius,
  supportsFillColor,
  type ArrowElement,
  type Element,
  type ArrowThickness,
  type ArrowheadSize,
  type ShapeKind,
} from './index';
import { tableKeys } from './table-keys';

const channels = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!;
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
};

const arrow = (overrides: Partial<ArrowElement> = {}): ArrowElement => ({
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

  it('is null for anything that is not six hex digits', () => {
    expect(hexToRgb('#fff')).toBeNull();
    expect(hexToRgb('#0ea5e980')).toBeNull();
    expect(hexToRgb('red')).toBeNull();
  });

  it('writes channels back rounded and clamped into 0-255', () => {
    expect(rgbToHex({ r: 14, g: 165, b: 233 })).toBe('#0ea5e9');
    expect(rgbToHex({ r: -4, g: 300, b: 127.6 })).toBe('#00ff80');
  });

  it('shade mixes toward black and leaves unparseable input alone', () => {
    // The avatar sprite's shaded side is this 22% shade.
    expect(shade('#0ea5e9', 0.22)).toBe('#0b81b6');
    expect(shade('red', 0.5)).toBe('red');
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

describe('arrow preset resolvers', () => {
  it('arrowThicknessOf defaults to medium when unset', () => {
    expect(arrowThicknessOf(arrow())).toBe('medium');
  });

  it('arrowThicknessOf snaps a raw width to the nearest named preset', () => {
    expect(arrowThicknessOf(arrow({ strokeWidth: 1 }))).toBe('thin');
    expect(arrowThicknessOf(arrow({ strokeWidth: 4 }))).toBe('thick');
    expect(arrowThicknessOf(arrow({ strokeWidth: 6.5 }))).toBe('extra-thick');
    // Halfway-ish values snap to the closest preset, not a fixed side.
    expect(arrowThicknessOf(arrow({ strokeWidth: 1.2 }))).toBe('thin');
  });

  it('arrowheadSizeOf defaults to medium and otherwise echoes the field', () => {
    expect(arrowheadSizeOf(arrow())).toBe('medium');
    expect(arrowheadSizeOf(arrow({ arrowheadSize: 'large' }))).toBe('large');
  });

  it('arrowStyleOf defaults to straight and otherwise echoes the field', () => {
    expect(arrowStyleOf(arrow())).toBe('straight');
    expect(arrowStyleOf(arrow({ arrowStyle: 'curved' }))).toBe('curved');
    expect(arrowStyleOf(arrow({ arrowStyle: 'angled' }))).toBe('angled');
  });

  it('arrowheadShapeOf defaults to triangle and otherwise echoes the field', () => {
    expect(arrowheadShapeOf(arrow())).toBe('triangle');
    expect(arrowheadShapeOf(arrow({ arrowheadShape: 'diamond-hollow' }))).toBe('diamond-hollow');
  });

  it('ARROWHEAD_SHAPES lists the default first and has no duplicates', () => {
    expect(ARROWHEAD_SHAPES[0]).toBe(DEFAULT_ARROWHEAD_SHAPE);
    expect(new Set(ARROWHEAD_SHAPES).size).toBe(ARROWHEAD_SHAPES.length);
  });
});

describe('ARROW_THICKNESS_PX lookup', () => {
  it('maps every ArrowThickness preset to a positive pixel width', () => {
    const presets = tableKeys<ArrowThickness>(ARROW_THICKNESS_PX);
    expect(presets.length).toBeGreaterThan(3);
    for (const p of presets) {
      expect(typeof ARROW_THICKNESS_PX[p]).toBe('number');
      expect(ARROW_THICKNESS_PX[p]).toBeGreaterThan(0);
    }
  });

  it('orders thicknesses monotonically so the Pointer accordion icons read correctly', () => {
    expect(ARROW_THICKNESS_PX.thin).toBeLessThan(ARROW_THICKNESS_PX.medium);
    expect(ARROW_THICKNESS_PX.medium).toBeLessThan(ARROW_THICKNESS_PX.thick);
    expect(ARROW_THICKNESS_PX.thick).toBeLessThan(ARROW_THICKNESS_PX['extra-thick']);
  });

  it('DEFAULT_ARROW_THICKNESS has a non-zero pixel mapping so the default stroke paints', () => {
    expect(ARROW_THICKNESS_PX[DEFAULT_ARROW_THICKNESS]).toBeGreaterThan(0);
  });
});

describe('ARROWHEAD_SIZE_PX lookup', () => {
  it('maps every ArrowheadSize preset to a positive marker size', () => {
    const presets = tableKeys<ArrowheadSize>(ARROWHEAD_SIZE_PX);
    expect(presets.length).toBeGreaterThan(3);
    for (const p of presets) {
      expect(typeof ARROWHEAD_SIZE_PX[p]).toBe('number');
      expect(ARROWHEAD_SIZE_PX[p]).toBeGreaterThan(0);
    }
  });

  it('orders sizes monotonically (small < medium < large < extra-large)', () => {
    expect(ARROWHEAD_SIZE_PX.small).toBeLessThan(ARROWHEAD_SIZE_PX.medium);
    expect(ARROWHEAD_SIZE_PX.medium).toBeLessThan(ARROWHEAD_SIZE_PX.large);
    expect(ARROWHEAD_SIZE_PX.large).toBeLessThan(ARROWHEAD_SIZE_PX['extra-large']);
  });

  it('DEFAULT_ARROWHEAD_SIZE has a non-zero pixel mapping so the default head paints', () => {
    expect(ARROWHEAD_SIZE_PX[DEFAULT_ARROWHEAD_SIZE]).toBeGreaterThan(0);
  });
});

describe('supportsBorderRadius', () => {
  // Only the free-corner rectangles expose a user-adjustable radius;
  // every other shape bakes its rounding into the silhouette or is an
  // SVG outline, so the Radius control is hidden for them.
  const RADIUS_SHAPES: ShapeKind[] = ['square', 'browser'];
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
    'monitor',
    'laptop',
    'phone',
    'tablet',
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

  it('is NaN for anything but #rrggbb, so no threshold check can pass', () => {
    expect(contrastRatio('red', '#ffffff')).toBeNaN();
    expect(contrastRatio('#fff', '#000000')).toBeNaN();
  });

  it('names the AA threshold for normal text', () => {
    expect(MIN_TEXT_CONTRAST).toBe(4.5);
  });
});
