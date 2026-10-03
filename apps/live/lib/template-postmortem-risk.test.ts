import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from '@livediagram/templates';
import { buildTemplate, buildTemplatedTab } from './template-builders';

// Structure pins for the two report starters (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): the incident postmortem and the risk matrix. Each test maps
// to a sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Arrow = Extract<Element, { type: 'arrow' }>;
type Table = Extract<Element, { type: 'table' }>;
type Box = { x: number; y: number; width: number; height: number };

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);
const arrowsOf = (els: Element[]) => els.filter((el): el is Arrow => el.type === 'arrow');
const tableOf = (els: Element[]) => els.find((el): el is Table => el.type === 'table')!;
const labels = (els: Element[]) =>
  els.map((el) => (el as { label?: string }).label ?? '').filter(Boolean);
const byLabel = (els: Element[], label: string) =>
  els.find((el) => (el as { label?: string }).label === label) as Box & Element;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Box, b: Box) =>
  a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const contains = (b: Box, p: { x: number; y: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
const onLayer = (els: Element[], layerId: string) => els.filter((el) => el.layerId === layerId);

describe('incident postmortem', () => {
  const els = buildTemplate('incident-postmortem', 0, 0);

  it('names one worked Plateful incident with its severity and status', () => {
    const l = labels(els);
    expect(l).toContain('Plateful checkout outage · 14 Aug');
    expect(l).toContain('SEV-2');
    expect(l.some((s) => s.startsWith('Resolved'))).toBe(true);
  });

  it('opens with a summary, a Blameless reminder and a stat row of impact', () => {
    expect(labels(els)).toContain('Summary');
    const callout = shapesOf(els, 'callout')[0]!;
    expect(callout.pageTitle).toBe('Blameless');
    const stats = shapesOf(els, 'stat-row')[0]!.stats!;
    expect(stats.map((s) => s.caption)).toEqual([
      'Customer impact',
      'Peak error rate',
      'Failed checkouts',
      'Orders at risk',
    ]);
    expect(stats[0]!.value).toBe('81 min');
  });

  it('runs the timeline through five phases left to right, two timestamped cards each', () => {
    const phases = ['Trigger', 'Detection', 'Response', 'Mitigation', 'Resolution'];
    const heads = phases.map((p) => byLabel(els, p));
    for (let i = 1; i < heads.length; i++) expect(heads[i]!.x).toBeGreaterThan(heads[i - 1]!.x);
    const times = els.filter(
      (el) => el.type === 'text' && /^\d\d:\d\d/.test((el as { label?: string }).label ?? ''),
    ) as (Box & Element)[];
    expect(times).toHaveLength(10);
    // Timestamps read in order: column by column, top to bottom.
    const sorted = [...times].sort((a, b) => a.x - b.x || a.y - b.y);
    const clock = sorted.map((t) => (t as { label?: string }).label!.slice(0, 5));
    expect(clock).toEqual([...clock].sort());
    // Each phase tints its cards differently, and the tint survives a theme.
    const cards = shapesOf(els, 'square').filter((s) =>
      times.some((t) => inside(t, s) && s.width < 500),
    );
    expect(cards).toHaveLength(10);
    expect(new Set(cards.map((c) => c.fillColor)).size).toBe(5);
    expect(cards.every((c) => c.themeLockFill)).toBe(true);
  });

  it('brackets time to detect, mitigate and resolve from the moment impact began', () => {
    const spans = arrowsOf(els).filter((a) => /^Time to /.test(a.label ?? ''));
    expect(spans.map((a) => a.label)).toEqual([
      'Time to detect · 9 min',
      'Time to mitigate · 42 min',
      'Time to resolve · 81 min',
    ]);
    const starts = spans.map((a) => (a.from.kind === 'free' ? a.from.x : NaN));
    expect(new Set(starts).size).toBe(1);
    const ends = spans.map((a) => (a.to.kind === 'free' ? a.to.x : NaN));
    expect(ends[0]!).toBeLessThan(ends[1]!);
    expect(ends[1]!).toBeLessThan(ends[2]!);
    expect(spans.every((a) => a.arrowEnds === 'both')).toBe(true);
  });

  it('chains five whys down to a systemic root cause', () => {
    const whys = labels(els).filter((l) => /^Why\b/.test(l));
    expect(whys).toHaveLength(5);
    expect(labels(els)).toContain('Root cause');
    const chain = arrowsOf(els).filter((a) => a.from.kind === 'pinned' && a.to.kind === 'pinned');
    expect(chain).toHaveLength(5);
    expect(chain.every((a) => a.from.kind === 'pinned' && a.from.anchor === 's')).toBe(true);
  });

  it('files findings under three columns of stickies', () => {
    for (const title of ['Contributing factors', 'What went well', 'Where we got lucky'])
      expect(labels(els)).toContain(title);
    const notes = els.filter((el) => el.type === 'sticky');
    expect(notes).toHaveLength(9);
    expect(new Set(notes.map((n) => (n as { fillColor?: string }).fillColor)).size).toBe(3);
  });

  it('closes on prioritised action items, each with an owner, a due date and a ticket', () => {
    const table = tableOf(els);
    expect(table.cells[0]).toEqual(['Priority', 'Action', 'Owner', 'Due', 'Ticket']);
    const rows = table.cells.slice(1);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row[0]).toMatch(/^P[12]$/);
      expect(row[2]).toMatch(/ · /);
      expect(row[3]).toMatch(/^\d{1,2} (Aug|Sep)$/);
      expect(row[4]).toMatch(/^PLAT-\d{4}$/);
    }
    // P1s first.
    const ps = rows.map((r) => r[0]);
    expect(ps).toEqual([...ps].sort());
  });

  it('splits the reusable frame from the findings', () => {
    const scaffold = labels(onLayer(els, TEMPLATE_SCAFFOLD_LAYER_ID));
    const content = labels(onLayer(els, TEMPLATE_CONTENT_LAYER_ID));
    for (const l of ['Timeline', 'Five whys', 'Trigger', 'Contributing factors'])
      expect(scaffold).toContain(l);
    for (const l of ['SEV-2', 'Root cause', 'Plateful checkout outage · 14 Aug'])
      expect(content).toContain(l);
    expect(els.every((el) => el.layerId)).toBe(true);
  });

  it('keeps the three sections apart, top to bottom', () => {
    const summary = byLabel(els, 'Summary');
    const timeline = byLabel(els, 'Timeline');
    const whys = byLabel(els, 'Five whys');
    expect(timeline.y).toBeGreaterThan(summary.y);
    expect(whys.y).toBeGreaterThan(timeline.y);
    // Nothing boxed from the lower half reaches up into the timeline's spans.
    const spanBottom = Math.max(
      ...arrowsOf(els)
        .filter((a) => a.from.kind === 'free')
        .map((a) => (a.to.kind === 'free' ? a.to.y : 0)),
    );
    expect(whys.y).toBeGreaterThan(spanBottom);
  });
});

describe('risk matrix', () => {
  const els = buildTemplate('risk-matrix', 0, 0);
  const cells = shapesOf(els, 'square').filter((s) => /^\d+$/.test(s.label ?? ''));

  it('draws a 5 x 5 heatmap scored likelihood times impact, in five rows and columns', () => {
    expect(cells).toHaveLength(25);
    expect(new Set(cells.map((c) => c.x)).size).toBe(5);
    expect(new Set(cells.map((c) => c.y)).size).toBe(5);
    expect(cells.map((c) => Number(c.label)).sort((a, b) => a - b)).toEqual(
      [1, 2, 3, 4, 5].flatMap((l) => [1, 2, 3, 4, 5].map((i) => l * i)).sort((a, b) => a - b),
    );
    // Highest score top right, lowest bottom left.
    const top = cells.reduce((a, b) => (Number(b.label) > Number(a.label) ? b : a));
    const low = cells.reduce((a, b) => (Number(b.label) < Number(a.label) ? b : a));
    expect(top.x).toBeGreaterThan(low.x);
    expect(top.y).toBeLessThan(low.y);
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i]!, cells[j]!)).toBe(false);
  });

  it('shades by score and locks the shades against any theme', () => {
    expect(cells.every((c) => c.themeLockFill)).toBe(true);
    const fill = (score: number) => cells.find((c) => Number(c.label) === score)!.fillColor;
    expect(fill(1)).not.toBe(fill(25));
    expect(fill(4)).not.toBe(fill(20));
    const tab = buildTemplatedTab('risk-matrix', 'slate', 'tab-r', 'Risks');
    const themed = shapesOf(tab.elements, 'square').filter((s) => /^\d+$/.test(s.label ?? ''));
    expect(themed.map((c) => c.fillColor)).toEqual(cells.map((c) => c.fillColor));
  });

  it('names every axis step in words, with a legend of the four bands', () => {
    for (const step of [
      'Rare',
      'Unlikely',
      'Possible',
      'Likely',
      'Almost certain',
      'Negligible',
      'Minor',
      'Moderate',
      'Major',
      'Severe',
    ])
      expect(labels(els)).toContain(step);
    const legend = shapesOf(els, 'stadium').map((s) => s.label ?? '');
    for (const band of ['Low', 'Medium', 'High', 'Critical'])
      expect(legend.some((l) => l.startsWith(`${band} · `))).toBe(true);
  });

  it('sits R1 to R6 in the cells their scores name, and moves R1 to its residual', () => {
    const table = tableOf(els);
    const markers = shapesOf(els, 'circle').filter((c) => /^R\d$/.test(c.label ?? ''));
    expect(markers.map((m) => m.label).sort()).toEqual(['R1', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
    for (const row of table.cells.slice(1)) {
      const score = Number(row[2]!.split(' ')[0]);
      const solid = markers.find((m) => m.label === row[0] && m.strokeStyle !== 'dashed')!;
      const cell = cells.find((c) => contains(c, centre(solid)))!;
      expect(Number(cell.label), row[0]).toBe(score);
    }
    const ghost = markers.find((m) => m.strokeStyle === 'dashed')!;
    expect(ghost.label).toBe('R1');
    const residual = Number(table.cells[1]![2]!.split(' → ')[1]);
    expect(Number(cells.find((c) => contains(c, centre(ghost)))!.label)).toBe(residual);
    const move = arrowsOf(els).find((a) => a.strokeStyle === 'dashed')!;
    expect(move.to.kind === 'pinned' && move.to.elementId).toBe(ghost.id);
    expect(move.routeBehind).toBe(false);
  });

  it('lists the register highest score first, with owner, mitigation and trend', () => {
    const table = tableOf(els);
    expect(table.cells[0]).toEqual(['ID', 'Risk', 'Score', 'Owner', 'Mitigation', 'Trend']);
    const scores = table.cells.slice(1).map((r) => Number(r[2]!.split(' ')[0]));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const row of table.cells.slice(1)) expect(row[5]).toMatch(/Rising|Steady|Falling/);
  });

  it('keeps the grid on the Matrix layer and the risks on top', () => {
    expect(cells.every((c) => c.layerId === TEMPLATE_SCAFFOLD_LAYER_ID)).toBe(true);
    expect(tableOf(els).layerId).toBe(TEMPLATE_CONTENT_LAYER_ID);
    expect(shapesOf(els, 'session-button')[0]!.session).toEqual({ tool: 'vote', dots: 2 });
    // The register sits clear of the heatmap.
    const grid = cells.reduce(
      (b, c) => ({
        x: Math.min(b.x, c.x),
        y: Math.min(b.y, c.y),
        width: Math.max(b.x + b.width, c.x + c.width) - Math.min(b.x, c.x),
        height: Math.max(b.y + b.height, c.y + c.height) - Math.min(b.y, c.y),
      }),
      cells[0]! as Box,
    );
    expect(overlaps(tableOf(els), grid)).toBe(false);
  });
});
