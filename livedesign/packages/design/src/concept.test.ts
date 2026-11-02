import { describe, expect, it } from 'vitest';
import {
  CONCEPT_ROWS,
  appendWebRow,
  applyShapeVariant,
  canAppendWebRow,
  conceptAnimOf,
  conceptDiscInk,
  conceptRamp,
  contrastRatio,
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
  ({ ...createShape(kind, 0, 0), id: kind, ...over }) as ShapeElement;

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
    // Nor is it stored, so a selection of both picks Flow for the cycle alone.
    const stack = make('layer-stack');
    expect(withConceptAnim(stack, { anim: 'flow' })).toBe(stack);
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

  it('splits a funnel tier with its value as the canvas does: the label left, the value right and muted', () => {
    const el = applyShapeVariant(make('pyramid'), 'funnel');
    const svg = svgBoxed(el);
    const xOf = (word: string) =>
      Number(new RegExp(`<text x="([0-9.-]+)"[^>]*>${word}<`).exec(svg)?.[1]);
    const tier = pyramidLayout(el.width, el.height, el.conceptRows!.length, 'funnel').tiers[0]!
      .label;
    // Each centred in its own half of the tier, never run together as one line.
    expect(svg).not.toContain('Visited  12,400');
    expect(xOf('Visited')).toBeCloseTo(el.x + tier.x + tier.width / 4, 1);
    expect(xOf('12,400')).toBeCloseTo(el.x + tier.x + (tier.width * 3) / 4, 1);
    expect(svg).toMatch(/opacity="0.7"[^>]*>12,400</);
  });

  it('writes a stage on a pale disc in an ink that reads there, not the canvas ink its centre words take', () => {
    // A pale fill under a light ink: the light ink is right for the centre words on a dark canvas, wrong on the disc.
    const svg = svgBoxed(
      make('cycle', {
        fillColor: '#eff6ff',
        strokeColor: '#2563eb',
        textColor: '#ffffff',
        label: 'Momentum',
      }),
    );
    const inkOf = (word: string) =>
      new RegExp(`fill="(#[0-9a-f]{6})"[^>]*>${word}<`).exec(svg)?.[1];
    expect(inkOf('Do')).not.toBe('#ffffff');
    expect(contrastRatio(inkOf('Do')!, '#eff6ff')).toBeGreaterThanOrEqual(4.5);
    expect(svg).toMatch(/fill="#ffffff"[^>]*><tspan[^>]*>Momentum</);
    const hub = svgBoxed(make('hub', { fillColor: '#eff6ff', textColor: '#ffffff' }));
    expect(hub).not.toMatch(/stroke-width="2"\/><text[^>]*fill="#ffffff"/);
  });

  it('keeps the element ink on a disc where it already reads', () => {
    expect(conceptDiscInk('#0f172a', '#eff6ff')).toBe('#0f172a');
    expect(contrastRatio(conceptDiscInk('#e2e8f0', '#eff6ff'), '#eff6ff')).toBeGreaterThanOrEqual(
      4.5,
    );
    // A fill that is not a plain hex (a gradient token, transparent) leaves the ink alone.
    expect(conceptDiscInk('#e2e8f0', 'transparent')).toBe('#e2e8f0');
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

  it('keeps the hub clear of its satellites at every size down to the smallest, spokes running outward', () => {
    for (const side of [20, 30, 40, 60, 80, 100, 120, 200, 340])
      for (const n of [3, 5, 8]) {
        const l = hubLayout(side, side, n);
        for (const [i, s] of l.satellites.entries()) {
          const R = Math.hypot(s.x - l.centre.x, s.y - l.centre.y);
          expect(R, `${side} px, ${n} satellites`).toBeGreaterThanOrEqual(l.hubR + l.satR);
          const sp = l.spokes[i]!;
          const from = Math.hypot(sp.x1 - l.centre.x, sp.y1 - l.centre.y);
          const to = Math.hypot(sp.x2 - l.centre.x, sp.y2 - l.centre.y);
          expect(to, `${side} px spoke`).toBeGreaterThanOrEqual(from);
        }
      }
    // A hub that already fitted keeps its 16 px least radius.
    expect(hubLayout(120, 120, 6).hubR).toBeGreaterThanOrEqual(16);
    // Including where the room is only just enough (80 px: 18 px of room for a 16 px hub).
    expect(hubLayout(80, 80, 6).hubR).toBeGreaterThanOrEqual(16);
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
    // Every note centres under its own label, the notched stages' included.
    for (const s of l.stages)
      expect(s.note!.x + s.note!.width / 2).toBeCloseTo(s.label.x + s.label.width / 2, 5);
  });

  it('exports the hub with its centre and satellites, the onion rings and the stage notes', () => {
    const hub = svgBoxed(make('hub'));
    for (const t of ['>Orders<', 'Payments', 'Support']) expect(hub).toContain(t);
    // Its centre label is written once, by the hub, not again as an ordinary label.
    expect(hub.match(/>Orders</g)).toHaveLength(1);
    expect(hub).toContain('<line');
    expect(svgBoxed(withHubSpokes(make('hub'), false))).not.toContain('<line');
    // A hub with no rows draws as the canvas does: no spoke to a satellite that is not there.
    expect(svgBoxed(make('hub', { conceptRows: [] }))).not.toContain('<line');
    const onion = svgBoxed(make('onion'));
    for (const t of ['Domain', 'Infrastructure']) expect(onion).toContain(t);
    expect(onion.match(/<circle/g)).toHaveLength(4);
    const chev = svgBoxed(make('chevrons'));
    for (const t of ['Commit', 'Release', 'manual gate']) expect(chev).toContain(t);
    expect(chev.match(/<polygon/g)).toHaveLength(4);
  });
});
