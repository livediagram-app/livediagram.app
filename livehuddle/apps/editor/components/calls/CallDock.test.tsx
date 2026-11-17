// @vitest-environment jsdom
// The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): the call's buttons on a card of their own, in
// the bottom-right cluster's row, named in a wide desktop window and glyphs alone on a phone or a narrower window, the
// Screen Share group after them while you share.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCallSelf, setCallActions, setCallSelf, type CallSelf } from '@/lib/calls/calls-store';
import { closeMiniView } from '@/lib/mini-view/mini-view-window';
import { fakePipWindow, installPip, removePip } from '@/test/fake-pip-window';
import { UiScaleProvider } from '@liveworkspace/workbench/components/providers/ui-scale';
import { CALL_DOCK_NAMED_QUERY, CallDock } from './CallDock';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));

// The window's width against CALL_DOCK_NAMED_QUERY (1024 px and up), read live through matchMedia.
const wide = { value: true };
const realMatchMedia = window.matchMedia;
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === CALL_DOCK_NAMED_QUERY && wide.value;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterAll(() => {
  window.matchMedia = realMatchMedia;
});

const actions = {
  join: vi.fn(),
  toggleMute: vi.fn(),
  toggleCamera: vi.fn(),
  toggleScreen: vi.fn(),
  raiseHand: vi.fn(),
  lowerHand: vi.fn(),
};

function show(patch: Partial<CallSelf>) {
  act(() => {
    setCallActions(actions);
    setCallSelf({ available: true, canSpeak: true, ...patch });
  });
}

const live = { phase: 'live', mic: 'open', someoneNear: true, canShare: true } as const;
const card = () => document.querySelector<HTMLElement>('[data-call-dock] > [data-floating-panel]')!;

afterEach(() => {
  cleanup();
  act(() => resetCallSelf());
  mobile.value = false;
  wide.value = true;
  vi.clearAllMocks();
});

describe('CallDock', () => {
  // In the bottom-right cluster's row at every width (call-dock-row.ts places it; Work Tracker 1041): never floating
  // at half the canvas's width, where Pop Out was squeezed past the card and over the zoom buttons.
  it.each([
    ['a desktop', false],
    ['a phone', true],
  ])(
    'holds the call group on its card in the cluster row’s middle column on %s',
    (_where, isMobile) => {
      mobile.value = isMobile;
      render(<CallDock />);
      show(live);
      const dock = document.querySelector<HTMLElement>('[data-call-dock]')!;
      expect(dock.getAttribute('data-region')).toBe('call');
      expect(dock.className.split(' ')).toEqual(
        expect.arrayContaining(['col-start-2', 'row-start-1', 'flex', 'w-max', 'justify-center']),
      );
      for (const cls of ['absolute', 'bottom-4', 'left-1/2', '-translate-x-1/2'])
        expect(dock.className.split(' ')).not.toContain(cls);
      // Unscaled chrome: the dock takes no zoom of its own.
      expect(dock.getAttribute('style')).toBeNull();
      const group = screen.getByRole('group', { name: 'Call' });
      expect(card().contains(group)).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
      expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    },
  );

  // The row is drawn at the corner buttons' UI scale; the dock keeps the toolbar's by taking the difference.
  it('draws at the toolbar’s UI scale inside the corner buttons’ row', () => {
    render(
      <UiScaleProvider value={{ panels: 1, toolbar: 1.15, cornerButtons: 1 }}>
        <CallDock />
      </UiScaleProvider>,
    );
    show(live);
    expect(document.querySelector<HTMLElement>('[data-call-dock]')!.style.zoom).toBe('1.15');
    cleanup();
    render(
      <UiScaleProvider value={{ panels: 1, toolbar: 1.15, cornerButtons: 1.15 }}>
        <CallDock />
      </UiScaleProvider>,
    );
    show(live);
    expect(
      document.querySelector<HTMLElement>('[data-call-dock]')!.getAttribute('style'),
    ).toBeNull();
  });

  it('adds a divider and the Screen Share group only while you share', () => {
    render(<CallDock />);
    show(live);
    expect(screen.queryByRole('group', { name: 'Screen Share' })).toBeNull();
    expect(card().querySelector('[data-strip-divider]')).toBeNull();
    show({ ...live, screen: 'on' });
    const group = screen.getByRole('group', { name: 'Call' });
    const divider = group.nextElementSibling!;
    expect(divider.hasAttribute('data-strip-divider')).toBe(true);
    expect(divider.nextElementSibling).toBe(screen.getByRole('group', { name: 'Screen Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop Sharing' }));
    expect(actions.toggleScreen).toHaveBeenCalledTimes(1);
    show({ ...live, screen: 'off' });
    expect(screen.queryByRole('group', { name: 'Screen Share' })).toBeNull();
    expect(card().querySelector('[data-strip-divider]')).toBeNull();
  });

  // Owner, 2026-11-07: "On desktop add short labels to each, on mobile do not".
  it('names each button in a desktop window 1024 px wide and up', () => {
    render(<CallDock />);
    show(live);
    expect(screen.getByRole('button', { name: 'Mute' }).textContent).toBe('Mic');
    expect(screen.getByRole('button', { name: 'Turn On Camera' }).textContent).toBe('Camera');
    expect(screen.getByRole('button', { name: 'Share Screen' }).textContent).toBe('Share');
  });

  // Below 1024 px the names would not fit beside the zoom buttons (Work Tracker 1041).
  it('shows glyphs alone in a narrower desktop window', () => {
    wide.value = false;
    render(<CallDock />);
    show(live);
    for (const name of ['Mute', 'Turn On Camera', 'Share Screen'])
      expect(screen.getByRole('button', { name }).textContent, name).toBe('');
  });

  it('shows glyphs alone on a phone', () => {
    mobile.value = true;
    render(<CallDock />);
    show({ ...live, screen: 'on' });
    for (const name of ['Mute', 'Turn On Camera'])
      expect(screen.getByRole('button', { name }).textContent, name).toBe('');
    expect(screen.getByRole('button', { name: 'Stop Sharing' }).textContent).toBe('');
  });

  it('shows Do Not Disturb, and a press clears it', () => {
    const clear = vi.fn();
    render(<CallDock doNotDisturb onClearDoNotDisturb={clear} />);
    show(live);
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off Do Not Disturb' }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  // The card draws nothing (`empty:hidden`) for a role with no call and no preview.
  it('leaves its card empty with nothing to show, and hidden by its class', () => {
    render(<CallDock />);
    expect(card().childElementCount).toBe(0);
    expect(card().className).toContain('empty:hidden');
    show({ available: false, canSpeak: false });
    expect(card().childElementCount).toBe(0);
  });

  it('keeps a press and a right-click on the card from the canvas', () => {
    const onPointerDown = vi.fn();
    const onContextMenu = vi.fn();
    render(
      <div onPointerDown={onPointerDown} onContextMenu={onContextMenu}>
        <CallDock />
      </div>,
    );
    show(live);
    fireEvent.pointerDown(card());
    const menu = fireEvent.contextMenu(card());
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onContextMenu).not.toHaveBeenCalled();
    // The browser's own menu is kept away too.
    expect(menu).toBe(false);
  });

  // The mini view's Pop Out (avatar-mode.md "The mini view"): last on the dock, only where the browser can open one,
  // for every share role, behind a divider whenever something precedes it.
  describe('Pop Out', () => {
    beforeEach(() => {
      installPip(fakePipWindow());
    });
    afterEach(() => {
      closeMiniView();
      removePip();
    });

    const popOut = () => screen.getByRole('button', { name: 'Pop Out' });

    it.each([
      ['an Editor', { ...live, canShare: true }],
      ['a Participant', { ...live, canShare: false }],
      ['a Viewer', { phase: 'live', canSpeak: false, canShare: false }],
    ] as const)('ends the dock for %s, after a divider', (_role, self) => {
      render(<CallDock />);
      show(self);
      const button = popOut();
      expect(card().lastElementChild?.contains(button)).toBe(true);
      const group = screen.getByRole('group', { name: 'Call' });
      expect(group.nextElementSibling?.hasAttribute('data-strip-divider')).toBe(true);
    });

    it('stands alone, with no divider, on a Viewer’s dock with no call and no preview', () => {
      render(<CallDock />);
      show({ available: false, canSpeak: false });
      expect(card().querySelector('[data-strip-divider]')).toBeNull();
      expect(card().childElementCount).toBeGreaterThan(0);
      expect(popOut()).toBeTruthy();
    });

    it('follows the Screen Share group while you share', () => {
      render(<CallDock />);
      show({ ...live, screen: 'on' });
      const share = screen.getByRole('group', { name: 'Screen Share' });
      expect(share.nextElementSibling?.hasAttribute('data-strip-divider')).toBe(true);
      expect(card().lastElementChild?.contains(popOut())).toBe(true);
    });

    it('is absent where the browser has no Document Picture-in-Picture', () => {
      removePip();
      render(<CallDock />);
      show(live);
      expect(screen.queryByRole('button', { name: 'Pop Out' })).toBeNull();
    });
  });
});
