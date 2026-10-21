import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from '@livediagram/templates';
import { buildTemplate } from './template-builders';

// Structure pins for the discovery and strategy starters built together
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the opportunity
// solution tree and the stakeholder map. Each test maps to a sentence of
// that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Arrow = Extract<Element, { type: 'arrow' }>;
type Table = Extract<Element, { type: 'table' }>;
type Box = { x: number; y: number; width: number; height: number };

const labelOf = (el: Element) => ('label' in el ? (el.label ?? '') : '');
const shapesOf = (els: Element[], shape?: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && (!shape || el.shape === shape));
const textsOf = (els: Element[]) => els.filter((el) => el.type === 'text');
const arrowsOf = (els: Element[]) => els.filter((el): el is Arrow => el.type === 'arrow');
const byLabel = (els: Element[], start: string) =>
  els.find((el) => labelOf(el).startsWith(start)) as Shape;
const pinned = (a: Arrow, end: 'from' | 'to') =>
  a[end].kind === 'pinned' ? (a[end] as { elementId: string }).elementId : undefined;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const midY = (b: Box) => b.y + b.height / 2;
const noOverlaps = (boxes: Box[]) => {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(overlaps(boxes[i]!, boxes[j]!), `${i} overlaps ${j}`).toBe(false);
    }
  }
};
// Built from its code point so this file carries no em dash itself.
const EM_DASH = String.fromCharCode(0x2014);
const noEmDashes = (els: Element[]) => {
  for (const el of els) expect(JSON.stringify(el)).not.toContain(EM_DASH);
};

describe('opportunity solution tree template', () => {
  const els = buildTemplate('opportunity-solution-tree', 0, 0);
  const levelNames = ['Outcome', 'Opportunities', 'Solutions', 'Experiments'];
  const railLabels = textsOf(els).filter((t) => levelNames.includes(labelOf(t)));
  // Each level's wash is the full-width scaffold square its name sits on.
  const bands = railLabels.map(
    (label) =>
      shapesOf(els, 'square')
        .filter((s) => s.layerId === TEMPLATE_SCAFFOLD_LAYER_ID && inside(label, s))
        .sort((a, b) => b.width - a.width)[0]!,
  );
  const opportunities = shapesOf(els, 'square').filter((s) => labelOf(s).startsWith('“'));
  const chips = shapesOf(els, 'stadium');
  const target = byLabel(els, '“We can never agree');
  const solutions = ['Group basket', 'Family bundles', 'Tonight’s vote'].map((n) =>
    byLabel(els, n),
  );

  it('names a real team outcome', () => {
    expect(labelOf(textsOf(els)[0]!)).toBe('Plateful · 30-day retention');
    noEmDashes(els);
  });

  it('reads by row: a rail names the four levels top-down, each on its own band', () => {
    expect(railLabels.map(labelOf)).toEqual(levelNames);
    const tops = bands.map((b) => b.y);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    expect(new Set(bands.map((b) => b.fillColor)).size).toBe(4);
    for (const band of bands) expect(band.layerId).toBe(TEMPLATE_SCAFFOLD_LAYER_ID);
  });

  it('opens on a desired outcome with its metric and a progress ring', () => {
    const rings = shapesOf(els, 'progress-ring');
    expect(rings).toHaveLength(1);
    expect(rings[0]!.progress).toBe(25);
    expect(
      textsOf(els).some((t) => labelOf(t).startsWith('Raise 30-day retention from 32% to 40%')),
    ).toBe(true);
    expect(midY(rings[0]!) > bands[0]!.y && midY(rings[0]!) < bands[0]!.y + bands[0]!.height).toBe(
      true,
    );
  });

  it('lists opportunities in the customer’s words, each with its interview evidence', () => {
    expect(opportunities).toHaveLength(6);
    for (const o of opportunities) {
      expect(labelOf(o)).toMatch(/^“.+”$/);
      expect(
        chips.some((c) => /^Heard in \d+ of 12 interviews$/.test(labelOf(c)) && inside(c, o)),
      ).toBe(true);
      expect(midY(o) > bands[1]!.y && midY(o) < bands[1]!.y + bands[1]!.height).toBe(true);
    }
  });

  it('breaks one opportunity into three sub-opportunities, the middle one the target', () => {
    const parent = byLabel(els, '“Ordering for the whole house');
    const children = arrowsOf(els)
      .filter((a) => pinned(a, 'from') === parent.id)
      .map((a) => els.find((el) => el.id === pinned(a, 'to')) as Shape);
    expect(children.map(labelOf)).toEqual([
      '“Splitting the bill is awkward”',
      '“We can never agree on what to order”',
      '“Someone’s order always gets missed”',
    ]);
    const ribbon = chips.find((c) => labelOf(c) === '★ Target')!;
    expect(overlaps(ribbon, target)).toBe(true);
    expect(target.strokeWidth).toBe('thick');
    expect(target.fillColor).not.toBe('#ffffff');
  });

  it('compares three solutions for the target, each over two assumption tests with a verdict', () => {
    const fromTarget = arrowsOf(els).filter((a) => pinned(a, 'from') === target.id);
    expect(fromTarget.map((a) => pinned(a, 'to'))).toEqual(solutions.map((s) => s.id));
    for (const s of solutions) {
      expect(midY(s) > bands[2]!.y && midY(s) < bands[2]!.y + bands[2]!.height).toBe(true);
      const tests = arrowsOf(els)
        .filter((a) => pinned(a, 'from') === s.id)
        .map((a) => els.find((el) => el.id === pinned(a, 'to')) as Shape);
      expect(tests).toHaveLength(2);
      for (const t of tests) {
        expect(midY(t) > bands[3]!.y && midY(t) < bands[3]!.y + bands[3]!.height).toBe(true);
        expect(chips.filter((c) => inside(c, t))).toHaveLength(1);
      }
    }
    const verdicts = chips.map(labelOf).filter((l) => /Running|Validated|Invalidated/.test(l));
    expect(verdicts.sort()).toEqual([
      'Running',
      'Running',
      '✓ Validated',
      '✓ Validated',
      '✗ Invalidated',
      '✗ Invalidated',
    ]);
  });

  it('joins the tree with pinned square rakes and no arrowheads', () => {
    const lines = arrowsOf(els);
    expect(lines).toHaveLength(15);
    for (const l of lines) {
      expect(l.arrowEnds).toBe('none');
      expect(l.from.kind).toBe('pinned');
      expect(l.to.kind).toBe('pinned');
      expect(l.to.kind === 'pinned' && l.to.anchor).toBe('n');
    }
  });

  it('never stacks one card on another', () => {
    const cards = [...opportunities, ...solutions];
    const tests = arrowsOf(els)
      .filter((a) => solutions.some((s) => s.id === pinned(a, 'from')))
      .map((a) => els.find((el) => el.id === pinned(a, 'to')) as Shape);
    noOverlaps([...cards, ...tests]);
  });
});

describe('stakeholder map template', () => {
  const els = buildTemplate('stakeholder-map', 0, 0);
  const quadrantNames = ['Keep satisfied', 'Manage closely', 'Monitor', 'Keep informed'];
  const quadrants = quadrantNames.map((name) => {
    const heading = textsOf(els).find((t) => labelOf(t) === name)!;
    return shapesOf(els, 'square').find(
      (s) => s.layerId === TEMPLATE_SCAFFOLD_LAYER_ID && inside(heading, s),
    )!;
  });
  const people = shapesOf(els, 'square').filter(
    (s) => s.iconId === 'user' && s.strokeStyle !== 'dashed',
  );
  const edges = { champion: '#16a34a', neutral: '#64748b', sceptic: '#e11d48' };

  it('names a real initiative', () => {
    expect(labelOf(textsOf(els)[0]!)).toBe('Plateful · Launching group ordering');
    noEmDashes(els);
  });

  it('lays out the Mendelow grid: power up, interest right', () => {
    const [satisfied, manage, monitor, informed] = quadrants;
    expect(manage!.x).toBeGreaterThan(satisfied!.x);
    expect(manage!.y).toBe(satisfied!.y);
    expect(monitor!.y).toBeGreaterThan(satisfied!.y);
    expect(informed!.x).toBe(manage!.x);
    expect(informed!.y).toBe(monitor!.y);
    expect(new Set(quadrants.map((q) => q.fillColor)).size).toBe(4);
    // Each quadrant carries a glyph and a one-line rule.
    for (const q of quadrants) {
      expect(shapesOf(els, 'icon').filter((i) => inside(i, q))).toHaveLength(1);
      expect(
        textsOf(els).some((t) => inside(t, q) && /power, .* interest: /.test(labelOf(t))),
      ).toBe(true);
    }
    const axes = arrowsOf(els).filter((a) => a.from.kind === 'free' && a.strokeStyle !== 'dashed');
    expect(axes).toHaveLength(2);
    expect(textsOf(els).map(labelOf)).toEqual(expect.arrayContaining(['Power', 'Interest']));
  });

  it('places each person inside a quadrant, edged by stance, never overlapping', () => {
    expect(people).toHaveLength(9);
    for (const p of people) expect(quadrants.some((q) => inside(p, q))).toBe(true);
    const count = (edge: string) => people.filter((p) => p.strokeColor === edge).length;
    expect([count(edges.champion), count(edges.neutral), count(edges.sceptic)]).toEqual([3, 4, 2]);
    const ghost = shapesOf(els, 'square').find((s) => s.strokeStyle === 'dashed')!;
    noOverlaps([...people, ghost]);
  });

  it('shows where the team wants its powerful sceptic with a dashed arrow', () => {
    const helen = byLabel(els, 'Helen Park');
    const ghost = shapesOf(els, 'square').find((s) => s.strokeStyle === 'dashed')!;
    expect(helen.strokeColor).toBe(edges.sceptic);
    expect(inside(helen, quadrants[0]!)).toBe(true);
    expect(inside(ghost, quadrants[1]!)).toBe(true);
    const move = arrowsOf(els).find((a) => pinned(a, 'from') === helen.id)!;
    expect(pinned(move, 'to')).toBe(ghost.id);
    expect(move.strokeStyle).toBe('dashed');
    expect(move.label).toBeTruthy();
  });

  it('plans the engagement of every key stakeholder beside the grid, tinted by stance', () => {
    const table = els.find((el): el is Table => el.type === 'table')!;
    expect(table.cells[0]).toEqual(['Stakeholder', 'What they need', 'Channel · cadence', 'Owner']);
    expect(table.x).toBeGreaterThan(Math.max(...quadrants.map((q) => q.x + q.width)));
    const names = table.cells.slice(1).map((row) => row[0]!);
    const onGrid = new Map(people.map((p) => [labelOf(p).split('\n')[0]!, p]));
    for (const [r, name] of names.entries()) {
      expect(onGrid.has(name), name).toBe(true);
      expect(table.cellStyles![r + 1]![0]!.bg).toBeTruthy();
      expect(table.cells[r + 1]![3]).toMatch(/^[A-Z][a-z]+$/);
    }
    // Everyone we manage closely or keep satisfied has a row.
    for (const p of people.filter((p) => inside(p, quadrants[0]!) || inside(p, quadrants[1]!))) {
      expect(names).toContain(labelOf(p).split('\n')[0]);
    }
  });

  it('explains the stance colours in a key', () => {
    for (const label of ['Champion', 'Neutral', 'Sceptic']) {
      const chip = byLabel(els, label);
      expect(chip.layerId).toBe(TEMPLATE_SCAFFOLD_LAYER_ID);
    }
    expect(byLabel(els, 'Champion').strokeColor).toBe(edges.champion);
    expect(byLabel(els, 'Sceptic').strokeColor).toBe(edges.sceptic);
  });

  it('keeps the grid on the scaffold and the people on the content layer', () => {
    for (const q of quadrants) expect(q.layerId).toBe(TEMPLATE_SCAFFOLD_LAYER_ID);
    for (const p of people) expect(p.layerId).toBe(TEMPLATE_CONTENT_LAYER_ID);
  });
});
