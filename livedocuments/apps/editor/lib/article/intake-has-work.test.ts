import { describe, expect, it } from 'vitest';
import type { Element } from '@livedocuments/document';
import { intakeHasWork } from './intake-has-work';

// docs/specs/007-editor/blueprints/article-pages.md "Zones", step 6: the intake ticks only when it has something to
// settle.
const note = { id: 'n1', type: 'article-note', x: 0, y: 0 } as unknown as Element;
const shape = { id: 's1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as unknown as Element;
const text = (runs: { text: string; note?: string }[]) => ({
  a: { blocks: [{ id: 'p', type: 'paragraph', runs }] },
});
const zoned = {
  a: {
    blocks: [
      {
        id: 'z',
        type: 'zone',
        zone: 'object',
        width: 100,
        height: 100,
        at: { page: 'a1', x: 0, y: 0 },
      },
    ],
  },
};
const none = new Set<string>();

describe('intakeHasWork', () => {
  it('has none for a typing commit on writing without zones or notes', () => {
    const was = { elements: [shape], articles: text([{ text: 'Hi' }]) };
    const now = { elements: was.elements, articles: text([{ text: 'Hi there' }]) };
    expect(intakeHasWork({ was, now, held: none, pending: 0 })).toBe(false);
  });

  it('has work the intake already found', () => {
    const was = { elements: [], articles: {} };
    expect(intakeHasWork({ was, now: was, held: none, pending: 1 })).toBe(true);
  });

  it('has work when a note marker is gone', () => {
    const articles = text([{ text: 'Hi', note: 'n1' }]);
    expect(
      intakeHasWork({
        was: { elements: [note, shape], articles },
        now: { elements: [shape], articles },
        held: none,
        pending: 0,
      }),
    ).toBe(true);
  });

  it('has none when elements change but no note marker went', () => {
    const articles = text([{ text: 'Hi' }]);
    expect(
      intakeHasWork({
        was: { elements: [note], articles },
        now: { elements: [note, shape], articles },
        held: none,
        pending: 0,
      }),
    ).toBe(false);
  });

  it('has work when text carrying a note is gone', () => {
    expect(
      intakeHasWork({
        was: { elements: [note], articles: text([{ text: 'Hi', note: 'n1' }]) },
        now: { elements: [note], articles: text([{ text: 'H' }]) },
        held: none,
        pending: 0,
      }),
    ).toBe(true);
  });

  it('has none when the noted text stays', () => {
    expect(
      intakeHasWork({
        was: { elements: [note], articles: text([{ text: 'Hi', note: 'n1' }]) },
        now: { elements: [note], articles: text([{ text: 'Hi!', note: 'n1' }]) },
        held: none,
        pending: 0,
      }),
    ).toBe(false);
  });

  it('has work while unheld writing holds a zone, and none while a locked page holds it', () => {
    const was = { elements: [], articles: zoned };
    expect(intakeHasWork({ was, now: was, held: none, pending: 0 })).toBe(true);
    expect(intakeHasWork({ was, now: was, held: new Set(['a']), pending: 0 })).toBe(false);
  });
});
