import { describe, expect, it } from 'vitest';
import {
  createFreehand,
  createPath,
  createShape,
  type Element,
  type FreehandElement,
  type PathElement,
} from '@livediagram/document';
import { partialEraseStep, pathsTouched, strokesTouched } from './whiteboard-erase';

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

describe('pathsTouched (docs/specs/023-whiteboard/path-tool.md "Selecting and erasing")', () => {
  const path = (id: string, y: number, over: Partial<PathElement> = {}): PathElement => ({
    ...createPath(
      [
        { x: 0, y, mode: 'corner' },
        { x: 200, y, mode: 'corner' },
      ],
      false,
    ),
    id,
    ...over,
  });

  it('names the paths the brush crosses, skipping protected ones', () => {
    const els = [path('a', 100), path('b', 300), path('c', 100, { locked: true })];
    const isProtected = (el: { locked?: boolean }) => el.locked === true;
    expect(pathsTouched(els, { x: 50, y: 104 }, { x: 60, y: 104 }, 8, isProtected)).toEqual(['a']);
  });
});
