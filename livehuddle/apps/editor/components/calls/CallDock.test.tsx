// @vitest-environment jsdom
// The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): the call's buttons on a card of their own,
// bottom centre, named on a desktop and glyphs alone on a phone, the Screen Share group after them while you share.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCallSelf, setCallActions, setCallSelf, type CallSelf } from '@/lib/calls/calls-store';
import { CallDock } from './CallDock';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));

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
  vi.clearAllMocks();
});

describe('CallDock', () => {
  it('holds the call group on its card, bottom centre', () => {
    render(<CallDock />);
    show(live);
    const dock = document.querySelector<HTMLElement>('[data-call-dock]')!;
    expect(dock.getAttribute('data-region')).toBe('call');
    for (const cls of ['bottom-4', 'left-1/2', '-translate-x-1/2'])
      expect(dock.className).toContain(cls);
    const group = screen.getByRole('group', { name: 'Call' });
    expect(card().contains(group)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
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
  it('names each button on a desktop', () => {
    render(<CallDock />);
    show(live);
    expect(screen.getByRole('button', { name: 'Mute' }).textContent).toBe('Mic');
    expect(screen.getByRole('button', { name: 'Turn On Camera' }).textContent).toBe('Camera');
    expect(screen.getByRole('button', { name: 'Share Screen' }).textContent).toBe('Share');
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
});
