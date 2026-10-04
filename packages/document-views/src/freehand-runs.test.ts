import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { shapeAt, strokeAt } from './__fixtures__/build';
import { freehandRuns, isBareStroke } from './freehand-runs';

const placed = (els: Element[]) => els.map((el, index) => ({ el, index }));
const none = new Set<string>();

describe('isBareStroke', () => {
  const stroke = strokeAt('s', 0, 0);

  it('takes a freehand with nothing on it', () => {
    expect(isBareStroke(stroke, none)).toBe(true);
  });

  it('refuses a stroke carrying anything, or an arrow end, or a non-stroke', () => {
    expect(isBareStroke({ ...stroke, label: 'Loop' } as Element, none)).toBe(false);
    expect(isBareStroke({ ...stroke, note: 'n' } as Element, none)).toBe(false);
    const thread = {
      comments: [{ id: 'c', text: 't', createdAt: 0, authorName: 'A', authorColor: '#000' }],
      resolved: false,
    };
    expect(isBareStroke({ ...stroke, commentThread: thread } as Element, none)).toBe(false);
    expect(
      isBareStroke({ ...stroke, link: { kind: 'url', url: 'https://x' } } as Element, none),
    ).toBe(false);
    expect(isBareStroke({ ...stroke, action: {} } as unknown as Element, none)).toBe(false);
    expect(isBareStroke({ ...stroke, actions: [] } as unknown as Element, none)).toBe(false);
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
