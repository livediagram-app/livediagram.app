import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { buildTemplate } from './template-builders';

// Structure pins for the Roadmap (docs/specs/008-canvas/canvas-and-palette.md "Templates"). Each test maps to a
// sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Text = Extract<Element, { type: 'text' }>;

const shapesOf = (els: Element[], shape: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && el.shape === shape);
const textsOf = (els: Element[]) => els.filter((el): el is Text => el.type === 'text');
const text = (els: Element[], label: string) => textsOf(els).find((t) => t.label === label)!;
const inside = (
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const stickers = (els: Element[]) => shapesOf(els, 'sticker').map((s) => s.stickerId);

describe('roadmap template', () => {
  const els = buildTemplate('roadmap', 0, 0);
  const lanes = shapesOf(els, 'lane');
  const cards = shapesOf(els, 'square');

  it('states one goal in a pill with a target glyph', () => {
    const goal = shapesOf(els, 'stadium')[0]!;
    expect(goal.label).toMatch(/^Goal: /);
    expect(goal.iconId).toBe('target');
  });

  it('gives each horizon a confidence meter that empties with distance', () => {
    const dots = shapesOf(els, 'circle');
    expect(dots).toHaveLength(9);
    const filled = [0, 1, 2].map(
      (h) => dots.slice(h * 3, h * 3 + 3).filter((d) => d.fillColor === '#334155').length,
    );
    expect(filled).toEqual([3, 2, 1]);
    for (const h of ['Now', 'Next', 'Later']) expect(text(els, h)).toBeTruthy();
  });

  it('runs three theme swimlanes as lane elements, one card per horizon', () => {
    expect(lanes.map((l) => l.label)).toEqual(['Activation', 'Collaboration', 'Reliability']);
    expect(cards).toHaveLength(9);
    for (const lane of lanes) {
      expect(cards.filter((c) => inside(c, lane))).toHaveLength(3);
    }
  });

  it('pairs every initiative with the outcome it should move', () => {
    for (const card of cards) {
      expect(textsOf(els).filter((t) => inside(t, card))).toHaveLength(2);
    }
    expect(text(els, 'Day-1 activation 38% → 50%')).toBeTruthy();
  });

  it('encodes confidence in the card border: thick, normal, then dashed', () => {
    const columnXs = [...new Set(cards.map((c) => c.x))].sort((a, b) => a - b);
    expect(columnXs).toHaveLength(3);
    const col = (i: number) => cards.filter((c) => c.x === columnXs[i]);
    expect(col(0).every((c) => c.strokeWidth === 'thick')).toBe(true);
    expect(col(1).every((c) => c.strokeStyle === 'solid' && c.strokeWidth === 'medium')).toBe(true);
    expect(col(2).every((c) => c.strokeStyle === 'dashed')).toBe(true);
  });

  it('stickers a status on each Now card', () => {
    expect(stickers(els).sort()).toEqual(['badge-at-risk', 'badge-shipped', 'badge-wip']);
  });
});
