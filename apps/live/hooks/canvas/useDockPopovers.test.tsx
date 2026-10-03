// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => trackMock(...a) }));

const { useDockPopovers } = await import('./useDockPopovers');

const button = () => document.createElement('button');

// docs/specs/017-telemetry/telemetry.md: the popover layouts open Layers and Activity here rather
// than through the desktop un-minimise toggle, so they count here.
describe('useDockPopovers panel-open telemetry', () => {
  beforeEach(() => trackMock.mockReset());

  it('counts a Layers and a Collaborate open through the popover path', () => {
    const { result } = renderHook(() => useDockPopovers({ current: null }));
    act(() => result.current.handleDockButtonClick('layers', button()));
    act(() => result.current.handleDockButtonClick('collaborate', button()));
    expect(trackMock.mock.calls).toEqual([
      ['Layer', 'Opened', 'Panel'],
      ['UI', 'Opened', 'Collaborate'],
    ]);
  });

  it('does not count a close', () => {
    const { result } = renderHook(() => useDockPopovers({ current: null }));
    act(() => result.current.handleDockButtonClick('layers', button()));
    act(() => result.current.handleDockButtonClick('layers', button()));
    expect(trackMock).toHaveBeenCalledOnce();
    expect(result.current.activeDockPanel).toBeNull();
  });

  it('counts nothing for the Explorer', () => {
    const { result } = renderHook(() => useDockPopovers({ current: null }));
    act(() => result.current.handleDockButtonClick('explorer', button()));
    expect(trackMock).not.toHaveBeenCalled();
    expect(result.current.activeDockPanel).toBe('explorer');
  });
});
