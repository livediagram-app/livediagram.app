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
  DEFAULT_BORDER_STROKE,
  supportsBorderControls,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type Element,
} from './index';

const shape = (kind: string) => ({ type: 'shape', shape: kind }) as unknown as Element;
const ofType = (type: string) => ({ type }) as unknown as Element;

describe('supportsBorderControls', () => {
  it('includes shapes, freehand and tables', () => {
    expect(supportsBorderControls(shape('square'))).toBe(true);
    expect(supportsBorderControls(ofType('freehand'))).toBe(true);
    expect(supportsBorderControls(ofType('table'))).toBe(true);
  });

  it('excludes the actor (a stick figure with no enclosing outline)', () => {
    expect(supportsBorderControls(shape('actor'))).toBe(false);
  });

  it('excludes elements that carry no stroke (text, arrow, image)', () => {
    expect(supportsBorderControls(ofType('text'))).toBe(false);
    expect(supportsBorderControls(ofType('arrow'))).toBe(false);
    expect(supportsBorderControls(ofType('image'))).toBe(false);
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

  it('maps every non-solid style to a valid SVG dasharray string', () => {
    const dashed: BorderStyle[] = ['dashed', 'dotted', 'long-dash', 'dash-dot', 'dash-dot-dot'];
    for (const style of dashed) {
      expect(typeof BORDER_DASH_ARRAY[style]).toBe('string');
      expect(BORDER_DASH_ARRAY[style]).toMatch(/^\d+(\.\d+)?( \d+(\.\d+)?)+$/);
    }
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
