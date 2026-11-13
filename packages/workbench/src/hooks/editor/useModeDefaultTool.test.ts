// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { modeDefaultTool, useModeDefaultTool } from './useModeDefaultTool';

describe('modeDefaultTool', () => {
  it('starts on Select, and on Hand on a phone', () => {
    expect(modeDefaultTool(false)).toBe('select');
    expect(modeDefaultTool(true)).toBe('pan');
  });
});

describe('useModeDefaultTool', () => {
  it('picks the start tool once, Hand for an embedded viewer, and leaves a tool already right', () => {
    const setCanvasTool = vi.fn();
    const { rerender } = renderHook(
      ({ tool }: { tool: string }) => useModeDefaultTool(tool, setCanvasTool, true),
      { initialProps: { tool: 'pen' } },
    );
    expect(setCanvasTool).toHaveBeenCalledExactlyOnceWith('pan');
    rerender({ tool: 'text' });
    expect(setCanvasTool).toHaveBeenCalledOnce();
    const untouched = vi.fn();
    renderHook(() => useModeDefaultTool('select', untouched));
    expect(untouched).not.toHaveBeenCalled();
  });
});
