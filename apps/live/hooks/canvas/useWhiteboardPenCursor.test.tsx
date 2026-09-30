// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WHITEBOARD_INK, penColourHex } from '@livediagram/document';
import { useWhiteboardPenCursor } from './useWhiteboardPenCursor';

describe('useWhiteboardPenCursor', () => {
  const pen = {
    type: 'freehand',
    variant: 'whiteboard',
    colour: '#e5484d',
    width: 1.5,
    recognise: false,
  } as const;

  it('draws the chosen look in the pen colour', () => {
    const { result } = renderHook(() => useWhiteboardPenCursor(pen, 'dot', 1));
    expect(decodeURIComponent(result.current!)).toContain("fill='#e5484d'");
  });

  it('grows the dot with the zoom, to the stroke width on screen', () => {
    const { result } = renderHook(() => useWhiteboardPenCursor({ ...pen, width: 2.5 }, 'dot', 8));
    expect(decodeURIComponent(result.current!)).toContain("r='10' fill='#e5484d'");
  });

  it('draws a stock colour in its version for the board, and the ink when a marker holds it', () => {
    // docs/specs/023-whiteboard/whiteboard.md "The colour picker"; jsdom resolves the light board.
    const named = renderHook(() => useWhiteboardPenCursor({ ...pen, colour: 'teal' }, 'dot', 1));
    expect(decodeURIComponent(named.result.current!)).toContain(
      `fill='${penColourHex('teal', 'light')}'`,
    );
    const ink = renderHook(() => useWhiteboardPenCursor({ ...pen, colour: null }, 'dot', 1));
    expect(decodeURIComponent(ink.result.current!)).toContain(`fill='${WHITEBOARD_INK.light}'`);
  });

  it('leaves every other intent to its own cursor', () => {
    const { result } = renderHook(() => useWhiteboardPenCursor({ type: 'text' }, 'dot', 1));
    expect(result.current).toBeNull();
  });
});
