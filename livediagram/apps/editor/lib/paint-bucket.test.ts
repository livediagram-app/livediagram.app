import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createFreehand,
  createPath,
  createShape,
  createSticky,
  createText,
  freehandCanvasPoints,
  isFilledPenLoop,
  type Element,
  type FreehandElement,
} from '@livediagram/document';
import { paintBucketTarget, pourBucket } from './paint-bucket';

const BLUE = '#dbeafe';

// A marker stroke round (cx, cy), radius r, stopping `gapDeg` short of a full turn.
function marker(id: string, gapDeg: number, cx = 100, cy = 100, r = 50): FreehandElement {
  const n = 40;
  const sweep = ((360 - gapDeg) * Math.PI) / 180;
  const pts = Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos((sweep * i) / (n - 1)),
    y: cy + r * Math.sin((sweep * i) / (n - 1)),
  }));
  return { ...createFreehand(pts, false), id, penWidth: 1.5 };
}

const rect = (id: string, over: Record<string, unknown> = {}): Element => ({
  ...createShape('square', 0, 0),
  id,
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  fillColor: 'transparent',
  ...over,
});

const P = { x: 100, y: 100 };

describe('what a press fills', () => {
  it('fills a closed shape under the press, inside its drawn outline', () => {
    expect(paintBucketTarget([rect('r')], P)).toEqual({
      kind: 'fill',
      el: expect.objectContaining({ id: 'r' }),
    });
    // An ellipse by its curve: its box corner is outside it.
    const ellipse = { ...rect('e'), shape: 'circle' } as Element;
    expect(paintBucketTarget([ellipse], { x: 5, y: 5 }).kind).toBe('none');
  });

  it('closes a marker loop whose ends meet, from inside it', () => {
    const target = paintBucketTarget([marker('m', 10)], P);
    expect(target.kind).toBe('loop');
    // Outside the loop, inside its box: nothing.
    expect(paintBucketTarget([marker('m', 10)], { x: 55, y: 55 }).kind).toBe('none');
  });

  it('looks past open ink, a text box and a line to the shape beneath', () => {
    const open = marker('o', 140);
    const text = { ...createText(80, 80), id: 't', width: 40, height: 40 };
    const line: Element = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 100 },
      to: { kind: 'free', x: 200, y: 100 },
    };
    const hl = { ...marker('h', 10), pen: 'highlighter' as const };
    const target = paintBucketTarget([rect('r'), open, text, line, hl], P);
    expect(target.kind === 'fill' && target.el.id).toBe('r');
  });

  it('is stopped by a note, a chart and anything locked', () => {
    const note = { ...createSticky(50, 50), id: 'n', width: 100, height: 100 };
    expect(paintBucketTarget([rect('r'), note], P).kind).toBe('none');
    const chart = { ...rect('c'), shape: 'pie-chart' } as Element;
    expect(paintBucketTarget([rect('r'), chart], P).kind).toBe('none');
    expect(paintBucketTarget([rect('r', { locked: true })], P).kind).toBe(
      'locked',
    );
  });

  it('does not see what is on a hidden or locked layer, or outside every box', () => {
    expect(paintBucketTarget([rect('r'), rect('top')], P, new Set(['top']))).toEqual({
      kind: 'fill',
      el: expect.objectContaining({ id: 'r' }),
    });
    expect(paintBucketTarget([rect('r')], { x: 500, y: 500 }).kind).toBe('none');
    expect(paintBucketTarget([], P).kind).toBe('none');
  });

  it('follows a rotated element round its centre', () => {
    const turned = rect('r', { rotation: 45 });
    expect(paintBucketTarget([turned], P).kind).toBe('fill');
    expect(paintBucketTarget([turned], { x: 400, y: 400 }).kind).toBe('none');
  });

  it('fills a closed path inside its curve, not inside a hole, and passes an open one', () => {
    const square = createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 200, y: 0, mode: 'corner' },
        { x: 200, y: 200, mode: 'corner' },
        { x: 0, y: 200, mode: 'corner' },
      ],
      true,
    );
    expect(paintBucketTarget([square], P).kind).toBe('fill');
    const open = createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 200, y: 0, mode: 'corner' },
        { x: 200, y: 200, mode: 'corner' },
      ],
      false,
    );
    expect(paintBucketTarget([open], { x: 150, y: 50 }).kind).toBe('none');
    // A combined path: the square with a hole a quarter to three quarters of its box.
    const corner = (nx: number, ny: number) => ({ nx, ny, mode: 'corner' as const });
    const hole = {
      ...square,
      subpaths: [[corner(0.25, 0.25), corner(0.75, 0.25), corner(0.75, 0.75), corner(0.25, 0.75)]],
    } as Element;
    expect(paintBucketTarget([hole], P).kind).toBe('none');
    expect(paintBucketTarget([hole], { x: 20, y: 20 }).kind).toBe('fill');
  });

  it('fills a stroke that is already closed', () => {
    const closed = { ...marker('m', 0), closed: true };
    expect(paintBucketTarget([closed], P).kind).toBe('fill');
  });
});

describe('pouring', () => {
  it('fills a shape with the colour, dropping a swatch binding, and skips the same colour', () => {
    const r = rect('r', { fillSwatch: 2, colorPreset: 'blue' });
    const next = pourBucket({ kind: 'fill', el: r }, BLUE)!;
    expect(next).toMatchObject({ id: 'r', fillColor: BLUE });
    expect((next as { fillSwatch?: unknown }).fillSwatch).toBeUndefined();
    expect((next as { colorPreset?: unknown }).colorPreset).toBeUndefined();
    expect(pourBucket({ kind: 'fill', el: next }, BLUE.toUpperCase())).toBeNull();
    expect(pourBucket({ kind: 'fill', el: next }, 'transparent')).toMatchObject({
      fillColor: 'transparent',
    });
  });

  it('fills a closed path, dropping its swatch binding', () => {
    const path = {
      ...createPath([{ x: 0, y: 0, mode: 'corner' }], true),
      fillSwatch: 1,
    } as Element;
    const next = pourBucket({ kind: 'fill', el: path }, BLUE)!;
    expect(next).toMatchObject({ fillColor: BLUE });
    expect((next as { fillSwatch?: unknown }).fillSwatch).toBeUndefined();
  });

  it('closes and fills a loop, keeping its id; No fill leaves an open loop', () => {
    const loop = marker('m', 10);
    const next = pourBucket({ kind: 'loop', el: loop }, BLUE) as FreehandElement;
    expect(next.id).toBe('m');
    expect(isFilledPenLoop(next)).toBe(true);
    expect(next.fillColor).toBe(BLUE);
    expect(freehandCanvasPoints(next).length).toBe(freehandCanvasPoints(loop).length + 1);
    expect(pourBucket({ kind: 'loop', el: loop }, 'transparent')).toBeNull();
  });

  it('recolours a closed stroke and skips the same colour', () => {
    const closed = { ...marker('m', 0), closed: true, fillColor: '#000000' };
    const next = pourBucket({ kind: 'fill', el: closed }, BLUE) as FreehandElement;
    expect(next.fillColor).toBe(BLUE);
    expect(pourBucket({ kind: 'fill', el: next }, BLUE)).toBeNull();
  });

  it('changes nothing it cannot fill', () => {
    const note = { ...createSticky(0, 0), id: 'n' };
    expect(pourBucket({ kind: 'fill', el: note }, BLUE)).toBeNull();
  });
});

describe('cost', () => {
  it('finds the target among 5,000 marker strokes within its CPU budget', () => {
    // A board of small scribbles in a 100 by 50 grid, the press in a loop drawn last near the middle.
    const strokes: Element[] = [];
    for (let i = 0; i < 5000; i++) {
      strokes.push(marker(`s${i}`, 140, (i % 100) * 40, Math.floor(i / 100) * 40, 15));
    }
    strokes.push(marker('target', 10, 2000, 1000, 60));
    const press = { x: 2000, y: 1000 };
    expect(paintBucketTarget(strokes, press).kind).toBe('loop');
    const spent = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) paintBucketTarget(strokes, press);
    });
    expect(spent / 10).toBeLessThan(cpuBudgetMs(8));
  });
});
