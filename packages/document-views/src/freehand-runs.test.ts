import { describe, expect, it } from 'vitest';
import { freehandRuns, isBareStroke } from './freehand-runs';

type El = { id: string; type: string; [field: string]: unknown };
const shapeAt = (_kind: 'square', id: string, x: number, y: number): El => ({
  id,
  type: 'shape',
  x,
  y,
  width: 100,
  height: 50,
});
const strokeAt = (id: string, x: number, y: number, closed = false): El => ({
  id,
  type: 'freehand',
  points: [
    { x, y },
    { x: x + 20, y: y + 10 },
  ],
  closed,
});
const placed = (els: El[]) => els.map((el, index) => ({ el, index }));
const none = new Set<string>();

describe('isBareStroke', () => {
  const stroke = strokeAt('s', 0, 0);
  const carrying = (extra: Record<string, unknown>): El => ({ ...stroke, ...extra });

  it('takes a freehand with nothing on it', () => {
    expect(isBareStroke(stroke, none)).toBe(true);
  });

  it('refuses a stroke carrying anything, or an arrow end, or a non-stroke', () => {
    expect(isBareStroke(carrying({ label: 'Loop' }), none)).toBe(false);
    expect(isBareStroke(carrying({ note: 'n' }), none)).toBe(false);
    const thread = {
      comments: [{ id: 'c', text: 't', createdAt: 0, authorName: 'A', authorColor: '#000' }],
      resolved: false,
    };
    expect(isBareStroke(carrying({ commentThread: thread }), none)).toBe(false);
    expect(isBareStroke(carrying({ link: { kind: 'url', url: 'https://x' } }), none)).toBe(false);
    expect(isBareStroke(carrying({ action: {} }), none)).toBe(false);
    expect(isBareStroke(carrying({ actions: [] }), none)).toBe(false);
    expect(isBareStroke(stroke, new Set(['s']))).toBe(false);
    expect(isBareStroke(shapeAt('square', 'q', 0, 0), none)).toBe(false);
  });
});

describe('freehandRuns (R15, E27)', () => {
  it('folds adjacent bare strokes and counts the closed ones', () => {
    const items = placed([
      strokeAt('a', 0, 0),
      strokeAt('b', 0, 0, true),
      strokeAt('c', 0, 0, true),
    ]);
    expect(freehandRuns(items, none)).toEqual([{ run: 'freehand', strokes: items, closed: 2 }]);
  });

  it('leaves a lone stroke as itself and breaks a run at another element', () => {
    const items = placed([
      strokeAt('a', 0, 0),
      shapeAt('square', 'q', 0, 0),
      strokeAt('b', 0, 0),
      strokeAt('c', 0, 0),
    ]);
    expect(freehandRuns(items, none)).toEqual([
      items[0],
      items[1],
      { run: 'freehand', strokes: [items[2], items[3]], closed: 0 },
    ]);
  });
});
