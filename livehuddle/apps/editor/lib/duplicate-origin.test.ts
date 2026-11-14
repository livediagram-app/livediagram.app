// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { duplicateOriginBounds, noteDuplicate, useDuplicateOrigin } from './duplicate-origin';

// docs/specs/008-canvas/canvas-and-palette.md "Selection popover" (Work Tracker 849): straight after a Duplicate the
// toolbar over the copies keeps off what they were copied from.

const at = (id: string, x: number, y: number): Element => ({
  ...createShape('desk', x, y),
  id,
  width: 100,
  height: 60,
});
const elements = [at('a', 0, 0), at('b', 200, 0), at('a2', 0, 84)];

describe('duplicateOriginBounds', () => {
  it('gives the originals’ bounds while the selection is exactly the copies', () => {
    const origin = { sourceIds: ['a', 'b'], copyIds: ['a2', 'b2'] };
    expect(duplicateOriginBounds(origin, ['b2', 'a2'], elements)).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 60,
    });
  });

  it('is null for any other selection, no duplicate yet, or originals gone', () => {
    const origin = { sourceIds: ['a'], copyIds: ['a2'] };
    expect(duplicateOriginBounds(null, ['a2'], elements)).toBeNull();
    expect(duplicateOriginBounds(origin, [], elements)).toBeNull();
    expect(duplicateOriginBounds(origin, ['a'], elements)).toBeNull();
    expect(duplicateOriginBounds(origin, ['a2', 'b'], elements)).toBeNull();
    expect(
      duplicateOriginBounds({ sourceIds: ['gone'], copyIds: ['a2'] }, ['a2'], elements),
    ).toBeNull();
  });
});

describe('useDuplicateOrigin', () => {
  it('follows the latest duplicate', () => {
    const selected = ['a2'];
    const { result } = renderHook(() => useDuplicateOrigin(selected, elements));
    act(() => noteDuplicate(['b'], ['other']));
    expect(result.current).toBeNull();
    act(() => noteDuplicate(['a'], ['a2']));
    expect(result.current).toEqual({ x: 0, y: 0, width: 100, height: 60 });
  });
});
