import { describe, expect, it } from 'vitest';
import {
  CONCEPT_ROWS,
  appendWebRow,
  applyShapeVariant,
  canAppendWebRow,
  conceptAnimOf,
  conceptRamp,
  createShape,
  cycleLayout,
  isValidElement,
  layerStackLayout,
  pyramidLayout,
  svgBoxed,
  withConceptAnim,
  withPyramidVariant,
  withWebRows,
  type ShapeElement,
} from './index';

const make = (kind: 'layer-stack' | 'pyramid' | 'cycle', over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape(kind, 0, 0) as ShapeElement), id: kind, ...over }) as ShapeElement;

describe('concept rows (docs/specs/009-elements/concept-graphics.md)', () => {
  it('bounds rows per kind and ignores a write below the minimum (I1)', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ label: `  row   ${i} `, note: ' ' }));
    const stack = withWebRows(make('layer-stack'), { conceptRows: rows });
    expect(stack.conceptRows).toHaveLength(CONCEPT_ROWS['layer-stack'].max);
    expect(stack.conceptRows![0]).toEqual({ label: 'row 0' });
    expect(withWebRows(make('pyramid'), { conceptRows: rows }).conceptRows).toHaveLength(6);
    const cycle = make('cycle');
    expect(withWebRows(cycle, { conceptRows: [{ label: 'a' }, { label: 'b' }] })).toBe(cycle);
  });

  it('appends a numbered row until the kind is full', () => {
    let el = make('cycle');
    for (let i = 0; i < 9; i++) el = appendWebRow(el);
    expect(el.conceptRows).toHaveLength(8);
    expect(el.conceptRows![4]!.label).toBe('Step 5');
    expect(canAppendWebRow(el)).toBe(false);
  });

  it('ramps from the accent to 22% accent, with text that reads on each', () => {
    const ramp = conceptRamp(4, '#1d4ed8', '#ffffff');
    expect(ramp[0]!.fill).toBe('#1d4ed8');
    expect(ramp[0]!.text).toBe('#ffffff');
    expect(ramp[3]!.fill).not.toBe('#1d4ed8');
  });
});

describe('concept layouts (I2)', () => {
  it('stacks bands, giving notes their own column when any row has one', () => {
    const plain = layerStackLayout(300, 200, 4, false);
    expect(plain.bands[0]!.width).toBe(300);
    const noted = layerStackLayout(300, 200, 4, true);
    expect(noted.bands[0]!.width).toBe(186);
    expect(noted.notes[0]!.x).toBeGreaterThan(186);
    expect(noted.bands[3]!.y + noted.bands[3]!.height).toBeCloseTo(200);
  });

  it('cuts pyramid tiers from one triangle, apex up, and narrows a funnel', () => {
    const p = pyramidLayout(300, 200, 3, 'pyramid');
    expect(p.tiers[0]!.points).toHaveLength(3);
    expect(p.tiers[2]!.points[2]!.x - p.tiers[2]!.points[3]!.x).toBeCloseTo(300);
    const inv = pyramidLayout(300, 200, 3, 'inverted');
    expect(inv.tiers[2]!.points).toHaveLength(3);
    const f = pyramidLayout(300, 200, 4, 'funnel');
    expect(f.tiers[0]!.points[1]!.x - f.tiers[0]!.points[0]!.x).toBeCloseTo(300);
    const tip = f.tiers[3]!.points;
    expect(tip[2]!.x - tip[3]!.x).toBeCloseTo(105);
  });

  it('places cycle steps round a ring from twelve o clock, arcs between them', () => {
    const c = cycleLayout(300, 300, 4);
    expect(c.discs[0]!.x).toBeCloseTo(150);
    expect(c.discs[0]!.y).toBeLessThan(150);
    expect(c.discs[1]!.x).toBeGreaterThan(150);
    expect(c.arcs).toHaveLength(4);
    // Neighbouring discs never touch.
    const gap = Math.hypot(c.discs[1]!.x - c.discs[0]!.x, c.discs[1]!.y - c.discs[0]!.y);
    expect(gap).toBeGreaterThan(c.discR * 2);
  });
});

describe('concept writes and animation', () => {
  it('sets a pyramid variant and clears back to Pyramid', () => {
    expect(withPyramidVariant(make('pyramid'), 'funnel').pyramidVariant).toBe('funnel');
    expect(
      'pyramidVariant' in withPyramidVariant(make('pyramid', { pyramidVariant: 'funnel' }), null),
    ).toBe(false);
  });

  it('offers Flow only on a cycle (I3)', () => {
    expect(conceptAnimOf(withConceptAnim(make('cycle'), { anim: 'flow' }))).toBe('flow');
    expect(conceptAnimOf(withConceptAnim(make('layer-stack'), { anim: 'flow' }))).toBeNull();
    expect(conceptAnimOf(withConceptAnim(make('pyramid'), { anim: 'build' }))).toBe('build');
  });

  it('places a funnel from its tile with its conversion rows', () => {
    const f = applyShapeVariant(make('pyramid'), 'funnel');
    expect(f.pyramidVariant).toBe('funnel');
    expect(f.conceptRows![0]).toEqual({ label: 'Visited', note: '12,400' });
  });
});

describe('concept validation and export', () => {
  it('validates rows and the variant', () => {
    expect(isValidElement(make('layer-stack'))).toBe(true);
    expect(isValidElement(make('pyramid', { pyramidVariant: 'cone' as never }))).toBe(false);
    expect(isValidElement(make('cycle', { conceptRows: [{ label: 'x'.repeat(61) }] }))).toBe(false);
  });

  it('exports every row, a funnel value and a cycle centre label', () => {
    const stack = svgBoxed(make('layer-stack'));
    for (const t of ['Presentation', 'Storage', 'Workers']) expect(stack).toContain(t);
    const funnel = svgBoxed(applyShapeVariant(make('pyramid'), 'funnel'));
    expect(funnel).toContain('12,400');
    const cycle = svgBoxed(make('cycle'));
    expect(cycle).toContain('>Weekly<');
    expect(cycle).toContain('>loop<');
  });
});
