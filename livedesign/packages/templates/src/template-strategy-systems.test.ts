// The strategy and systems batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"; the companion Sheets in
// docs/specs/026-plan/plan-templates.md "How a template with tabs is made"): each drawing agrees with the data it is
// built from, the companion Sheets are made on every path, and the layouts keep what they hold where it belongs.
import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, ShapeElement, StickyElement } from '@livepages/document';
import {
  DRIVER_BASELINE,
  THREAT_EXAMPLES,
  VALUE_STREAM_STEPS,
  driverTree,
  threatRating,
  valueStreamTotals,
} from '@livepages/sheets';
import { buildTemplate, templateTabs } from './build-template';
import { buildTemplateTabs } from './template-tab';
import { materialiseTemplateSheets } from './template-sheets';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { RATING_COLOURS } from './template-builders-threat-model';
import { NORTH_STAR_GOAL } from './template-builders-metric-tree';
import { TEMPLATE_COMPANION_SHEETS } from './template-companions';
import { WARDLEY_COMPONENTS, WARDLEY_NEEDS } from './template-wardley-data';
import { BLUEPRINT_CARDS, BLUEPRINT_MARKS } from './template-service-blueprint-data';

const shapes = (els: Element[], kind?: string) =>
  els.filter(
    (e): e is ShapeElement => e.type === 'shape' && (kind === undefined || e.shape === kind),
  );
const arrows = (els: Element[]) => els.filter((e): e is ArrowElement => e.type === 'arrow');
const byId = (els: Element[]) => new Map(els.map((e) => [e.id, e]));
const pinnedIds = (a: ArrowElement) => [
  a.from.kind === 'pinned' ? a.from.elementId : null,
  a.to.kind === 'pinned' ? a.to.elementId : null,
];

describe('companion Sheets', () => {
  const companions = Object.keys(
    TEMPLATE_COMPANION_SHEETS,
  ) as (keyof typeof TEMPLATE_COMPANION_SHEETS)[];

  it.each(companions)('%s makes its drawing, then a Sheet tab of its own canvas', (kind) => {
    const c = TEMPLATE_COMPANION_SHEETS[kind];
    const defs = templateTabs(kind);
    expect(defs.map((d) => d.name)).toEqual([c.diagram, c.sheet]);
    expect(defs[0]!.ownCanvas).toBeUndefined();
    expect(defs[1]!.ownCanvas).toBe(true);
    const [sheet] = defs[1]!.build(0, 0) as ShapeElement[];
    expect(sheet).toMatchObject({
      shape: 'plan-sheet',
      planSheet: { start: c.start, fillTab: true },
    });
    expect(defs[1]!.tab!(['a', 'b'])).toEqual({ kind: 'sheet', opensIn: 'plan' });
  });

  it.each(companions)('%s: an agent’s create makes both tabs, the sheet beside them', (kind) => {
    let n = 0;
    const tabs = buildTemplateTabs({ id: 't1', name: 'Model' }, kind, () => `t${++n + 1}`);
    expect(tabs).toHaveLength(2);
    const [drawing, sheetTab] = tabs;
    // The drawing keeps the template's canvas; the Sheet tab takes none of it.
    expect(drawing!.layers).toEqual(templateCanvasOverrides(kind).layers);
    expect(drawing!.backgroundPattern).toBe('graph');
    expect(sheetTab).toMatchObject({
      kind: 'sheet',
      opensIn: 'plan',
      name: TEMPLATE_COMPANION_SHEETS[kind].sheet,
    });
    expect(sheetTab!.layers).toBeUndefined();
    expect(sheetTab!.backgroundPattern).not.toBe('graph');
    const { sheets } = materialiseTemplateSheets(tabs, Date.UTC(2026, 9, 8));
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.tabId).toBe(sheetTab!.id);
  });
});

describe('the Threat model', () => {
  const els = buildTemplate('threat-model', 0, 0);
  const ids = byId(els);
  const badges = shapes(els, 'badge');

  it('marks every register threat once, in its rating’s colours, on what it threatens', () => {
    for (const t of THREAT_EXAMPLES) {
      const fill = RATING_COLOURS[threatRating(t.likelihood * t.impact)].fill;
      const mine = badges.filter((b) => b.label === t.id);
      for (const b of mine) expect(b.fillColor, t.id).toBe(fill);
      if (t.element.includes('→')) {
        // A threat to a flow sits loose by its line (an arrow is no host).
        expect(mine.length, t.id).toBeGreaterThanOrEqual(1);
        continue;
      }
      const attached = mine.filter((b) => b.attachedTo);
      expect(attached, t.id).toHaveLength(1);
      expect((ids.get(attached[0]!.attachedTo!) as ShapeElement).label).toBe(t.element);
    }
  });

  it('draws every flow between two drawn nodes, inside named trust boundaries', () => {
    for (const a of arrows(els))
      for (const id of pinnedIds(a)) expect(id && ids.has(id)).toBe(true);
    expect(shapes(els, 'boundary').map((b) => b.label)).toEqual([
      'Internet',
      'Plateful VPC',
      'PCI zone',
    ]);
  });
});

describe('the Metric tree', () => {
  const els = buildTemplate('metric-tree', 0, 0);
  it('shows the Driver Model’s own figures and its progress to the goal', () => {
    const t = driverTree(DRIVER_BASELINE);
    const labels = shapes(els).map((s) => s.label ?? '');
    const num = (v: number) => Math.round(v).toLocaleString('en-GB');
    for (const v of [num(t.northStar), num(t.actives), num(t.newCustomers), num(t.returning)])
      expect(
        labels.some((l) => l.includes(v)),
        v,
      ).toBe(true);
    expect(labels.some((l) => l.includes(`${(t.onTimeRate * 100).toFixed(1)}%`))).toBe(true);
    expect(shapes(els, 'progress-ring')[0]!.progress).toBe(
      Math.round((t.northStar / NORTH_STAR_GOAL) * 100),
    );
  });
});

describe('the Value stream map', () => {
  const els = buildTemplate('value-stream-map', 0, 0);
  it('puts every step, its queue and its rungs on the map, and the totals at the ladder’s end', () => {
    const text = [...shapes(els), ...els.filter((e) => e.type === 'text')].map((e) =>
      'label' in e ? (e.label ?? '') : '',
    );
    for (const s of VALUE_STREAM_STEPS) {
      expect(text).toContain(s.step);
      expect(text).toContain(String(s.queued));
    }
    const t = valueStreamTotals();
    const totals = text.find((l) => l.startsWith('Totals'))!;
    expect(totals).toContain(`Lead time  ${t.leadDays} d`);
    expect(totals).toContain(`Flow efficiency  ${Math.round(t.flowEfficiency * 100)}%`);
  });
});

describe('the Wardley map', () => {
  const els = buildTemplate('wardley-map', 0, 0);
  const chips = shapes(els, 'stadium').filter((s) =>
    WARDLEY_COMPONENTS.some((c) => c.label === s.label),
  );

  it('draws each component once as a chip and each need as a head-less line between two of them', () => {
    expect(chips.map((c) => c.label).sort()).toEqual(WARDLEY_COMPONENTS.map((c) => c.label).sort());
    const chipIds = new Set(chips.map((c) => c.id));
    const needs = arrows(els).filter(
      (a) => a.arrowEnds === 'none' && pinnedIds(a).every((id) => id && chipIds.has(id)),
    );
    expect(needs).toHaveLength(WARDLEY_NEEDS.length);
  });

  it('keeps no two chips overlapping', () => {
    for (let i = 0; i < chips.length; i++)
      for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i]!;
        const b = chips[j]!;
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `${a.label} / ${b.label}`).toBe(true);
      }
  });
});

describe('the Service blueprint', () => {
  const els = buildTemplate('service-blueprint', 0, 0);
  it('has every card, and each mark attached to the card it marks', () => {
    const cards = shapes(els, 'square');
    for (const labels of Object.values(BLUEPRINT_CARDS))
      for (const l of labels)
        expect(
          cards.some((c) => c.label === l),
          l,
        ).toBe(true);
    const ids = byId(els);
    const marks = shapes(els, 'badge').filter((b) => b.attachedTo);
    expect(marks).toHaveLength(BLUEPRINT_MARKS.length);
    for (const m of marks) expect(ids.has(m.attachedTo!)).toBe(true);
  });
});

describe('the Value Proposition Canvas', () => {
  const els = buildTemplate('value-proposition-canvas', 0, 0);
  const circle = shapes(els, 'circle').find((c) => c.width > 400)!;
  const notes = els.filter((e): e is StickyElement => e.type === 'sticky');

  it('keeps every Customer Profile note wholly inside its circle', () => {
    const r = circle.width / 2;
    const cx = circle.x + r;
    const cy = circle.y + r;
    const inside = notes.filter((n) => n.x >= circle.x && n.x <= circle.x + circle.width);
    expect(inside.length).toBe(12);
    for (const n of inside)
      for (const [x, y] of [
        [n.x, n.y],
        [n.x + n.width, n.y],
        [n.x, n.y + n.height],
        [n.x + n.width, n.y + n.height],
      ] as const)
        expect(Math.hypot(x - cx, y - cy), n.label).toBeLessThan(r);
  });

  it('joins each fit line from a note in the Value Map to a note in the profile', () => {
    const noteIds = new Set(notes.map((n) => n.id));
    const fits = arrows(els).filter((a) => a.arrowEnds === 'both');
    expect(fits).toHaveLength(4);
    for (const f of fits) for (const id of pinnedIds(f)) expect(noteIds.has(id!)).toBe(true);
  });
});

describe('the Family tree', () => {
  const els = buildTemplate('family-tree', 0, 0);
  it('has every person once, and every line between two things on the tree', () => {
    const names = shapes(els, 'card').map((c) => c.pageTitle);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(14);
    const ids = byId(els);
    for (const a of arrows(els))
      for (const id of pinnedIds(a)) if (id) expect(ids.has(id)).toBe(true);
  });
});
