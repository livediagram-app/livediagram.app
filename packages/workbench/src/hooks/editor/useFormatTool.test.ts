// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFormatTool } from './useFormatTool';

type Tool = 'select' | 'pen' | 'format';

describe('useFormatTool', () => {
  it('starts each Format visit clean and returns to the tool it came from', () => {
    const setCanvasTool = vi.fn();
    const setFormatSourceId = vi.fn();
    const { result, rerender } = renderHook(
      ({ canvasTool }: { canvasTool: Tool }) =>
        useFormatTool<Tool>({ canvasTool, setCanvasTool, setFormatSourceId }),
      { initialProps: { canvasTool: 'pen' } },
    );
    expect(result.current.formatToolActive).toBe(false);
    expect(setFormatSourceId).not.toHaveBeenCalled();
    rerender({ canvasTool: 'format' });
    expect(result.current.formatToolActive).toBe(true);
    expect(setFormatSourceId).toHaveBeenLastCalledWith(null);
    result.current.exitFormatTool();
    expect(setCanvasTool).toHaveBeenLastCalledWith('pen');
    rerender({ canvasTool: 'select' });
    expect(setFormatSourceId).toHaveBeenCalledTimes(2);
  });

  it('falls back to Select when Format was where it started', () => {
    const setCanvasTool = vi.fn();
    const { result } = renderHook(() =>
      useFormatTool<Tool>({ canvasTool: 'format', setCanvasTool, setFormatSourceId: vi.fn() }),
    );
    result.current.exitFormatTool();
    expect(setCanvasTool).toHaveBeenLastCalledWith('select');
  });
});
