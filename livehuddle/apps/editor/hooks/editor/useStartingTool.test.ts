// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { startingTool, useStartingTool } from './useStartingTool';

// docs/specs/007-editor/editor-modes.md "The tool it starts with".
describe('startingTool', () => {
  it('starts on Select, and on Hand on a phone', () => {
    expect(startingTool(false)).toBe('select');
    expect(startingTool(true)).toBe('pan');
  });
});

describe('useStartingTool', () => {
  it('picks the starting tool once, and leaves a later pick alone', () => {
    const set = vi.fn();
    const { rerender } = renderHook(({ tool }) => useStartingTool(tool, set), {
      initialProps: { tool: 'avatar' as 'avatar' | 'select' },
    });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('select');
    rerender({ tool: 'avatar' });
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('starts an embed on Hand, and sets nothing when the tool is already the one', () => {
    const set = vi.fn();
    renderHook(() => useStartingTool('select', set, true));
    expect(set).toHaveBeenCalledWith('pan');
    const none = vi.fn();
    renderHook(() => useStartingTool('select', none));
    expect(none).not.toHaveBeenCalled();
  });
});
