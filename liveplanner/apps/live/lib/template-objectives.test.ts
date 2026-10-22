import { describe, expect, it } from 'vitest';
import { isValidElement, type Element } from '@liveplanner/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from '@liveplanner/templates';
import { buildTemplate } from './template-builders';

// Structure pins for the Objectives planner
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). Each test maps to
// a sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Text = Extract<Element, { type: 'text' }>;
type Box = { x: number; y: number; width: number; height: number };

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);
const textsOf = (els: Element[]) => els.filter((el): el is Text => el.type === 'text');
const labels = (els: Element[]) =>
  els.map((el) => ('label' in el ? el.label : undefined)).filter(Boolean) as string[];
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const expectDisjoint = (boxes: Box[]) => {
  boxes.forEach((a, i) =>
    boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b), JSON.stringify([a, b])).toBe(false)),
  );
};

describe('objectives planner template', () => {
  const els = buildTemplate('objectives-planner', 0, 0);
  const scaffold = els.filter((el) => el.layerId === TEMPLATE_SCAFFOLD_LAYER_ID);
  const content = els.filter((el) => el.layerId === TEMPLATE_CONTENT_LAYER_ID);
  const cards = shapesOf(scaffold, 'square').filter((s) => s.strokeWidth === 'medium');
  const sentences = textsOf(content).filter((t) => t.label?.startsWith('I will'));

  it('is a personal plan for the half', () => {
    expect(labels(els)).toContain('Alex’s objectives · H2 2026');
  });

  it('starts with why: a focus, strengths to build on and areas to grow', () => {
    const [focus] = shapesOf(els, 'card');
    expect(focus!.pageTitle).toBe('My focus for the half');
    for (const l of ['Strengths to build on', 'Areas to grow'])
      expect(labels(scaffold)).toContain(l);
    expect(els.filter((el) => el.type === 'sticky')).toHaveLength(6);
  });

  it('teaches the sentence formula part by part, and a SMART test', () => {
    const chips = shapesOf(scaffold, 'stadium').map((s) => s.label);
    expect(chips).toEqual(['I will …', 'by …', 'measured by …', 'so that …']);
    const smart = shapesOf(scaffold, 'checklist')[0]!;
    expect(smart.checklistItems!.map((i) => i.text[0]).join('')).toBe('SMART');
    // The worked rewrite: a vague draft struck through over the formula.
    const before = textsOf(scaffold).find((t) => t.label?.startsWith('Before'))!;
    expect(before.richText!.some((r) => r.strikethrough)).toBe(true);
  });

  it('writes three objectives with the formula, in the guide’s own inks', () => {
    expect(sentences).toHaveLength(3);
    const leadInks = (t: Text) =>
      t.richText!.filter((r) => r.bold).map((r) => `${r.text}:${r.color}`);
    const guideAfter = textsOf(scaffold).find((t) => t.label?.startsWith('After'))!;
    const expected = leadInks(guideAfter).slice(1);
    expect(expected).toHaveLength(4);
    for (const s of sentences) {
      expect(s.label).toMatch(/^I will .+, by .+, measured by .+, so that .+\.$/);
      expect(leadInks(s)).toEqual(expected);
    }
  });

  it('balances the set across three life areas, one card each', () => {
    const areas = shapesOf(content, 'stadium').map((s) => s.label);
    expect(areas).toEqual(expect.arrayContaining(['Craft', 'Leadership', 'Wellbeing']));
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.strokeColor)).size).toBe(3);
    expectDisjoint(cards);
    // Everything an objective carries sits on its card.
    for (const s of sentences) expect(cards.some((c) => inside(s, c))).toBe(true);
  });

  it('gives each objective two key results, first steps, support and a confidence', () => {
    const bars = shapesOf(content, 'progress-bar');
    expect(bars).toHaveLength(6);
    for (const b of bars) {
      expect(b.progress).toBeGreaterThan(0);
      expect(b.progress).toBeLessThan(100);
    }
    const steps = shapesOf(content, 'checklist');
    expect(steps).toHaveLength(3);
    for (const s of steps) expect(s.checklistItems).toHaveLength(3);
    expect(labels(scaffold).filter((l) => l === 'Support I need')).toHaveLength(3);
    const ratings = shapesOf(content, 'rating');
    expect(ratings.map((r) => r.rating)).toEqual([4, 3, 2]);
    for (const c of cards) {
      expect(bars.filter((b) => inside(b, c))).toHaveLength(2);
      expect(ratings.filter((r) => inside(r, c))).toHaveLength(1);
    }
  });

  it('closes on a check-in rhythm with today marked', () => {
    const stops = textsOf(scaffold).map((t) => t.label ?? '');
    for (const s of ['Set', 'Monthly check-ins', 'Mid-point review', 'Reflect'])
      expect(stops.some((l) => l.startsWith(`${s}  `))).toBe(true);
    expect(labels(content)).toContain('Today, 30 Sep');
  });

  it('builds only valid elements, every one on a band', () => {
    expect(scaffold.length + content.length).toBe(els.length);
    for (const el of els) expect(isValidElement(el), JSON.stringify(el)).toBe(true);
  });
});
