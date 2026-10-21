import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/document';
import { coversAnother } from './board-growth';

const box = (id: string, x: number, y: number, width = 100, height = 50) =>
  ({ id, type: 'shape', shape: 'square', x, y, width, height }) as Element;

describe('a previewed board growing to its cards', () => {
  const board = { id: 'b', x: 0, y: 0, width: 600, height: 900 };
  it('covers what starts below its own bottom in its columns, within the grown height', () => {
    expect(coversAnother(board, 640, [box('n', 100, 700)])).toBe(true);
  });

  it('leaves alone what lies beside it, past the grown height, above its bottom, or itself', () => {
    expect(
      coversAnother(board, 640, [
        box('side', 700, 700),
        box('far', 100, 950),
        box('on', 100, 300),
        { ...box('b', 0, 700) },
        { id: 'a', type: 'arrow' } as Element,
      ]),
    ).toBe(false);
  });
});
