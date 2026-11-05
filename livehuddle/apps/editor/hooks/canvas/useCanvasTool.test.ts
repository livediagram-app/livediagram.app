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
    act(() => result.current.selectCanvasTool('eraser'));
    rerender({ tabId: 'tab-2' });
    expect(result.current.canvasTool).toBe('eraser');
  });

  // Travel (an Elevator ride, a Portal, the Directory's Go) keeps the mode; the next manual switch still ends it.
  it('keeps Avatar mode through an Elevator trip, and only that one change of tab', () => {
    const { result, rerender } = setup();
    act(() => result.current.selectCanvasTool('avatar'));
    act(() => result.current.keepWalkingTo('tab-2'));
    rerender({ tabId: 'tab-2' });
    expect(result.current.canvasTool).toBe('avatar');
    act(() => result.current.keepWalkingTo('tab-1'));
    rerender({ tabId: 'tab-1' });
    expect(result.current.canvasTool).toBe('avatar');
    rerender({ tabId: 'tab-2' });
    expect(result.current.canvasTool).toBe('select');
  });

  it('a travel mark for another tab does not keep the mode on a different switch', () => {
    const { result, rerender } = setup();
    act(() => result.current.selectCanvasTool('avatar'));
    act(() => result.current.keepWalkingTo('tab-3'));
    rerender({ tabId: 'tab-2' });
    expect(result.current.canvasTool).toBe('select');
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
    act(() => result.current.selectCanvasTool('eraser'));
    act(() => result.current.selectCanvasTool('avatar'));
    act(() => result.current.openWalking());
    expect(result.current.canvasTool).toBe('avatar');
    expect(result.current.toolBeforeCurrent()).toBe('eraser');
  });
});

// A Participant is always walking (docs/specs/013-workspace/share-roles.md "A Participant walks"): the editor holds
// the mode as it renders, and no pick, key, palette reach or change of tab takes it out.
describe('useCanvasTool: held walking', () => {
  const setup = () =>
    renderHook(
      ({ tabId, hold }) => {
        const tool = useCanvasTool({ tabId });
        tool.holdWalking(hold);
        return tool;
      },
      { initialProps: { tabId: 'tab-1', hold: true } },
    );

  it('walks from the first frame', () => {
    const { result } = setup();
    expect(result.current.canvasTool).toBe('avatar');
  });

  it('refuses every way out while held', () => {
    const { result, rerender } = setup();
    act(() => result.current.selectCanvasTool('pan'));
    act(() => result.current.setCanvasTool('select'));
    act(() => result.current.exitAvatarTool());
    expect(result.current.canvasTool).toBe('avatar');
    rerender({ tabId: 'tab-2', hold: true });
    expect(result.current.canvasTool).toBe('avatar');
  });

  it('hands back the tool underneath once let go (a preview ending)', () => {
    const { result, rerender } = setup();
    rerender({ tabId: 'tab-1', hold: false });
    expect(result.current.canvasTool).not.toBe('avatar');
    act(() => result.current.selectCanvasTool('pan'));
    expect(result.current.canvasTool).toBe('pan');
  });
});
