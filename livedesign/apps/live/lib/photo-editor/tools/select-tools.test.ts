// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRaster, maskAt, maskBounds, type Mask8 } from '@livedesign/photo-engine';
import { at, harness, photoOf, solid } from '../photo-test-utils';
import { toolHandler } from '.';
import { selectAll, selectMode } from './select-tools';

// docs/specs/031-photo/photo-tools.md "Selecting": the marquees, the lassos, the Magic Wand and Quick
// Select, each combined with the selection there by the modifiers or the options flyout's choice.
const blank = (w = 20, h = 20) => harness(photoOf(w, h), { a: solid(w, h, [255, 255, 255, 255]) });
type H = ReturnType<typeof blank>;
type Keys = Partial<{ shift: boolean; alt: boolean; mod: boolean }>;

const hard = (h: H) => {
  h.state.options.select = { ...h.state.options.select, antiAlias: false };
  return h;
};

const drag = (
  h: H,
  tool: Parameters<typeof toolHandler>[0],
  from: number[],
  to: number[],
  keys: Keys = {},
) => {
  const t = toolHandler(tool, h.ctx);
  if (t.down(at(from[0]!, from[1]!, keys))) {
    t.move?.(at(to[0]!, to[1]!, keys));
    t.up?.(at(to[0]!, to[1]!, keys));
  }
  return t;
};

const selected = (h: H, x: number, y: number) => (h.s.selection ? maskAt(h.s.selection, x, y) : 0);
const bounds = (m: Mask8 | null) => (m ? maskBounds(m) : null);

describe('selectMode', () => {
  it('reads the keys first, else the options flyout', () => {
    const p = { shift: false, alt: false };
    expect(selectMode(p, 'add')).toBe('add');
    expect(selectMode({ ...p, shift: true }, 'new')).toBe('add');
    expect(selectMode({ ...p, alt: true }, 'new')).toBe('subtract');
    expect(selectMode({ shift: true, alt: true }, 'new')).toBe('intersect');
  });
});

describe('the Rectangle and Ellipse Select', () => {
  it('selects the box dragged, and a click with no drag deselects', () => {
    const h = hard(blank());
    drag(h, 'rect-select', [2, 2], [10, 8]);
    expect(bounds(h.s.selection)).toEqual({ x: 2, y: 2, width: 8, height: 6 });
    expect(h.overlays.at(-1)).toEqual({ kind: 'none' });
    expect(h.overlays.some((o) => o.kind === 'rect')).toBe(true);
    drag(h, 'rect-select', [15, 15], [15, 15]);
    expect(h.s.selection).toBeNull();
    expect(h.s.lastSelection).not.toBeNull();
  });

  it('adds with Shift, subtracts with Alt and intersects with both', () => {
    const h = hard(blank());
    drag(h, 'rect-select', [0, 0], [10, 10]);
    drag(h, 'rect-select', [12, 12], [16, 16], { shift: true });
    expect(selected(h, 5, 5)).toBe(255);
    expect(selected(h, 14, 14)).toBe(255);
    drag(h, 'rect-select', [0, 0], [5, 5], { alt: true });
    expect(selected(h, 2, 2)).toBe(0);
    expect(selected(h, 7, 7)).toBe(255);
    drag(h, 'rect-select', [6, 6], [20, 20], { shift: true, alt: true });
    expect(selected(h, 7, 7)).toBe(255);
    expect(selected(h, 14, 14)).toBe(255);
    expect(selected(h, 1, 8)).toBe(0);
  });

  it('a click with a modifier keeps the selection', () => {
    const h = hard(blank());
    drag(h, 'rect-select', [0, 0], [4, 4]);
    drag(h, 'rect-select', [10, 10], [10, 10], { shift: true });
    expect(bounds(h.s.selection)).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  it('keeps a square with Shift, draws from the centre with Alt, and holds a fixed ratio or size', () => {
    const h = hard(blank(40, 40));
    // Shift and Alt pressed once the drag has begun (held at the press, they add and subtract).
    const late = (from: number[], to: number[], keys: Keys) => {
      const t = toolHandler('rect-select', h.ctx);
      t.down(at(from[0]!, from[1]!));
      t.move!(at(to[0]!, to[1]!, keys));
      t.up!(at(to[0]!, to[1]!, keys));
    };
    late([2, 2], [12, 6], { shift: true });
    expect(bounds(h.s.selection)).toEqual({ x: 2, y: 2, width: 10, height: 10 });
    h.s.selection = null;
    late([20, 20], [24, 23], { alt: true });
    expect(bounds(h.s.selection)).toEqual({ x: 16, y: 17, width: 8, height: 6 });
    h.s.selection = null;
    h.state.options.select = { ...h.state.options.select, style: 'ratio', ratioW: 2, ratioH: 1 };
    drag(h, 'rect-select', [0, 0], [10, 30]);
    expect(bounds(h.s.selection)).toEqual({ x: 0, y: 0, width: 10, height: 5 });
    h.s.selection = null;
    h.state.options.select = { ...h.state.options.select, style: 'size', sizeW: 6, sizeH: 3 };
    drag(h, 'rect-select', [4, 4], [30, 30]);
    expect(bounds(h.s.selection)).toEqual({ x: 4, y: 4, width: 6, height: 3 });
  });

  it('moves the selection when pressed inside it, and nudges it with the arrows', () => {
    const h = hard(blank());
    drag(h, 'rect-select', [2, 2], [6, 6]);
    drag(h, 'rect-select', [3, 3], [8, 5]);
    expect(bounds(h.s.selection)).toEqual({ x: 7, y: 4, width: 4, height: 4 });
    const t = toolHandler('rect-select', h.ctx);
    expect(t.key!('ArrowRight', { shift: false, alt: false, mod: false })).toBe(true);
    expect(t.key!('ArrowDown', { shift: true, alt: false, mod: false })).toBe(true);
    expect(bounds(h.s.selection)).toEqual({ x: 8, y: 14, width: 4, height: 4 });
    expect(t.key!('Enter', { shift: false, alt: false, mod: false })).toBe(false);
  });

  it('draws an ellipse, feathered when asked', () => {
    const h = hard(blank());
    drag(h, 'ellipse-select', [0, 0], [20, 20]);
    expect(selected(h, 10, 10)).toBe(255);
    expect(selected(h, 0, 0)).toBe(0);
    h.s.selection = null;
    h.state.options.select = { ...h.state.options.select, feather: 3 };
    drag(h, 'rect-select', [5, 5], [15, 15]);
    // Soft: strongest in the middle, fading across the edge and past it.
    expect(selected(h, 10, 10)).toBeGreaterThan(selected(h, 5, 10));
    expect(selected(h, 5, 10)).toBeGreaterThan(selected(h, 3, 10));
    expect(selected(h, 3, 10)).toBeGreaterThan(0);
  });
});

describe('the lassos', () => {
  it('the Lasso selects the shape traced, skipping points closer than 2 screen px', () => {
    const h = hard(blank());
    const t = toolHandler('lasso', h.ctx);
    t.down(at(2, 2));
    for (const [x, y] of [
      [2.5, 2.5],
      [16, 2],
      [16, 16],
      [2, 16],
    ])
      t.move!(at(x!, y!));
    t.up!(at(2, 16));
    expect(selected(h, 9, 9)).toBe(255);
    expect(selected(h, 18, 18)).toBe(0);
    const overlay = h.overlays.findLast((o) => o.kind === 'path');
    expect(overlay && 'points' in overlay ? overlay.points.length : 0).toBe(4);
  });

  it('the Lasso with too few points selects nothing', () => {
    const h = hard(blank());
    drag(h, 'lasso', [2, 2], [10, 10]);
    expect(h.s.selection).toBeNull();
  });

  it('the Polygon Lasso closes on its first corner, on Enter or on a double press', () => {
    const h = hard(blank());
    const t = toolHandler('polygon-lasso', h.ctx);
    for (const [x, y] of [
      [2, 2],
      [16, 2],
      [16, 16],
    ])
      expect(t.down(at(x!, y!))).toBe(false);
    t.move!(at(8, 18));
    expect(h.overlays.at(-1)).toMatchObject({ kind: 'path', live: { x: 8, y: 18 } });
    t.down(at(2.5, 2.5));
    expect(selected(h, 12, 6)).toBe(255);
    expect(selected(h, 3, 14)).toBe(0);

    const k = { shift: false, alt: false, mod: false };
    const u = toolHandler('polygon-lasso', h.ctx);
    expect(u.key!('Enter', k)).toBe(false);
    for (const [x, y] of [
      [0, 10],
      [10, 10],
      [10, 20],
      [5, 20],
    ])
      u.down(at(x!, y!, { shift: true }));
    expect(u.key!('Backspace', k)).toBe(true);
    expect(u.key!('Tab', k)).toBe(false);
    u.key!('Enter', k);
    expect(selected(h, 3, 12)).toBe(255);

    const v = toolHandler('polygon-lasso', h.ctx);
    v.down(at(0, 0));
    v.down(at(5, 0));
    expect(v.key!('Escape', k)).toBe(true);
    expect(h.overlays.at(-1)).toEqual({ kind: 'none' });
    v.down(at(0, 0, { alt: true }));
    v.down(at(20, 0));
    v.down(at(20, 20));
    v.double!(at(20, 20));
    expect(h.s.selection === null || selected(h, 12, 6) === 0).toBe(true);
  });

  it('the Magnetic Lasso follows edges between its anchors and closes on Enter', () => {
    // A dark square on white: the edge the wire should snap to.
    const r = solid(24, 24, [255, 255, 255, 255]);
    for (let y = 6; y < 18; y++)
      for (let x = 6; x < 18; x++) r.data.set([0, 0, 0, 255], (y * 24 + x) * 4);
    const h = harness(photoOf(24, 24), { a: r });
    const k = { shift: false, alt: false, mod: false };
    const t = toolHandler('magnetic-lasso', h.ctx);
    expect(t.key!('Enter', k)).toBe(false);
    t.down(at(6, 6));
    t.move!(at(17, 6));
    t.down(at(17, 6));
    t.move!(at(17, 17));
    t.down(at(17, 17));
    t.move!(at(6, 17));
    expect(h.overlays.at(-1)?.kind).toBe('path');
    expect(t.key!('Enter', k)).toBe(true);
    expect(selected(h, 12, 12)).toBeGreaterThan(0);
    expect(selected(h, 2, 2)).toBe(0);
    t.down(at(1, 1));
    expect(t.key!('Escape', k)).toBe(true);
    expect(t.key!('x', k)).toBe(false);
    t.cancel!();
  });
});

describe('the Magic Wand and Select All', () => {
  const twoTone = () => {
    const r = createRaster(10, 4);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 10; x++)
        r.data.set(x < 4 || x > 7 ? [200, 0, 0, 255] : [0, 0, 200, 255], (y * 10 + x) * 4);
    return harness(photoOf(10, 4), { a: r });
  };

  it('selects the area of like colour around the press, or every like pixel when not contiguous', () => {
    const h = twoTone();
    h.state.options.select = { ...h.state.options.select, antiAlias: false };
    const t = toolHandler('magic-wand', h.ctx);
    expect(t.down(at(1, 1))).toBe(false);
    expect(selected(h, 2, 2)).toBe(255);
    expect(selected(h, 5, 2)).toBe(0);
    expect(selected(h, 9, 2)).toBe(0);
    h.state.options.wand = { ...h.state.options.wand, contiguous: false };
    toolHandler('magic-wand', h.ctx).down(at(1, 1));
    expect(selected(h, 9, 2)).toBe(255);
  });

  it('anti-aliases its edge when asked', () => {
    const h = twoTone();
    toolHandler('magic-wand', h.ctx).down(at(1, 1));
    expect(h.s.selection).not.toBeNull();
  });

  it('Select All takes the whole photo', () => {
    const h = blank(6, 3);
    selectAll(h.ctx);
    expect(bounds(h.s.selection)).toEqual({ x: 0, y: 0, width: 6, height: 3 });
  });
});

describe('Quick Select', () => {
  it('grows the selection along the strokes, and refines it when they are done', async () => {
    const r = solid(30, 30, [255, 255, 255, 255]);
    for (let y = 5; y < 25; y++)
      for (let x = 5; x < 25; x++) r.data.set([20, 20, 20, 255], (y * 30 + x) * 4);
    const h = harness(photoOf(30, 30), { a: r });
    h.state.options.quick = { ...h.state.options.quick, size: 6 };
    const t = toolHandler('quick-select', h.ctx);
    expect(t.down(at(15, 15))).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    t.move!(at(18, 15));
    t.up!(at(18, 15));
    await new Promise((r) => setTimeout(r, 50));
    expect(selected(h, 15, 15)).toBeGreaterThan(0);
    expect(selected(h, 1, 1)).toBe(0);
  });
});

describe('Quick Select, a stroke faster than its cuts', () => {
  it('still takes the dabs that came while a cut was running', async () => {
    // Two dark boxes apart; the stroke starts in the left and ends in the right before the first cut lands.
    const r = solid(60, 30, [255, 255, 255, 255]);
    for (let y = 8; y < 22; y++)
      for (let x = 0; x < 60; x++)
        if ((x >= 4 && x < 18) || (x >= 42 && x < 56))
          r.data.set([20, 20, 20, 255], (y * 60 + x) * 4);
    const h = harness(photoOf(60, 30), { a: r });
    h.state.options.quick = { ...h.state.options.quick, size: 6, autoEnhance: false };
    const t = toolHandler('quick-select', h.ctx);
    t.down(at(10, 15));
    t.move!(at(49, 15));
    t.up!(at(49, 15));
    await new Promise((r) => setTimeout(r, 100));
    expect(selected(h, 10, 15)).toBeGreaterThan(0);
    expect(selected(h, 49, 15)).toBeGreaterThan(0);
  });
});

describe('the Lasso trail', () => {
  it('draws a new list on each move, so the trail grows on screen as it is drawn', () => {
    const h = hard(blank(40, 40));
    const t = toolHandler('lasso', h.ctx);
    t.down(at(2, 2));
    t.move!(at(10, 2));
    t.move!(at(10, 10));
    const paths = h.overlays.filter((o) => o.kind === 'path');
    expect(paths).toHaveLength(2);
    const [a, b] = paths as { points: unknown[] }[];
    expect(a!.points).not.toBe(b!.points);
    expect([a!.points.length, b!.points.length]).toEqual([2, 3]);
  });
});

describe('a click with a marquee', () => {
  it('deselects, inside the selection as well as outside it', () => {
    const h = hard(blank(40, 40));
    const t = toolHandler('rect-select', h.ctx);
    t.down(at(2, 2));
    t.move!(at(20, 20));
    t.up!(at(20, 20));
    expect(h.s.selection).not.toBeNull();
    t.down(at(10, 10));
    t.up!(at(10, 10));
    expect(h.s.selection).toBeNull();
  });
});

describe('Space while drawing a marquee', () => {
  it('moves the shape instead of growing it', () => {
    const h = hard(blank(40, 40));
    const t = toolHandler('rect-select', h.ctx);
    t.down(at(2, 2));
    t.move!(at(10, 10));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    t.move!(at(20, 15));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
    t.move!(at(22, 17));
    t.up!(at(22, 17));
    // Moved by (10, 5) while Space was held, then grown by (2, 2).
    expect(bounds(h.s.selection)).toEqual({ x: 12, y: 7, width: 10, height: 10 });
  });
});
