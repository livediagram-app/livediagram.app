import { describe, expect, it } from 'vitest';
import {
  bringManyToFront,
  bringToFront,
  elementBounds,
  elementIndexFor,
  isBoxed,
  sendManyToBack,
  sendToBack,
  supportsBorder,
  supportsBorderControls,
  supportsFinish,
  supportsColours,
  supportsFillColor,
  type RetiredArrowElement,
  type Element,
  type ShapeElement,
} from './index';
import { createShape } from './shape-factory';

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'focus-button',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

describe('elementBounds', () => {
  it('returns a boxed element rectangle directly', () => {
    const box = shape('a', { x: 5, y: 6, width: 30, height: 40 });
    expect(elementBounds(box, [box])).toEqual({ x: 5, y: 6, width: 30, height: 40 });
  });

  // A stored arrow's bounds are its line and its 160 by 96 placeholder card together (element-engine.md D21).
  it('derives a stored arrow’s bounds from its ends and its card, regardless of direction', () => {
    const arrow: RetiredArrowElement = {
      id: 'e',
      type: 'arrow',
      from: { kind: 'free', x: 300, y: 280 },
      to: { kind: 'free', x: 20, y: 10 },
    };
    expect(elementBounds(arrow, [])).toEqual({ x: 20, y: 10, width: 280, height: 270 });
    const short: RetiredArrowElement = { ...arrow, from: { kind: 'free', x: 0, y: 0 } };
    // A short line sits inside its card: the card is the bounds.
    expect(elementBounds({ ...short, to: { kind: 'free', x: 20, y: 0 } }, [])).toEqual({
      x: -70,
      y: -48,
      width: 160,
      height: 96,
    });
  });
});

describe('layer order', () => {
  const ids = (els: Element[]) => els.map((e) => e.id);

  it('bringToFront moves the element to the end (top)', () => {
    const list = [shape('a'), shape('b'), shape('c')];
    expect(ids(bringToFront(list, 'a'))).toEqual(['b', 'c', 'a']);
  });

  it('sendToBack moves the element to the start (bottom)', () => {
    const list = [shape('a'), shape('b'), shape('c')];
    expect(ids(sendToBack(list, 'c'))).toEqual(['c', 'a', 'b']);
  });

  it('bringToFront / sendToBack are no-ops for a missing id', () => {
    const list = [shape('a'), shape('b')];
    expect(bringToFront(list, 'x')).toBe(list);
    expect(sendToBack(list, 'x')).toBe(list);
  });

  it('bringManyToFront keeps members after non-members, preserving order', () => {
    const list = [shape('a'), shape('b'), shape('c'), shape('d')];
    expect(ids(bringManyToFront(list, new Set(['a', 'c'])))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sendManyToBack keeps members before non-members, preserving order', () => {
    const list = [shape('a'), shape('b'), shape('c'), shape('d')];
    expect(ids(sendManyToBack(list, new Set(['b', 'd'])))).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('type predicates', () => {
  const arrow: RetiredArrowElement = {
    id: 'e',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 1, y: 1 },
  };

  // The three element-classification predicates feed dozens of
  // sites (resize handles, paint setters, paletteSelection field
  // gates, marquee inclusion, elementBounds). A regression that
  // misses a new BoxedElement variant tends to surface in
  // confusing ways: a fresh element renders, but its setters
  // no-op, or its bounds compute as zero, or marquee skips it.
  // Cover the full kind matrix here so the next variant has to
  // land in every predicate (or fail loudly) on the way in.

  it('isBoxed is true for every boxed-element kind, false for arrow', () => {
    expect(isBoxed(shape('a'))).toBe(true);
    expect(isBoxed({ ...shape('b'), type: 'text' })).toBe(true);
    expect(isBoxed({ ...shape('c'), type: 'sticky' })).toBe(true);
    expect(isBoxed({ ...shape('d'), type: 'image', imageId: null })).toBe(true);
    // A stored freehand, path or annotation is a retired element on its box.
    expect(isBoxed({ ...shape('e'), type: 'freehand' })).toBe(true);
    expect(isBoxed({ ...shape('f'), type: 'path' })).toBe(true);
    expect(isBoxed({ ...shape('g'), type: 'annotation' })).toBe(true);
    expect(isBoxed(arrow)).toBe(false);
  });

  it('supportsColours covers shape, text, sticky; not image or a retired arrow, drawing, path or annotation', () => {
    expect(supportsColours(shape('a'))).toBe(true);
    expect(supportsColours({ ...shape('b'), type: 'sticky' })).toBe(true);
    expect(supportsColours(arrow)).toBe(false);
    for (const type of ['freehand', 'path', 'annotation'] as const)
      expect(supportsColours({ ...shape('c'), type }), type).toBe(false);
    // A text element shows the Colours category for its Text row only
    // (docs/specs/008-canvas/canvas-and-palette.md "Text element"): no background.
    const text = { ...shape('d'), type: 'text' } as Element;
    expect(supportsColours(text)).toBe(true);
    expect(supportsFillColor(text)).toBe(false);
    // Image elements don't show the Colours accordion; the negative case
    // stops a future refactor that "simplifies" the predicate to
    // `isBoxed || arrow` and silently changes the surfaced fields.
    expect(supportsColours({ ...shape('e'), type: 'image', imageId: null })).toBe(false);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements" (Work Tracker 639): a placeholder offers no
  // colours, border or finish.
  it('offers no colours, border controls or finish on a retired element', () => {
    for (const kind of ['pie-chart', 'lane', 'never-had'] as const) {
      const retired = { ...shape('r'), shape: kind } as unknown as Element;
      expect(supportsColours(retired), kind).toBe(false);
      expect(supportsBorderControls(retired), kind).toBe(false);
      expect(supportsFinish(retired), kind).toBe(false);
    }
    expect(supportsFinish(shape('live'))).toBe(true);
    expect(supportsBorderControls(shape('live'))).toBe(true);
  });

  it('supportsBorder is true for shapes only', () => {
    // Border-stroke + border-pattern apply to shapes and the pen
    // tool's freehand element (both render through the same
    // strokeWidth / strokeStyle fields). Everything else (text,
    // sticky, image, arrow) lights up its own controls elsewhere
    // and must NOT receive a BorderStroke / BorderStyle write.
    expect(supportsBorder(shape('a'))).toBe(true);
    expect(supportsBorder({ ...shape('b'), type: 'freehand' })).toBe(false);
    expect(supportsBorder({ ...shape('p'), type: 'path' })).toBe(false);
    expect(supportsBorder({ ...shape('c'), type: 'sticky' })).toBe(false);
    expect(supportsBorder({ ...shape('d'), type: 'text' })).toBe(false);
    expect(supportsBorder({ ...shape('e'), type: 'image', imageId: null })).toBe(false);
    expect(supportsBorder(arrow)).toBe(false);
  });
});

// docs/specs/008-canvas/canvas-performance.md "Whole-board passes stay linear": one index per element list.
describe('elementIndexFor', () => {
  it('builds one index per element list and reuses it', () => {
    const a = createShape('focus-button', 0, 0);
    const list = [a];
    const first = elementIndexFor(list);
    expect(first.get(a.id)).toBe(a);
    expect(elementIndexFor(list)).toBe(first);
    expect(elementIndexFor([a])).not.toBe(first);
  });
});
