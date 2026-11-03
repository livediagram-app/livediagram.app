// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/telemetry';
import { useCanvasTool } from './useCanvasTool';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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

// Opening walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"): the same entry as a pick, remembered so
// every way out leads back, but uncounted.
describe('useCanvasTool: openWalking', () => {
  it('enters Avatar mode and leaves it for the tool you were in', () => {
    const { result } = renderHook(() => useCanvasTool({ defaultPan: true }));
    act(() => result.current.openWalking());
    expect(result.current.canvasTool).toBe('avatar');
    expect(result.current.toolBeforeCurrent()).toBe('pan');
    act(() => result.current.exitAvatarTool());
    expect(result.current.canvasTool).toBe('pan');
  });

  it('fires no Canvas·Used event', () => {
    vi.mocked(track).mockClear();
    const { result } = renderHook(() => useCanvasTool());
    act(() => result.current.openWalking());
    expect(result.current.canvasTool).toBe('avatar');
    expect(track).not.toHaveBeenCalled();
    // A pick of it is counted, as before.
    act(() => result.current.exitAvatarTool());
    act(() => result.current.selectCanvasTool('avatar'));
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'AvatarMode');
  });

  it('does nothing while already walking', () => {
    const { result } = renderHook(() => useCanvasTool());
    act(() => result.current.selectCanvasTool('laser'));
    act(() => result.current.selectCanvasTool('avatar'));
    act(() => result.current.openWalking());
    expect(result.current.canvasTool).toBe('avatar');
    expect(result.current.toolBeforeCurrent()).toBe('laser');
  });
});
