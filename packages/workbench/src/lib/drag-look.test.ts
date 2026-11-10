import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { overlayAsDrawn, projectedFields, withDrawnLook } from './drag-look';

type El = {
  id: string;
  x: number;
  y: number;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  penColour?: string;
};

// What a canvas in dark mode does to a light theme's indigo entity: every colour drawn in the other half.
const stored: El = {
  id: 'a',
  x: 0,
  y: 0,
  fillColor: '#e0e7ff',
  strokeColor: '#4338ca',
  textColor: '#312e81',
};
const drawn: El = { ...stored, fillColor: '#2e3240', strokeColor: '#9eaafd', textColor: '#e7eafc' };

describe('withDrawnLook', () => {
  it('draws a moved element in the colours the canvas drew it in at rest', () => {
    const moved = { ...stored, x: 40, y: 30 };
    expect(withDrawnLook(moved, stored, drawn)).toEqual({ ...drawn, x: 40, y: 30 });
  });

  it('keeps what the gesture changed itself', () => {
    const recoloured = { ...stored, x: 5, fillColor: '#ff0000' };
    expect(withDrawnLook(recoloured, stored, drawn)).toEqual({
      ...drawn,
      x: 5,
      fillColor: '#ff0000',
    });
  });

  it('takes a field the projection added, and drops one it took away', () => {
    const named: El = { id: 'p', x: 0, y: 0, penColour: 'blue' };
    const resolved: El = { id: 'p', x: 0, y: 0, strokeColor: '#93c5fd' };
    expect(withDrawnLook({ ...named, x: 9 }, named, resolved)).toEqual({ ...resolved, x: 9 });
  });

  it('returns the preview itself when the canvas draws the element as stored', () => {
    const moved = { ...stored, x: 1 };
    expect(withDrawnLook(moved, stored, stored)).toBe(moved);
    expect(withDrawnLook(moved, undefined, drawn)).toBe(moved);
    expect(withDrawnLook(moved, stored, undefined)).toBe(moved);
    // A peer's preview is built on the drawn element already.
    const peer = { ...drawn, x: 3 };
    expect(withDrawnLook(peer, stored, drawn)).toBe(peer);
    expect(withDrawnLook(drawn, stored, drawn)).toBe(drawn);
    // Drawn again as a copy of the same values (a re-render that changed nothing).
    expect(withDrawnLook(moved, stored, { ...stored })).toBe(moved);
  });

  it('works out which fields the projection changed once per drawn element', () => {
    const first = projectedFields(stored, drawn);
    expect([...first].sort()).toEqual(['fillColor', 'strokeColor', 'textColor']);
    expect(projectedFields(stored, drawn)).toBe(first);
    expect(projectedFields(stored, stored)).toEqual([]);
    // The same drawn element against another stored one is worked out again.
    const other = { ...stored, fillColor: '#2e3240' };
    expect([...projectedFields(other, drawn)].sort()).toEqual(['strokeColor', 'textColor']);
  });
});

describe('overlayAsDrawn', () => {
  const board = (els: El[]) => new Map(els.map((e) => [e.id, e] as const));

  it('draws every changed element as the canvas does and every added one through the projection', () => {
    const plain: El = { id: 'b', x: 0, y: 0 };
    const copy: El = { ...stored, id: 'c', x: 100 };
    const overlay = {
      tabId: 't',
      changed: new Map<string, El>([
        ['a', { ...stored, x: 10 }],
        ['b', { ...plain, x: 10 }],
      ]),
      removed: new Set<string>(),
      added: [{ el: copy, after: 'a' }],
    };
    const project = (el: El) =>
      el.fillColor === stored.fillColor ? { ...el, fillColor: drawn.fillColor } : el;
    const out = overlayAsDrawn(overlay, board([stored, plain]), board([drawn, plain]), project);
    expect(out.changed.get('a')).toEqual({ ...drawn, x: 10 });
    expect(out.changed.get('b')).toBe(overlay.changed.get('b'));
    expect(out.added[0]).toEqual({ el: { ...copy, fillColor: drawn.fillColor }, after: 'a' });
    expect(out.tabId).toBe('t');
    expect(out.removed).toBe(overlay.removed);
    // The overlay the gesture keeps (and writes on release) is left as stored.
    expect(overlay.changed.get('a')!.fillColor).toBe(stored.fillColor);
  });

  it('touches only the added list when only a copy needs drawing', () => {
    const overlay = {
      changed: new Map([['a', { ...stored, x: 1 }]]),
      added: [
        { el: { ...stored, id: 'c' }, after: null },
        { el: { ...drawn, id: 'd' }, after: 'c' },
      ],
    };
    const out = overlayAsDrawn(overlay, board([stored]), board([stored]), (el) =>
      el.fillColor === stored.fillColor ? { ...el, fillColor: drawn.fillColor } : el,
    );
    expect(out.changed).toBe(overlay.changed);
    expect(out.added[0]!.el.fillColor).toBe(drawn.fillColor);
    expect(out.added[1]).toBe(overlay.added[1]);
  });

  it('is the overlay itself when the board is drawn as stored', () => {
    const overlay = {
      changed: new Map([['a', { ...stored, x: 1 }]]),
      added: [{ el: { ...stored, id: 'c' }, after: null }],
    };
    expect(overlayAsDrawn(overlay, board([stored]), board([stored]))).toBe(overlay);
    expect(overlayAsDrawn(overlay, board([stored]), board([stored]), (el) => el)).toBe(overlay);
  });

  it('keeps a whole-board move within a frame budget', () => {
    // 2,000 themed elements moving at once, drawn in the other half: one frame of the largest drag.
    const n = 2000;
    const storedBoard: El[] = [];
    const drawnBoard: El[] = [];
    for (let i = 0; i < n; i++) {
      const s = { ...stored, id: `e${i}`, x: i };
      storedBoard.push(s);
      drawnBoard.push({ ...drawn, id: `e${i}`, x: i });
    }
    const storedIndex = board(storedBoard);
    const drawnIndex = board(drawnBoard);
    const frame = (dx: number) => ({
      changed: new Map(storedBoard.map((s) => [s.id, { ...s, x: s.x + dx }] as const)),
      added: [],
    });
    overlayAsDrawn(frame(0), storedIndex, drawnIndex);
    const frames = Array.from({ length: 20 }, (_, i) => frame(i + 1));
    let best = Infinity;
    for (let i = 0; i < 3; i++)
      best = Math.min(
        best,
        cpuMsOf(() => {
          for (const f of frames) overlayAsDrawn(f, storedIndex, drawnIndex);
        }),
      );
    if (process.env.PERF_LOG)
      console.log(`drawn look ${(best / frames.length).toFixed(3)} ms a frame`);
    // A 16 ms frame has room for it many times over.
    expect(best / frames.length).toBeLessThan(cpuBudgetMs(8));
  });
});
