import { describe, expect, it } from 'vitest';
import {
  CONCEPT_ROWS,
  appendWebRow,
  applyShapeVariant,
  canAppendWebRow,
  conceptAnimOf,
  conceptRamp,
  createShape,
  chevronLayout,
  cycleLayout,
  hubLayout,
  onionLayout,
  withHubSpokes,
  isValidElement,
  layerStackLayout,
  pyramidLayout,
  svgBoxed,
  withConceptAnim,
  withPyramidVariant,
  withWebRows,
  type ConceptShape,
  type ShapeElement,
} from './index';

const make = (kind: ConceptShape, over: Partial<ShapeElement> = {}) =>
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

describe('hub, onion and chevrons (round 2)', () => {
  it('starts each with rows inside its bounds and validates', () => {
    for (const kind of ['hub', 'onion', 'chevrons'] as const) {
      const el = make(kind);
      const n = el.conceptRows!.length;
      expect(n, kind).toBeGreaterThanOrEqual(CONCEPT_ROWS[kind].min);
      expect(n, kind).toBeLessThanOrEqual(CONCEPT_ROWS[kind].max);
      expect(isValidElement(el), kind).toBe(true);
    }
  });

  it('places satellites round the hub from twelve o clock, clear of the hub and of each other', () => {
    const l = hubLayout(340, 320, 6);
    expect(l.satellites[0]!.x).toBeCloseTo(170, 5);
    expect(l.satellites[0]!.y).toBeLessThan(l.centre.y);
    for (const s of l.satellites) {
      expect(Math.hypot(s.x - l.centre.x, s.y - l.centre.y)).toBeGreaterThan(l.hubR + l.satR);
    }
    const [a, b] = l.satellites;
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(2 * l.satR);
    // Each spoke runs from the hub's edge to its satellite's edge.
    const sp = l.spokes[0]!;
    expect(Math.hypot(sp.x1 - l.centre.x, sp.y1 - l.centre.y)).toBeCloseTo(l.hubR, 5);
  });

  it('switches spokes off and back on (on is the absent default)', () => {
    const off = withHubSpokes(make('hub'), false);
    expect(off.hubSpokes).toBe(false);
    expect('hubSpokes' in withHubSpokes(off, true)).toBe(false);
    expect(withHubSpokes(make('cycle'), false)).toEqual(make('cycle'));
  });

  it('nests onion rings evenly from the core, each label inside the element', () => {
    const l = onionLayout(320, 320, 4);
    expect(l.radii).toEqual([40, 80, 120, 160]);
    for (const r of l.labels) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(320);
    }
    // The core's label is centred; ring 2's sits at the top of its band.
    expect(l.labels[0]!.x + l.labels[0]!.width / 2).toBeCloseTo(160, 5);
    expect(l.labels[2]!.y).toBeCloseTo(160 - 120, 5);
  });

  it('lays chevrons across the full width, each pointing into the next, notes under them', () => {
    const l = chevronLayout(600, 150, 4, true);
    const last = l.stages[3]!;
    expect(Math.max(...last.points.map((p) => p.x))).toBeCloseTo(600, 5);
    expect(l.stages[0]!.points).toHaveLength(5);
    expect(l.stages[1]!.points).toHaveLength(6);
    // A stage's point reaches past the next stage's left edge, into its notch.
    const tip = Math.max(...l.stages[0]!.points.map((p) => p.x));
    expect(tip).toBeGreaterThan(Math.min(...l.stages[1]!.points.map((p) => p.x)));
    expect(l.stages[0]!.note!.y).toBeGreaterThan(l.stages[0]!.label.height);
    expect(chevronLayout(600, 150, 4, false).stages[0]!.note).toBeNull();
  });

  it('exports the hub with its centre and satellites, the onion rings and the stage notes', () => {
    const hub = svgBoxed(make('hub'));
    for (const t of ['>Orders<', 'Payments', 'Support']) expect(hub).toContain(t);
    expect(hub).toContain('<line');
    expect(svgBoxed(withHubSpokes(make('hub'), false))).not.toContain('<line');
    const onion = svgBoxed(make('onion'));
    for (const t of ['Domain', 'Infrastructure']) expect(onion).toContain(t);
    expect(onion.match(/<circle/g)).toHaveLength(4);
    const chev = svgBoxed(make('chevrons'));
    for (const t of ['Commit', 'Release', 'manual gate']) expect(chev).toContain(t);
    expect(chev.match(/<polygon/g)).toHaveLength(4);
  });
});
