import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { buildTemplate } from './template-builders';

// Structure pins for the user journey (docs/specs/008-canvas/canvas-and-palette.md "Templates"). Each test maps to
// a sentence of that spec.

const texts = (els: Element[]) =>
  els.filter((el) => el.type === 'text').map((el) => (el as { label?: string }).label ?? '');
const shapesOf = (els: Element[], shape: string) =>
  els.filter((el) => el.type === 'shape' && el.shape === shape) as Extract<
    Element,
    { type: 'shape' }
  >[];

describe('user journey template', () => {
  const els = buildTemplate('journey', 0, 0);
  const stickies = els.filter((el) => el.type === 'sticky');
  const faces = shapesOf(els, 'sticker');

  it('lays five numbered stages across the top', () => {
    const stages = shapesOf(els, 'stadium').map((s) => s.label);
    expect(stages).toEqual([
      '1  Discover',
      '2  Compare',
      '3  Book',
      '4  First class',
      '5  Come back',
    ]);
  });

  it('colours each lens row of stickies with its own fill', () => {
    // Doing / Thinking / Pain points / Opportunities: five stickies each.
    expect(stickies).toHaveLength(20);
    const fills = new Set(stickies.map((s) => s.fillColor));
    expect(fills.size).toBe(4);
    for (const f of fills) expect(stickies.filter((s) => s.fillColor === f)).toHaveLength(5);
    const t = texts(els);
    for (const row of ['Doing', 'Thinking', 'Feeling', 'Pain points', 'Opportunities'])
      expect(t).toContain(row);
  });

  it('draws the feeling curve through five emoji faces, dipping at the booking', () => {
    expect(faces).toHaveLength(5);
    expect(faces.every((f) => f.stickerId?.startsWith('emoji-'))).toBe(true);
    const ys = faces.map((f) => f.y);
    // Lower on the canvas = a worse mood; the painful sign-up is the low point.
    expect(ys.indexOf(Math.max(...ys))).toBe(2);
    const ids = new Set(faces.map((f) => f.id));
    const curve = els.filter(
      (el) =>
        el.type === 'arrow' &&
        el.from.kind === 'pinned' &&
        el.to.kind === 'pinned' &&
        ids.has(el.from.elementId) &&
        ids.has(el.to.elementId),
    );
    expect(curve).toHaveLength(4);
  });
});
