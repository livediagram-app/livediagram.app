import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { buildTemplate } from './template-builders';

// Structure pins for the strategy starters redesigned together
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Business Model
// Canvas, funnel, flywheel, comparison table and RACI matrix. Each test maps
// to a sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Table = Extract<Element, { type: 'table' }>;
type Box = { x: number; y: number; width: number; height: number };

const texts = (els: Element[]) =>
  els.filter((el) => el.type === 'text') as Extract<Element, { type: 'text' }>[];
const labels = (els: Element[]) =>
  els.map((el) => ('label' in el ? (el.label ?? '') : '')).filter(Boolean);
const shapesOf = (els: Element[], shape: string) =>
  els.filter((el) => el.type === 'shape' && el.shape === shape) as Shape[];
const stickies = (els: Element[]) => els.filter((el) => el.type === 'sticky');
const tableOf = (els: Element[]) => els.find((el) => el.type === 'table') as Table;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe('business model canvas template', () => {
  const els = buildTemplate('business-model-canvas', 0, 0);
  const t = texts(els);
  const BLOCKS = [
    'Key Partners',
    'Key Activities',
    'Key Resources',
    'Value Propositions',
    'Customer Relationships',
    'Channels',
    'Customer Segments',
    'Cost Structure',
    'Revenue Streams',
  ];
  const header = (title: string) => t.find((el) => el.label === title)!;
  const containerOf = (title: string) =>
    shapesOf(els, 'square').find((s) => inside(header(title), s))!;

  it('puts the chrome on the Canvas layer and the title, notes and sticker on Notes', () => {
    const on = (id: string) => els.filter((el) => el.layerId === id).length;
    expect(on('layer:template:scaffold')).toBe(41);
    expect(on('layer:template:content')).toBe(25);
    expect(els.every((el) => el.layerId)).toBe(true);
  });

  it('keeps the nine Osterwalder blocks, none overlapping', () => {
    const containers = BLOCKS.map(containerOf);
    expect(new Set(containers).size).toBe(9);
    for (let i = 0; i < containers.length; i++)
      for (let j = i + 1; j < containers.length; j++)
        expect(overlaps(containers[i]!, containers[j]!)).toBe(false);
  });

  it('sizes every header so "Customer Relationships" sits on one line', () => {
    // 22 characters of 22px bold Inter measure about 290px.
    for (const title of BLOCKS) expect(header(title).width).toBeGreaterThanOrEqual(290);
  });

  it('colours blocks by area, keyed by four chips on the title row', () => {
    const fill = (title: string) => containerOf(title).fillColor;
    expect(fill('Key Partners')).toBe(fill('Key Activities'));
    expect(fill('Key Activities')).toBe(fill('Key Resources'));
    expect(fill('Customer Relationships')).toBe(fill('Channels'));
    expect(fill('Channels')).toBe(fill('Customer Segments'));
    expect(fill('Cost Structure')).toBe(fill('Revenue Streams'));
    const areas = new Set(BLOCKS.map(fill));
    expect(areas.size).toBe(4);
    const keys = shapesOf(els, 'stadium');
    expect(keys.map((k) => k.label)).toEqual(['Infrastructure', 'Offer', 'Customers', 'Finances']);
    expect(keys.every((k) => k.themeLockFill)).toBe(true);
  });

  it('seeds every block with sticky notes in its own hue', () => {
    for (const title of BLOCKS) {
      const box = containerOf(title);
      const notes = stickies(els).filter((s) => inside(s, box));
      expect(notes.length, title).toBeGreaterThanOrEqual(2);
      expect(new Set(notes.map((n) => n.fillColor)).size, title).toBe(1);
    }
  });

  it('makes the value proposition the heart: thick border, big note, sticker', () => {
    const vp = containerOf('Value Propositions');
    expect(vp.strokeWidth).toBe('thick');
    const notes = stickies(els).filter((s) => inside(s, vp));
    expect(notes[0]!.textSize).toBe('md');
    expect(notes[0]!.height).toBeGreaterThan(notes[1]!.height);
    const sticker = shapesOf(els, 'sticker')[0]!;
    expect(inside(sticker, vp)).toBe(true);
    for (const n of notes) expect(overlaps(n, sticker)).toBe(false);
  });

  it('numbers the blocks 1..9 in fill order, customers first and costs last', () => {
    const chips = shapesOf(els, 'circle');
    expect(chips.map((c) => Number(c.label)).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    const chipFor = (title: string) => {
      const box = containerOf(title);
      return chips.find((c) => overlaps(c, { ...box, width: 1, height: 1 }))!;
    };
    expect(chipFor('Customer Segments').label).toBe('1');
    expect(chipFor('Value Propositions').label).toBe('2');
    expect(chipFor('Cost Structure').label).toBe('9');
    // A chip rides the corner, clear of every header.
    for (const c of chips)
      for (const title of BLOCKS) expect(overlaps(c, header(title))).toBe(false);
  });
});

describe('funnel template', () => {
  const els = buildTemplate('funnel', 0, 0);
  const l = labels(els);
  const chips = shapesOf(els, 'stadium').filter((s) => s.label?.includes('move on'));

  it('ramps four tiers from a pale mouth to a saturated tip, theme-locked', () => {
    const tiers = shapesOf(els, 'trapezoid');
    expect(tiers).toHaveLength(4);
    expect(tiers.every((s) => s.themeLockFill && s.rotation === 180)).toBe(true);
    expect(new Set(tiers.map((s) => s.fillColor)).size).toBe(4);
  });

  it('derives each step rate from the counts', () => {
    expect(chips.map((c) => c.label)).toEqual(['↓ 25% move on', '↓ 30% move on', '↓ 23% move on']);
    expect(l).toContain('1.7% of visitors become customers');
  });

  it('wires the weakest step to a drop-off callout with experiments', () => {
    const worst = chips.find((c) => c.fillColor === '#ffe4e6')!;
    expect(worst.label).toContain('23%');
    const arrow = els.find((el) => el.type === 'arrow')!;
    expect(arrow.type === 'arrow' && arrow.from.kind === 'pinned' && arrow.from.elementId).toBe(
      worst.id,
    );
    expect(l).toContain('Biggest drop-off');
    const list = shapesOf(els, 'checklist')[0]!;
    expect(list.checklistItems).toHaveLength(3);
    // Each experiment names an owner.
    for (const item of list.checklistItems!) expect(item.text).toMatch(/ · [A-Z][a-z]+$/);
  });
});

describe('flywheel template', () => {
  const els = buildTemplate('flywheel', 0, 0);
  const circles = shapesOf(els, 'circle');
  const hub = circles.find((c) => c.label === 'Momentum')!;
  const stages = circles.filter((c) => c !== hub);

  it('spins the hub glyph and tints each stage its own locked hue', () => {
    expect(hub.iconId).toBe('refresh-cw');
    expect(hub.iconAnimation).toBe('spin');
    expect(stages).toHaveLength(4);
    expect(stages.every((s) => s.themeLockFill && s.iconId)).toBe(true);
    expect(new Set(stages.map((s) => s.fillColor)).size).toBe(4);
  });

  it('closes a clockwise loop of flowing pinned arrows', () => {
    const arrows = els.filter((el) => el.type === 'arrow');
    expect(arrows).toHaveLength(4);
    const ids = stages.map((s) => s.id);
    arrows.forEach((a, i) => {
      if (a.type !== 'arrow') throw new Error('arrow');
      expect(a.flow).toBe('dashes');
      expect(a.from.kind === 'pinned' && a.from.elementId).toBe(ids[i]);
      expect(a.to.kind === 'pinned' && a.to.elementId).toBe(ids[(i + 1) % 4]);
    });
  });

  it('gives every stage a metric and names a push and a friction', () => {
    expect(texts(els).filter((t) => t.textBold && t.textSize === 'sm')).toHaveLength(4);
    const notes = stickies(els).map((s) => s.label ?? '');
    expect(notes.some((n) => n.startsWith('Push'))).toBe(true);
    expect(notes.some((n) => n.startsWith('Friction'))).toBe(true);
    for (const s of stickies(els)) for (const c of circles) expect(overlaps(s, c)).toBe(false);
  });
});

describe('comparison table template', () => {
  const els = buildTemplate('comparison-table', 0, 0);
  const table = tableOf(els);

  it('scores yes / no rows with a green tick and a muted cross', () => {
    const flat = table.cells.flat();
    expect(flat).toContain('✓');
    expect(flat).toContain('✗');
    table.cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell === '✓') expect(table.cellStyles![r]![c]!.textColor).toBe('#16a34a');
        if (cell === '✗') expect(table.cellStyles![r]![c]!.textColor).toBe('#94a3b8');
      }),
    );
  });

  it('highlights the recommended plan under an "Our pick" ribbon', () => {
    const pick = table.cells[0]!.indexOf('Team');
    for (let r = 0; r < table.cells.length; r++) {
      expect(table.cellStyles![r]![pick]!.bg).toBeTruthy();
      expect(table.cellStyles![r]![pick]!.textColor).toBeTruthy();
    }
    const ribbon = shapesOf(els, 'stadium').find((s) => s.label === '★ Our pick')!;
    expect(ribbon.themeLockFill).toBe(true);
    expect(ribbon.y + ribbon.height).toBeLessThanOrEqual(table.y);
    const colX =
      table.x + table.colWidths![0]! + ((table.width - table.colWidths![0]!) / 3) * (pick - 1);
    expect(ribbon.x).toBeGreaterThanOrEqual(colX);
  });

  it('does the sum for the team and explains the pick on a sticky', () => {
    expect(table.cells.map((r) => r[0])).toContain('Cost for 14 seats');
    expect(stickies(els)[0]!.label).toMatch(/^Why Team/);
  });
});

describe('raci matrix template', () => {
  const els = buildTemplate('raci-matrix', 0, 0);
  const table = tableOf(els);
  const body = table.cells.slice(1);

  it('assigns exactly one A per row and at least one R', () => {
    for (const row of body) {
      expect(row.slice(1).filter((c) => c.startsWith('A'))).toHaveLength(1);
      expect(row.slice(1).some((c) => c.includes('R'))).toBe(true);
    }
  });

  it('tints every letter cell by its letter, A/R taking the A tint', () => {
    const tintOf: Record<string, string> = {};
    body.forEach((row, i) =>
      row.slice(1).forEach((cell, j) => {
        const style = table.cellStyles![i + 1]![j + 1]!;
        expect(style.bg).toBeTruthy();
        expect(style.textColor).toBeTruthy();
        const letter = cell.charAt(0);
        tintOf[letter] ??= style.bg!;
        expect(style.bg).toBe(tintOf[letter]);
      }),
    );
    expect(Object.keys(tintOf).sort()).toEqual(['A', 'C', 'I', 'R']);
  });

  it('spells each letter out in a legend card in the same tint', () => {
    const cards = shapesOf(els, 'square');
    expect(cards).toHaveLength(4);
    expect(cards.every((c) => c.themeLockFill)).toBe(true);
    const l = labels(els);
    for (const chip of ['R · Responsible', 'A · Accountable', 'C · Consulted', 'I · Informed'])
      expect(l).toContain(chip);
    const aCell = table.cellStyles![2]![1]!; // "Design the onboarding" / Product: A
    expect(cards.map((c) => c.fillColor)).toContain(aCell.bg);
  });

  it('lists the row checks beside the grid', () => {
    const list = shapesOf(els, 'checklist')[0]!;
    expect(list.checklistItems!.map((i) => i.text)).toContain('Every row has exactly one A');
    expect(list.x).toBeGreaterThan(table.x + table.width);
  });
});
