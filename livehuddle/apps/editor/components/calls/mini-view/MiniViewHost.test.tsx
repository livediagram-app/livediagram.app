// @vitest-environment jsdom
// The mini view's host (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md "The
// host"): nothing while closed, the people drawn into the window while open, the window closed with the Space.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { peerAvatarConfig } from '@livehuddle/avatar/config';
import type { AvatarPresence } from '@livehuddle/api-schema';
import { resetCallSelf, setCallSelf } from '@/lib/calls/calls-store';
import { closeMiniView, miniViewWindow, openMiniView } from '@/lib/mini-view/mini-view-window';
import { fakePipWindow, installPip, removePip, type FakePipWindow } from '@/test/fake-pip-window';
import { MiniViewHost } from './MiniViewHost';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const self = { name: 'Me', color: '#0ea5e9', config: peerAvatarConfig(undefined), status: null };
const row = (id: string, name: string, x = 0) => ({
  id,
  name,
  color: '#f43f5e',
  glideMs: 0,
  avatar: {
    x,
    y: 0,
    facing: 'down',
    walking: false,
    stepFrame: 0,
    lift: 0,
    wave: null,
  } as AvatarPresence,
});

let pip: FakePipWindow;
beforeEach(() => {
  pip = fakePipWindow();
  installPip(pip);
});
afterEach(() => {
  cleanup();
  closeMiniView();
  removePip();
  act(() => resetCallSelf());
});

const names = () =>
  Array.from(pip.document.querySelectorAll('li[aria-label]'), (li) =>
    li.getAttribute('aria-label'),
  );

describe('MiniViewHost', () => {
  it('draws nothing while the mini view is closed', () => {
    const { container } = render(
      <MiniViewHost rows={[row('a', 'Sam')]} self={self} tabId="t1" doNotDisturb={false} />,
    );
    expect(container.innerHTML).toBe('');
    expect(pip.document.body.innerHTML).toBe('');
  });

  it('draws the people into the window while it is open, Near You from the call', async () => {
    const { rerender } = render(
      <MiniViewHost rows={[row('a', 'Sam')]} self={self} tabId="t1" doNotDisturb={false} />,
    );
    await act(() => openMiniView());
    expect(names()).toEqual(['You', 'Sam']);
    act(() => setCallSelf({ heard: new Set(['a']) }));
    expect(pip.document.querySelector('section[aria-label="Near You"]')).toBeTruthy();
    // Someone arrives.
    rerender(
      <MiniViewHost
        rows={[row('a', 'Sam'), row('b', 'Ana')]}
        self={self}
        tabId="t1"
        doNotDisturb={false}
      />,
    );
    expect(names()).toEqual(['You', 'Sam', 'Ana']);
  });

  it('closes the window when the Space goes', async () => {
    const { unmount } = render(
      <MiniViewHost rows={[]} self={self} tabId="t1" doNotDisturb={false} />,
    );
    await act(() => openMiniView());
    unmount();
    expect(pip.close).toHaveBeenCalledTimes(1);
    expect(miniViewWindow()).toBeNull();
  });
});
