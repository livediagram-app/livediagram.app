// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCanvasTool } from './useCanvasTool';

// Avatar mode ends when the tab changes (docs/specs/008-canvas/avatar-mode.md "Changing tab").
describe('useCanvasTool: changing tab', () => {
  const setup = (defaultPan = false) =>
    renderHook(({ tabId }) => useCanvasTool({ defaultPan, tabId }), {
      initialProps: { tabId: 'tab-1' },
    });

  it('leaves Avatar mode for the Select tool it was entered from', () => {
    const { result, rerender } = setup();
    expect(result.current.canvasTool).toBe('select');
    act(() => result.current.selectCanvasTool('avatar'));
    expect(result.current.canvasTool).toBe('avatar');
    rerender({ tabId: 'tab-2' });
    expect(result.current.canvasTool).toBe('select');
  });

  it('leaves Avatar mode for the Hand tool when that was the tool before it', () => {
    const { result, rerender } = setup(true);
    act(() => result.current.selectCanvasTool('avatar'));
    rerender({ tabId: 'tab-2' });
    expect(result.current.canvasTool).toBe('pan');
  });

  it('keeps Avatar mode while the tab stays the same', () => {
    const { result, rerender } = setup();
    act(() => result.current.selectCanvasTool('avatar'));
    rerender({ tabId: 'tab-1' });
    expect(result.current.canvasTool).toBe('avatar');
  });

  it('leaves every other tool alone on a tab change', () => {
    const { result, rerender } = setup();
    act(() => result.current.selectCanvasTool('laser'));
    rerender({ tabId: 'tab-2' });
    expect(result.current.canvasTool).toBe('laser');
  });

  it('never changes tool when no tab is given', () => {
    const { result } = renderHook(() => useCanvasTool());
    act(() => result.current.selectCanvasTool('avatar'));
    expect(result.current.canvasTool).toBe('avatar');
  });
});
