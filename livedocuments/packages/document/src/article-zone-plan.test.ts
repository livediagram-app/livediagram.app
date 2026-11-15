import { describe, expect, it } from 'vitest';
import { isDrawingElement, withElementsIntoZone, type ZonePlan } from './article-zone-plan';
import type { Element } from './index';

const el = (extra: object) => ({ id: 'e', ...extra }) as unknown as Element;
const box = (id: string, x: number, y: number, w = 100, h = 50) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h }) as Element;
const arrow = (id: string, from: object, to: object) =>
  ({ id, type: 'arrow', from, to }) as unknown as Element;

describe('isDrawingElement', () => {
  it('takes arrows, text and pen strokes into a drawing zone', () => {
    expect(isDrawingElement(el({ type: 'arrow' }))).toBe(true);
    expect(isDrawingElement(el({ type: 'text' }))).toBe(true);
    expect(isDrawingElement(el({ type: 'freehand' }))).toBe(true);
  });

  it('takes the diagram shapes, and leaves any other shape kind an object', () => {
    expect(isDrawingElement(el({ type: 'shape', shape: 'square' }))).toBe(true);
    expect(isDrawingElement(el({ type: 'shape', shape: 'speech-bubble' }))).toBe(true);
    expect(isDrawingElement(el({ type: 'shape', shape: 'not-a-diagram-shape' }))).toBe(false);
  });

  it('leaves a sticky note, a chart, a table and an image as objects', () => {
    for (const type of ['sticky', 'chart', 'table', 'image']) {
      expect(isDrawingElement(el({ type }))).toBe(false);
    }
  });
});

describe('withElementsIntoZone', () => {
  const plan = (bounds: ZonePlan['bounds'], scale: number): ZonePlan => ({
    zone: 'drawing',
    width: 400,
    height: 300,
    bounds,
    scale,
  });
  const rect = { x: 1000, y: 2000, width: 400, height: 300 };

  it('centres a box in the zone and scales it about its own corner', () => {
    const a = box('a', 10, 20, 100, 50);
    const bounds = { x: 10, y: 20, width: 100, height: 50 };
    const out = withElementsIntoZone([a], new Set(['a']), plan(bounds, 2), rect);
    // 200 x 100 after scaling, centred in 400 x 300.
    expect(out[0]).toMatchObject({ x: 1100, y: 2100, width: 200, height: 100 });
  });

  it('keeps the arrangement of several elements, and moves a free arrow end with them', () => {
    const a = box('a', 0, 0, 100, 100);
    const b = box('b', 100, 100, 100, 100);
    const ar = arrow('ar', { kind: 'free', x: 50, y: 50 }, { kind: 'free', x: 150, y: 150 });
    const out = withElementsIntoZone(
      [a, b, ar],
      new Set(['a', 'b', 'ar']),
      plan({ x: 0, y: 0, width: 200, height: 200 }, 1),
      rect,
    );
    expect(out[0]).toMatchObject({ x: 1100, y: 2050 });
    expect(out[1]).toMatchObject({ x: 1200, y: 2150 });
    expect(out[2]).toMatchObject({
      from: { kind: 'free', x: 1150, y: 2100 },
      to: { kind: 'free', x: 1250, y: 2200 },
    });
  });

  it('leaves an arrow end pinned to a shape as it was, and elements outside the set untouched', () => {
    const a = box('a', 0, 0);
    const other = box('other', 5, 5);
    const pinned = { kind: 'pinned', id: 'a' };
    const ar = arrow('ar', pinned, { kind: 'free', x: 10, y: 10 });
    const out = withElementsIntoZone(
      [a, other, ar],
      new Set(['a', 'ar']),
      plan({ x: 0, y: 0, width: 100, height: 50 }, 1),
      rect,
    );
    expect(out[1]).toBe(other);
    const moved = out[2] as unknown as { from: unknown; to: { x: number; y: number } };
    expect(moved.from).toBe(pinned);
    expect(moved.to).toMatchObject({ kind: 'free', x: 1160, y: 2135 });
  });
});
