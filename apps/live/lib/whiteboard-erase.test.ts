import { describe, expect, it } from 'vitest';
import {
  createFreehand,
  createShape,
  type Element,
  type FreehandElement,
} from '@livediagram/document';
import { partialEraseStep, strokesTouched } from './whiteboard-erase';

const line = (id: string, y: number): FreehandElement => ({
  ...createFreehand(
    [
      { x: 0, y },
      { x: 200, y },
    ],
    false,
  ),
  id,
  penWidth: 4,
});
const free = () => false;
let n = 0;
const mint = () => `p${++n}`;

describe('strokesTouched', () => {
  it('names the strokes whose ink the brush crosses, and only strokes', () => {
    const shape = { ...createShape('square', 0, 0), id: 'box' } as Element;
    const els: Element[] = [line('a', 100), line('b', 300), shape];
    expect(strokesTouched(els, { x: 50, y: 95 }, { x: 60, y: 105 }, 5, free)).toEqual(['a']);
  });

  it('skips protected strokes', () => {
    const els: Element[] = [line('a', 100)];
    expect(
      strokesTouched(els, { x: 50, y: 100 }, { x: 50, y: 100 }, 5, (el) => el.id === 'a'),
    ).toEqual([]);
  });
});

describe('partialEraseStep', () => {
  it('replaces a touched stroke with its surviving pieces, in place', () => {
    const els: Element[] = [line('a', 100), line('b', 300)];
    const out = partialEraseStep(els, { x: 100, y: 100 }, { x: 100, y: 100 }, 10, free, mint)!;
    expect(out.map((e) => e.id)).toEqual(['p1', 'p2', 'b']);
  });

  it('returns null when nothing changed', () => {
    const els: Element[] = [line('a', 100)];
    expect(
      partialEraseStep(els, { x: 100, y: 200 }, { x: 100, y: 200 }, 10, free, mint),
    ).toBeNull();
  });

  it('never cuts a locked stroke or anything that is not a stroke', () => {
    const locked = { ...line('a', 100), locked: true };
    const box = { ...createShape('square', 90, 90), id: 'box' } as Element;
    const els: Element[] = [locked, box];
    expect(
      partialEraseStep(
        els,
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        10,
        (el) => el.locked === true,
        mint,
      ),
    ).toBeNull();
  });
});
