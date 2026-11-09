// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCanvasTool } from './useCanvasTool';

// A tool stays chosen across a tab change: no mode ends with its tab now Avatar mode has moved to livehuddle
// (docs/specs/009-elements/retired-elements.md).
describe('useCanvasTool', () => {
  it('starts on Hand when asked to, and on Select otherwise', () => {
    expect(renderHook(() => useCanvasTool({ defaultPan: true })).result.current.canvasTool).toBe(
      'pan',
    );
    expect(renderHook(() => useCanvasTool()).result.current.canvasTool).toBe('select');
  });

  it('keeps the tool picked', () => {
    const { result } = renderHook(() => useCanvasTool());
    act(() => result.current.selectCanvasTool('laser'));
    expect(result.current.canvasTool).toBe('laser');
  });
});
