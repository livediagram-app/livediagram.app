// The Work Tracker 1075 batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the C4 System Context and
// Container diagrams, the Architecture Decision Record, Sprint Planning and Interview Synthesis, each drawing what
// its catalogue entry promises.
import { describe, expect, it } from 'vitest';
import {
  layoutArrowLabels,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type StickyElement,
} from '@livediagram/document';
import { buildTemplate } from './build-template';
import { C4 } from './template-builders-c4';
import { templateCategory } from './template-categories';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { templateEditorMode } from './template-modes';
import { TEMPLATES, type TemplateKind } from './templates';

const shapes = (els: Element[], shape?: string) =>
  els.filter(
    (e): e is ShapeElement => e.type === 'shape' && (shape === undefined || e.shape === shape),
  );
const arrows = (els: Element[]) => els.filter((e): e is ArrowElement => e.type === 'arrow');
const stickies = (els: Element[]) => els.filter((e): e is StickyElement => e.type === 'sticky');
const tools = (els: Element[]) => shapes(els, 'session-button').map((b) => b.session?.tool);
const text = (els: Element[]) => els.map((e) => ('label' in e ? (e.label ?? '') : '')).join('\n');

const NEW: readonly [TemplateKind, string, string][] = [
  ['c4-context', 'C4 System Context', 'software'],
  ['c4-container', 'C4 Container Diagram', 'software'],
  ['c4-component', 'C4 Component Diagram', 'software'],
  ['architecture-decision-record', 'Architecture Decision Record', 'software'],
  ['sprint-planning', 'Sprint Planning', 'planning'],
  ['interview-synthesis', 'Interview Synthesis', 'product'],
];

describe.each(NEW)('the %s template', (kind, title, category) => {
  const els = buildTemplate(kind, 0, 0);

  it('is listed, titled and filed where its catalogue entry says', () => {
    expect(TEMPLATES.find((t) => t.kind === kind)).toMatchObject({ title, extra: true });
    expect(templateCategory(kind)).toBe(category);
  });

  it('draws real words on its own two layers', () => {
    expect(text(els)).not.toMatch(/lorem|ipsum|TODO|—/i);
    const layers = new Set(els.map((e) => e.layerId));
    expect(layers).toEqual(new Set([TEMPLATE_SCAFFOLD_LAYER_ID, TEMPLATE_CONTENT_LAYER_ID]));
  });
});

describe('the C4 diagrams', () => {
  it('draws the context as people and external systems around the one system in focus', () => {
    const els = buildTemplate('c4-context', 0, 0);
    const cards = shapes(els, 'card');
    const fills = cards.map((c) => c.fillColor);
    expect(fills.filter((f) => f === C4.system.fill)).toHaveLength(1);
    expect(fills.filter((f) => f === C4.person.fill).length).toBeGreaterThanOrEqual(3);
    expect(fills.filter((f) => f === C4.external.fill).length).toBeGreaterThanOrEqual(3);
    // Every relationship says what flows.
    for (const a of arrows(els)) expect(a.label, a.id).toBeTruthy();
  });

  // Work Tracker 1178: "Sends updates · REST" and "Prints tickets · webhook" wrapped with the protocol alone on the
  // second line. Measured at 12px system-ui (6.25px a character, as Chrome on macOS measures these labels).
  it('never leaves a context label protocol alone on a second line', () => {
    const els = buildTemplate('c4-context', 0, 0);
    const measureFor = (px: number) => (s: string) => (s.length * px * 6.25) / 12;
    const layouts = layoutArrowLabels(els, { measureFor });
    const lines = (label: string) => {
      const a = arrows(els).find((e) => e.label === label)!;
      return layouts.get(a.id)?.lines;
    };
    for (const label of [
      'Accepts orders · HTTPS',
      'Refunds orders · HTTPS',
      'Charges cards · REST',
      'Gets routes, ETAs · REST',
      'Sends updates · REST',
      'Prints tickets · webhook',
    ])
      expect(lines(label), label).toEqual([label]);
    for (const a of arrows(els)) {
      const last = layouts.get(a.id)?.lines.at(-1) ?? '';
      expect(last, a.label).not.toMatch(/^·?\s*(HTTPS|REST|webhook)$/);
    }
  });

  it('opens the system into containers inside its boundary, the order path moving', () => {
    const els = buildTemplate('c4-container', 0, 0);
    expect(shapes(els, 'boundary').length + shapes(els, 'frame').length).toBeGreaterThan(0);
    const types = shapes(els, 'card').map((c) => c.pageSubtitle);
    expect(types).toEqual(expect.arrayContaining(['React Native', 'Node.js', 'Go']));
    expect(arrows(els).filter((a) => a.flow === 'dots').length).toBeGreaterThanOrEqual(3);
    // The boundary is drawn the C4 way: its name and type at its foot.
    expect(shapes(els, 'boundary')[0]).toMatchObject({
      boundaryStyle: 'c4',
      label: 'Plateful Ordering Platform',
    });
  });

  it('opens the Order service into components inside its container boundary, with the C4 key', () => {
    const els = buildTemplate('c4-component', 0, 0);
    const [boundary] = shapes(els, 'boundary');
    expect(boundary).toMatchObject({ boundaryStyle: 'c4', label: 'Order service' });
    const components = shapes(els, 'card').filter((c) => c.fillColor === C4.component.fill);
    expect(components).toHaveLength(6);
    // Every component says what it does and what it is built with, and sits inside the boundary.
    for (const c of components) {
      expect(c.label, c.pageTitle).toBeTruthy();
      expect(c.pageSubtitle, c.pageTitle).toBeTruthy();
      expect(c.x).toBeGreaterThanOrEqual(boundary!.x);
      expect(c.x + c.width).toBeLessThanOrEqual(boundary!.x + boundary!.width);
      expect(c.y).toBeGreaterThanOrEqual(boundary!.y);
      expect(c.y + c.height).toBeLessThanOrEqual(boundary!.y + boundary!.height);
    }
    expect(shapes(els, 'cylinder')).toHaveLength(2);
    for (const a of arrows(els)) expect(a.label, a.id).toBeTruthy();
    expect(text(els)).toMatch(/Key/);
  });
});

describe('the Architecture Decision Record', () => {
  const els = buildTemplate('architecture-decision-record', 0, 0);

  it('states its status, weighs its options in a table and lists what follows', () => {
    expect(text(els)).toContain('Accepted');
    const table = els.find((e) => e.type === 'table') as { cells: string[][] } | undefined;
    expect(table!.cells.length).toBeGreaterThanOrEqual(3);
    expect(shapes(els, 'checklist')).toHaveLength(1);
    expect(stickies(els).length).toBeGreaterThanOrEqual(3);
  });

  it('sketches the change: the after lines move, the before ones do not', () => {
    const moving = arrows(els).filter((a) => a.flow === 'dots');
    expect(moving.length).toBeGreaterThan(0);
    expect(arrows(els).length).toBeGreaterThan(moving.length);
  });
});

describe('the Workshop boards', () => {
  it('plans a sprint against capacity, with a timer and a vote', () => {
    const els = buildTemplate('sprint-planning', 0, 0);
    expect(templateEditorMode('sprint-planning')).toBe('workshop');
    expect(shapes(els, 'stat-row')).toHaveLength(1);
    expect(tools(els)).toEqual(expect.arrayContaining(['timer', 'vote']));
    expect(text(els)).toMatch(/Committed/);
    expect(text(els)).toMatch(/Stretch/);
    expect(shapes(els, 'checklist').length).toBeGreaterThan(0);
  });

  it('synthesises five interviews into three themes, each ending in a question to vote on', () => {
    const els = buildTemplate('interview-synthesis', 0, 0);
    expect(templateEditorMode('interview-synthesis')).toBe('workshop');
    const people = shapes(els, 'card').filter((c) => c.cardMedia === 'initial');
    expect(people).toHaveLength(5);
    const hmw = stickies(els).filter((s) => s.label?.startsWith('How might we'));
    expect(hmw).toHaveLength(3);
    // Each quote is tinted by who said it: one of the five participants' colours.
    const tints = new Set(people.map((p) => p.fillColor));
    const quotes = stickies(els).filter((s) => s.label?.includes('“'));
    expect(quotes).toHaveLength(9);
    for (const q of quotes) expect(tints.has(q.fillColor), q.label).toBe(true);
    expect(tools(els)).toEqual(expect.arrayContaining(['timer', 'vote']));
  });
});
