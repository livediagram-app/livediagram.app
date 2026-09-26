// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => trackMock(...a) }));

const { useCanvasMobileDock, useOpenDockPanelOnChange } = await import('./useCanvasMobileDock');
type MobilePanel = import('./useCanvasMobileDock').MobilePanel;

describe('useOpenDockPanelOnChange', () => {
  it('opens the panel once per new key, and not while the key is absent', () => {
    const open = vi.fn();
    const { rerender } = renderHook(
      ({ key }: { key: string | null }) => useOpenDockPanelOnChange(key, 'poll', open),
      { initialProps: { key: null as string | null } },
    );
    expect(open).not.toHaveBeenCalled();

    rerender({ key: 'poll-1' });
    expect(open).toHaveBeenCalledWith('poll');
    expect(open).toHaveBeenCalledTimes(1);

    // Re-renders with the same poll must not reopen a panel the user closed.
    rerender({ key: 'poll-1' });
    expect(open).toHaveBeenCalledTimes(1);

    rerender({ key: 'poll-2' });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('calls the latest opener, not the one from the first render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ key, open }: { key: string | null; open: (id: MobilePanel) => void }) =>
        useOpenDockPanelOnChange(key, 'vote', open),
      { initialProps: { key: null as string | null, open: first } },
    );
    rerender({ key: 'vote', open: second });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('vote');
  });
});

// docs/specs/017-telemetry/telemetry.md: the dock / popover layouts open Layers and Activity here rather
// than through the desktop un-minimise toggle, so they count here.
describe('useCanvasMobileDock panel-open telemetry', () => {
  beforeEach(() => trackMock.mockReset());

  it('counts a Layers and an Activity open through the dock path', () => {
    const { result } = renderHook(() => useCanvasMobileDock({ current: null }));
    act(() => result.current.handleDockButtonClick('layers'));
    act(() => result.current.handleDockButtonClick('activity'));
    expect(trackMock.mock.calls).toEqual([
      ['Layer', 'Opened', 'Panel'],
      ['UI', 'Opened', 'Activity'],
    ]);
  });

  it('does not count a close, or re-opening the panel already open', () => {
    const { result } = renderHook(() => useCanvasMobileDock({ current: null }));
    act(() => result.current.handleDockButtonClick('layers'));
    act(() => result.current.openDockPanel('layers'));
    act(() => result.current.handleDockButtonClick('layers'));
    expect(trackMock).toHaveBeenCalledOnce();
  });

  it('counts nothing for the other dock panels', () => {
    const { result } = renderHook(() => useCanvasMobileDock({ current: null }));
    act(() => result.current.handleDockButtonClick('palette'));
    act(() => result.current.openDockPanel('poll'));
    expect(trackMock).not.toHaveBeenCalled();
  });
});
