// @vitest-environment jsdom
// The mini view's window (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md "The
// window"): one a tab, opened from a press, forgotten when closed.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import {
  closeMiniView,
  focusSpace,
  MINI_VIEW_HEIGHT,
  MINI_VIEW_TITLE,
  MINI_VIEW_WIDTH,
  miniViewSupported,
  miniViewWindow,
  openMiniView,
  toggleMiniView,
  useMiniViewSupported,
  useMiniViewWindow,
} from './mini-view-window';
import { fakePipWindow, installPip, removePip, type FakePipWindow } from '@/test/fake-pip-window';

let requestWindow: ReturnType<typeof vi.fn>;
let pip: FakePipWindow;

beforeEach(() => {
  pip = fakePipWindow();
  requestWindow = installPip(pip);
});

afterEach(() => {
  closeMiniView();
  removePip();
  vi.restoreAllMocks();
  track.mockClear();
});

describe('miniViewSupported', () => {
  it('is true only where Document Picture-in-Picture can request a window', () => {
    expect(miniViewSupported()).toBe(true);
    expect(miniViewSupported({})).toBe(false);
    expect(miniViewSupported({ documentPictureInPicture: {} })).toBe(false);
    expect(miniViewSupported(null)).toBe(false);
  });

  it('reads through a hook', () => {
    const { result } = renderHook(() => useMiniViewSupported());
    expect(result.current).toBe(true);
  });
});

describe('openMiniView', () => {
  it('opens one window at the mini view’s size, titled, and counts it', async () => {
    const { result } = renderHook(() => useMiniViewWindow());
    await act(() => openMiniView());
    expect(requestWindow).toHaveBeenCalledWith({
      width: MINI_VIEW_WIDTH,
      height: MINI_VIEW_HEIGHT,
    });
    expect(result.current).toBe(pip);
    expect(pip.document.title).toBe(MINI_VIEW_TITLE);
    expect(pip.document.body.style.margin).toBe('0px');
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'SpaceMiniView');
  });

  it('does nothing while open, or while a request is in flight', async () => {
    await act(() => Promise.all([openMiniView(), openMiniView()]));
    expect(requestWindow).toHaveBeenCalledTimes(1);
    await act(() => openMiniView());
    expect(requestWindow).toHaveBeenCalledTimes(1);
  });

  it('logs a refusal and opens nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    requestWindow.mockRejectedValueOnce(
      Object.assign(new Error('no'), { name: 'NotAllowedError' }),
    );
    await act(() => openMiniView());
    expect(miniViewWindow()).toBeNull();
    expect(warn).toHaveBeenCalledWith('[mini-view] open refused', 'NotAllowedError');
    expect(track).not.toHaveBeenCalled();
    requestWindow.mockRejectedValueOnce(null);
    await act(() => openMiniView());
    expect(warn).toHaveBeenLastCalledWith('[mini-view] open refused', 'Error');
  });

  it('does nothing without the API', async () => {
    removePip();
    await act(() => openMiniView());
    expect(miniViewWindow()).toBeNull();
  });
});

describe('closing', () => {
  it('forgets the window when the person closes it, removing its listener', async () => {
    const { result } = renderHook(() => useMiniViewWindow());
    await act(() => openMiniView());
    act(() => pip.fire('pagehide'));
    expect(result.current).toBeNull();
    expect(pip.removeEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
    expect(pip.close).not.toHaveBeenCalled();
  });

  it('closes the window from Popped Out, and does nothing when none is open', async () => {
    await act(() => openMiniView());
    act(() => closeMiniView());
    expect(pip.close).toHaveBeenCalledTimes(1);
    expect(miniViewWindow()).toBeNull();
    closeMiniView();
    expect(pip.close).toHaveBeenCalledTimes(1);
  });

  it('toggles: open when closed, closed when open', async () => {
    await act(async () => {
      toggleMiniView();
      await Promise.resolve();
    });
    expect(miniViewWindow()).toBe(pip);
    act(() => toggleMiniView());
    expect(miniViewWindow()).toBeNull();
    expect(pip.close).toHaveBeenCalledTimes(1);
  });
});

describe('focusSpace', () => {
  it('brings the Space’s window to the front', () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    focusSpace();
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
