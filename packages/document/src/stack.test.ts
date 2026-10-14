import { describe, expect, it } from 'vitest';
import {
  createShape,
  isValidElement,
  layoutStack,
  migrateStoredTab,
  settleStacks,
  stackChildren,
  type Element,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/stack.md, blueprint stack.md.

const stack = (over: Partial<ShapeElement> = {}) =>
  ({
    ...(createShape('stack', 0, 0) as ShapeElement),
    id: 's',
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    ...over,
  }) as ShapeElement;
const box = (id: string, x: number, y: number, w = 80, h = 60) =>
  ({
    ...(createShape('square', 0, 0) as ShapeElement),
    id,
    x,
    y,
    width: w,
    height: h,
  }) as ShapeElement;
const at = (els: Element[], id: string) => {
  const e = els.find((x) => x.id === id) as ShapeElement;
  return { x: e.x, y: e.y, w: e.width, h: e.height };
};

describe('a stack', () => {
  it('starts as a valid empty row', () => {
    const s = createShape('stack', 0, 0) as ShapeElement;
    expect(isValidElement(s)).toBe(true);
    expect(isValidElement({ ...s, stackGap: 99 })).toBe(false);
    expect(isValidElement({ ...s, stackDirection: 'diagonal' as never })).toBe(false);
  });

  it('orders its children by position and lays a row out with even gaps, hugging them (I1)', () => {
    const els = [stack(), box('b', 200, 40), box('a', 30, 100, 80, 40)];
    expect(stackChildren(els, els[0] as ShapeElement).map((k) => k.id)).toEqual(['a', 'b']);
    const out = settleStacks(els);
    expect(at(out, 'a')).toMatchObject({ x: 16, y: 26 });
    expect(at(out, 'b')).toMatchObject({ x: 16 + 80 + 16, y: 16 });
    expect(at(out, 's')).toMatchObject({ w: 16 + 80 + 16 + 80 + 16, h: 16 + 60 + 16 });
  });

  it('reorders when a child is dragged past a sibling (I2), and settling again changes nothing (I3)', () => {
    const first = settleStacks([stack(), box('a', 30, 40), box('b', 150, 40)]);
    const dragged = first.map((e) => (e.id === 'a' ? { ...e, x: 140 } : e));
    const out = settleStacks(dragged);
    expect(at(out, 'b').x).toBe(16);
    expect(at(out, 'a').x).toBe(16 + 80 + 16);
    expect(settleStacks(out)).toBe(out);
  });

  it('takes in what it grows over in the same settle, so the next settle changes nothing (I3)', () => {
    // Two children hug the stack to 208 wide; a neighbour sits just past it, its centre at 260.
    const hugged = settleStacks([stack(), box('a', 30, 40), box('b', 150, 40)]);
    expect(at(hugged, 's').w).toBe(208);
    const placed = [...hugged, box('n', 220, 40)];
    expect(settleStacks(placed)).toBe(placed);
    // A third child grows it to 304, over the neighbour's centre: the neighbour is laid out now, not on a later edit.
    const out = settleStacks([...placed, box('c', 120, 40)]);
    expect(at(out, 's').w).toBe(16 + 4 * 80 + 3 * 16 + 16);
    expect(at(out, 'n').x).toBe(16 + 3 * (80 + 16));
    expect(settleStacks(out)).toBe(out);
  });

  it('lays a column and a grid, aligning across the flow', () => {
    const col = settleStacks([
      stack({ stackDirection: 'column', stackAlign: 'start' }),
      box('a', 20, 20, 120),
      box('b', 20, 120, 60),
    ]);
    expect(at(col, 'b')).toMatchObject({ x: 16, y: 16 + 60 + 16 });
    const grid = layoutStack(
      stack({ stackDirection: 'grid', stackColumns: 2, stackGap: 10, stackPadding: 0 }),
      [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 0, y: 0, width: 50, height: 50 },
      ],
    );
    expect(grid.at).toEqual([
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 0, y: 60 },
    ]);
    expect(grid).toMatchObject({ width: 110, height: 110 });
  });

  it('leaves an empty stack as it is, and takes a child dropped into it', () => {
    const empty = [stack()];
    expect(settleStacks(empty)).toBe(empty);
    const out = settleStacks([stack(), box('a', 300, 120)]);
    expect(at(out, 'a')).toMatchObject({ x: 16, y: 16 });
  });

  it('carries what a child holds, and lays out nested stacks innermost first', () => {
    const inner = stack({ id: 'inner', x: 40, y: 40, width: 200, height: 120 });
    const els = [stack({ width: 600, height: 400 }), inner, box('k', 60, 60, 40, 40)];
    const out = settleStacks(els);
    const i = at(out, 'inner');
    const k = at(out, 'k');
    // The inner stack hugs its child, then sits in the outer's first slot with its child still inside it.
    expect(i).toMatchObject({ x: 16, y: 16, w: 72, h: 72 });
    expect(k).toMatchObject({ x: 32, y: 32 });
  });

  it('lays out on read', () => {
    const tab = migrateStoredTab({
      theme: 'default',
      elements: [stack(), box('a', 300, 120)],
    } as never) as {
      elements: Element[];
    };
    expect(at(tab.elements, 'a')).toMatchObject({ x: 16, y: 16 });
  });

  it('keeps a title band above its children when it has a title', () => {
    const out = settleStacks([stack({ label: 'Services' }), box('a', 30, 40)]);
    expect(at(out, 'a')).toMatchObject({ x: 16, y: 22 + 16 });
    expect(at(out, 's').h).toBe(22 + 16 + 60 + 16);
  });
});
