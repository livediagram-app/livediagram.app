// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('leaves every other intent to its own cursor', () => {
    const { result } = renderHook(() => useWhiteboardPenCursor({ type: 'text' }, 'dot', 1));
    expect(result.current).toBeNull();
  });
});
