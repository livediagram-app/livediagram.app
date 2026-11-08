// @vitest-environment jsdom

// The Receptionist on the canvas (docs/specs/008-canvas/receptionist.md): drawn on a tab with an Avatar Pad, pressed to Ask Receptionist,
// his bubble over his head, closed by Escape or by walking away. Reduced motion stands him by his pad, so his place is
// known.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';
import type { PadArrival } from '@liveworkspace/avatar/pad';
import {
  askReceptionist,
  getReceptionistState,
  resetReceptionistState,
  showReceptionistTopic,
} from '@/lib/receptionist/receptionist-store';
import { receiveBellOp, resetBell, ringBell } from '@/lib/office/reception-bell';
import { ReceptionistLayer } from './ReceptionistLayer';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/timer-chime', () => ({ playTones: vi.fn() }));

const pad = {
  id: 'pad-1',
  type: 'shape',
  shape: 'avatar-pad',
  x: 0,
  y: 0,
  width: 80,
  height: 80,
} as unknown as Element;
const home = { x: 108, y: 40 };
const desk = {
  id: 'desk-1',
  type: 'shape',
  shape: 'reception-desk',
  x: 200,
  y: 100,
  width: 120,
  height: 40,
} as unknown as Element;
const ring = (from: string) =>
  receiveBellOp(from, { kind: 'avatar-bell', tabId: 't1', deskId: 'desk-1' });

const layer = (over: Partial<Parameters<typeof ReceptionistLayer>[0]> = {}) => (
  <ReceptionistLayer
    active
    elements={[pad]}
    arrivals={[]}
    self={{ x: 150, y: 40 }}
    zoom={1}
    {...over}
  />
);

beforeEach(() => {
  document.documentElement.classList.add('reduce-motion');
  resetReceptionistState();
});
afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('reduce-motion');
  resetReceptionistState();
  resetBell();
  track.mockReset();
  vi.useRealTimers();
});

describe('ReceptionistLayer', () => {
  it('draws nobody on a tab with no Avatar Pad, or while you are not walking', () => {
    const { container, rerender } = render(layer({ elements: [] }));
    expect(container.querySelector('[data-receptionist]')).toBeNull();
    expect(getReceptionistState().here).toBe(false);
    rerender(layer({ active: false }));
    expect(container.querySelector('[data-receptionist]')).toBeNull();
  });

  it('stands by his pad, says he is here, and a press asks him', () => {
    render(layer());
    const press = screen.getByRole('button', { name: 'Ask Receptionist' });
    // His feet are home; the press box is centred on them.
    expect(parseFloat(press.style.left) + parseFloat(press.style.width) / 2).toBe(home.x);
    expect(getReceptionistState().here).toBe(true);
    fireEvent.pointerDown(press);
    fireEvent.click(press);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AskReceptionist');
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'ask' });
    expect(screen.getByRole('dialog', { name: 'Receptionist' })).toBeTruthy();
  });

  it('closes on Escape, but not while you type in a field', () => {
    render(
      <>
        {layer()}
        <input aria-label="field" />
      </>,
    );
    act(() => askReceptionist());
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'Escape' });
    expect(getReceptionistState().chat.open).toBe(true);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(getReceptionistState().chat.open).toBe(true);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    act(() => {
      window.dispatchEvent(escape);
    });
    expect(escape.defaultPrevented).toBe(true);
    expect(getReceptionistState().chat.open).toBe(false);
  });

  it('closes when you walk away, but not while he walks you to a room', () => {
    const { rerender } = render(layer());
    act(() => askReceptionist());
    act(() => showReceptionistTopic('rooms'));
    rerender(layer({ self: { x: 2000, y: 40 } }));
    expect(getReceptionistState().chat.open).toBe(true);
    act(() => showReceptionistTopic(null));
    rerender(layer({ self: { x: 2100, y: 40 } }));
    expect(getReceptionistState().chat.open).toBe(false);
  });

  it('greets your arrival on his pad at once, with motion reduced', () => {
    const arrival = {
      key: 'a1',
      personId: 'self',
      padId: 'pad-1',
      x: 40,
      y: 40,
    } as unknown as PadArrival;
    const peer = {
      key: 'a2',
      personId: 'peer',
      padId: 'pad-1',
      x: 40,
      y: 40,
    } as unknown as PadArrival;
    const other = {
      key: 'a3',
      personId: 'self',
      padId: 'pad-9',
      x: 40,
      y: 40,
    } as unknown as PadArrival;
    const { rerender } = render(layer());
    rerender(layer({ arrivals: [arrival, peer, other] }));
    expect(getReceptionistState().greets).toBe(1);
    rerender(layer({ arrivals: [arrival, peer, other] }));
    expect(getReceptionistState().greets).toBe(1);
  });

  it('says he has gone when it unmounts', () => {
    const { unmount } = render(layer());
    unmount();
    expect(getReceptionistState().here).toBe(false);
  });

  it('opens at a bell you rang where he stands, with motion reduced, and not for someone else’s', () => {
    render(layer({ elements: [pad, desk] }));
    act(() => ring('tab-sam'));
    expect(getReceptionistState().chat.open).toBe(false);
    act(() => {
      ringBell('desk-1');
    });
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'bell' });
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ReceptionistBell');
  });

  it('walks behind the desk whose bell you rang, and opens his bubble once there', () => {
    document.documentElement.classList.remove('reduce-motion');
    vi.useFakeTimers();
    const { container } = render(layer({ elements: [pad, desk] }));
    act(() => askReceptionist());
    act(() => {
      ringBell('desk-1');
    });
    // His bubble moves with him: it closes as he sets off.
    expect(getReceptionistState().chat.open).toBe(false);
    for (let i = 0; i < 100 && !getReceptionistState().chat.open; i += 1)
      act(() => {
        vi.advanceTimersByTime(100);
      });
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'bell' });
    const press = container.querySelector<HTMLElement>('[data-receptionist]')!;
    expect(parseFloat(press.style.left) + parseFloat(press.style.width) / 2).toBe(230);
  });

  it('keeps his bubble open when you ask him from across the room, before he sets off', () => {
    document.documentElement.classList.remove('reduce-motion');
    vi.useFakeTimers();
    // A moment his day stands him over 400 px from you: the render that opens his bubble used to close it as "too far".
    vi.setSystemTime(Date.UTC(2026, 10, 8, 0, 30, 20));
    render(layer({ elements: [pad, desk] }));
    act(() => askReceptionist());
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'ask' });
  });

  it('finishes with you first when somebody else rings, and ignores a desk not on the tab', () => {
    document.documentElement.classList.remove('reduce-motion');
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 8, 15, 31, 20));
    render(layer({ elements: [pad, desk] }));
    act(() => askReceptionist());
    act(() => ring('tab-sam'));
    act(() => {
      receiveBellOp('tab-sam', { kind: 'avatar-bell', tabId: 't1', deskId: 'gone' });
    });
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'ask' });
  });
});
