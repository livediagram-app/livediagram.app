// Border preset resolvers + lookup tables. Every shape renders
// through these (border thickness / dash pattern / corner radius are
// resolved from optional element fields with default fallbacks), so
// silent breakage of the resolvers would warp every saved diagram on
// next paint. The tests pin both the fallback behaviour and the
// completeness of the lookup tables (every preset has a pixel
// mapping, every style has a dasharray, every radius has a pixel
// value) so a future preset addition to BorderStroke / BorderStyle /
// BorderRadius is caught.
//
// Two mechanisms, and they catch different halves. A table MISSING a key the
// union gained fails to typecheck, because each is a Record over its union.
// A key that exists but maps to a nonsense value typechecks fine, and only
// these tests catch that.

import { describe, expect, it } from 'vitest';
import {
  BORDER_DASH_ARRAY,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  SELF_PAINTING_SHAPES,
  isSelfDrawingShape,
  supportsBorderControls,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type Element,
  type ShapeKind,
} from './index';
import { SHAPE_KINDS } from './validate';
import { tableKeys } from './table-keys';

const shape = (kind: string) => ({ type: 'shape', shape: kind }) as unknown as Element;
const ofType = (type: string) => ({ type }) as unknown as Element;

// The "every preset" tests below iterate each table's own keys (see
// table-keys.ts). This file is why that helper exists: its radius list read
// ['none', 'sm', 'md', 'lg'] long after BorderRadius gained 'full'.

describe('supportsBorderControls', () => {
  it('includes shapes, freehand and tables', () => {
    expect(supportsBorderControls(shape('square'))).toBe(true);
    expect(supportsBorderControls(ofType('freehand'))).toBe(true);
    expect(supportsBorderControls(ofType('table'))).toBe(true);
  });

  // THE cross-list invariant, and the reason a whole class of this bug exists.
  //
  // Two lists describe "this shape draws its own body": isSelfDrawingShape
  // (which suppresses markers, label editing and morphing) and
  // SELF_PAINTING_SHAPES (which suppresses the border CONTROLS). They must
  // agree, and they silently didn't — progress-bar / progress-ring were added
  // to the first and not the second, so the Border accordion went on offering
  // Strength and Pattern on a shape whose renderer has a hardcoded arc stroke
  // and never reads either field. The picks were committed, autosaved,
  // change-logged and broadcast to every peer, for no visual change.
  //
  // Asserted over the real ShapeKind vocabulary rather than a hand-written
  // list, so the next self-drawing kind cannot land half-registered: the
  // border.test suite previously covered only square / actor / text / arrow /
  // image / freehand / table, no member of the self-drawing family at all.
  it('offers no border controls for any shape that draws its own body', () => {
    const selfDrawing = ([...SHAPE_KINDS] as ShapeKind[]).filter(isSelfDrawingShape);
    // Guard against the predicate itself going empty and making this vacuous.
    expect(selfDrawing.length).toBeGreaterThan(5);
    expect(selfDrawing.filter((k) => !SELF_PAINTING_SHAPES.has(k))).toEqual([]);
    expect(selfDrawing.filter((k) => supportsBorderControls(shape(k)))).toEqual([]);
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
    const presets = tableKeys<BorderStroke>(BORDER_STROKE_PX);
    expect(presets.length).toBeGreaterThan(4);
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
    const dashed = tableKeys<BorderStyle>(BORDER_DASH_ARRAY).filter((s) => s !== 'solid');
    expect(dashed.length).toBeGreaterThan(4);
    for (const style of dashed) {
      expect(typeof BORDER_DASH_ARRAY[style]).toBe('string');
      expect(BORDER_DASH_ARRAY[style]).toMatch(/^\d+(\.\d+)?( \d+(\.\d+)?)+$/);
    }
  });
});

describe('BORDER_RADIUS_PX lookup', () => {
  it('maps every BorderRadius preset to a non-negative pixel value', () => {
    const radii = tableKeys<BorderRadius>(BORDER_RADIUS_PX);
    // 'full' is the one this list used to miss; pin that it is now reached.
    expect(radii).toContain('full');
    for (const r of radii) {
      expect(typeof BORDER_RADIUS_PX[r]).toBe('number');
      expect(BORDER_RADIUS_PX[r]).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps "none" at exactly 0 so a square stays square', () => {
    expect(BORDER_RADIUS_PX.none).toBe(0);
  });

  it('keeps "full" far above the size steps, since it is a sentinel not a step', () => {
    // CSS clamps border-radius to 50% of the box, so 'full' works by being
    // larger than any element could be: that is what turns a square into a
    // circle and a rectangle into a stadium (spec/09). A value merely one
    // step above 'lg' would round the corners and stop there.
    expect(BORDER_RADIUS_PX.full).toBeGreaterThan(BORDER_RADIUS_PX.lg * 100);
  });

  it('orders radii monotonically (none < sm < md < lg)', () => {
    expect(BORDER_RADIUS_PX.none).toBeLessThan(BORDER_RADIUS_PX.sm);
    expect(BORDER_RADIUS_PX.sm).toBeLessThan(BORDER_RADIUS_PX.md);
    expect(BORDER_RADIUS_PX.md).toBeLessThan(BORDER_RADIUS_PX.lg);
  });
});
