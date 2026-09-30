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
    const { result } = renderHook(() => useWhiteboardPenCursor(pen, 'dot'));
    expect(decodeURIComponent(result.current!)).toContain("fill='#e5484d'");
  });

  it('leaves every other intent to its own cursor', () => {
    const { result } = renderHook(() => useWhiteboardPenCursor({ type: 'text' }, 'dot'));
    expect(result.current).toBeNull();
  });
});
