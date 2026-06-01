// Border preset resolvers + lookup tables. Every shape renders
// through these (border thickness / dash pattern / corner radius are
// resolved from optional element fields with default fallbacks), so
// silent breakage of the resolvers would warp every saved diagram on
// next paint. The tests pin both the fallback behaviour and the
// completeness of the lookup tables (every preset has a pixel
// mapping, every style has a dasharray, every radius has a pixel
// value) so a future preset addition to BorderStroke / BorderStyle /
// BorderRadius is caught by the table being narrower than the union.

import { describe, expect, it } from 'vitest';
import {
  BORDER_DASH_ARRAY,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  borderRadiusOf,
  borderStrokeOf,
  borderStyleOf,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type ShapeElement,
} from './index';

const shape = (overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  ...overrides,
});

describe('borderStrokeOf', () => {
  it('falls back to DEFAULT_BORDER_STROKE when the element has no strokeWidth', () => {
    expect(borderStrokeOf(shape())).toBe(DEFAULT_BORDER_STROKE);
  });

  it('returns each set preset verbatim so the Border accordion can highlight it', () => {
    const presets: BorderStroke[] = ['none', 'thin', 'medium', 'thick', 'extra-thick'];
    for (const p of presets) {
      expect(borderStrokeOf(shape({ strokeWidth: p }))).toBe(p);
    }
  });
});

describe('borderStyleOf', () => {
  it('falls back to DEFAULT_BORDER_STYLE when strokeStyle is unset', () => {
    expect(borderStyleOf(shape())).toBe(DEFAULT_BORDER_STYLE);
  });

  it('returns each set preset verbatim', () => {
    const styles: BorderStyle[] = ['solid', 'dashed', 'dotted'];
    for (const s of styles) {
      expect(borderStyleOf(shape({ strokeStyle: s }))).toBe(s);
    }
  });
});

describe('borderRadiusOf', () => {
  it('falls back to DEFAULT_BORDER_RADIUS when borderRadius is unset', () => {
    expect(borderRadiusOf(shape())).toBe(DEFAULT_BORDER_RADIUS);
  });

  it('returns each set preset verbatim', () => {
    const radii: BorderRadius[] = ['none', 'sm', 'md', 'lg'];
    for (const r of radii) {
      expect(borderRadiusOf(shape({ borderRadius: r }))).toBe(r);
    }
  });
});

describe('BORDER_STROKE_PX lookup', () => {
  it('maps every BorderStroke preset to a numeric pixel width', () => {
    const presets: BorderStroke[] = ['none', 'thin', 'medium', 'thick', 'extra-thick'];
    for (const p of presets) {
      expect(typeof BORDER_STROKE_PX[p]).toBe('number');
      expect(Number.isFinite(BORDER_STROKE_PX[p])).toBe(true);
    }
  });

  it('keeps "none" at exactly 0 so the renderer can branch on it for borderless shapes', () => {
    expect(BORDER_STROKE_PX.none).toBe(0);
  });

  it('orders thicknesses monotonically (none < thin < medium < thick < extra-thick)', () => {
    expect(BORDER_STROKE_PX.none).toBeLessThan(BORDER_STROKE_PX.thin);
    expect(BORDER_STROKE_PX.thin).toBeLessThan(BORDER_STROKE_PX.medium);
    expect(BORDER_STROKE_PX.medium).toBeLessThan(BORDER_STROKE_PX.thick);
    expect(BORDER_STROKE_PX.thick).toBeLessThan(BORDER_STROKE_PX['extra-thick']);
  });

  it('DEFAULT_BORDER_STROKE has a non-zero pixel mapping (the default must paint)', () => {
    expect(BORDER_STROKE_PX[DEFAULT_BORDER_STROKE]).toBeGreaterThan(0);
  });
});

describe('BORDER_DASH_ARRAY lookup', () => {
  it('maps "solid" to null so the renderer can omit the dasharray attribute', () => {
    expect(BORDER_DASH_ARRAY.solid).toBeNull();
  });

  it('maps "dashed" and "dotted" to SVG dasharray strings', () => {
    expect(typeof BORDER_DASH_ARRAY.dashed).toBe('string');
    expect(typeof BORDER_DASH_ARRAY.dotted).toBe('string');
    expect(BORDER_DASH_ARRAY.dashed).toMatch(/^\d+(\.\d+)?( \d+(\.\d+)?)+$/);
    expect(BORDER_DASH_ARRAY.dotted).toMatch(/^\d+(\.\d+)?( \d+(\.\d+)?)+$/);
  });
});

describe('BORDER_RADIUS_PX lookup', () => {
  it('maps every BorderRadius preset to a non-negative pixel value', () => {
    const radii: BorderRadius[] = ['none', 'sm', 'md', 'lg'];
    for (const r of radii) {
      expect(typeof BORDER_RADIUS_PX[r]).toBe('number');
      expect(BORDER_RADIUS_PX[r]).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps "none" at exactly 0 so a square stays square', () => {
    expect(BORDER_RADIUS_PX.none).toBe(0);
  });

  it('orders radii monotonically (none < sm < md < lg)', () => {
    expect(BORDER_RADIUS_PX.none).toBeLessThan(BORDER_RADIUS_PX.sm);
    expect(BORDER_RADIUS_PX.sm).toBeLessThan(BORDER_RADIUS_PX.md);
    expect(BORDER_RADIUS_PX.md).toBeLessThan(BORDER_RADIUS_PX.lg);
  });
});
