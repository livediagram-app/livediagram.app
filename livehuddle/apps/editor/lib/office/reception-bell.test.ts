// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BELL_THROTTLE_MS } from '@livehuddle/api-schema';
import { createShape, type CallZone, type Element } from '@livehuddle/document';

const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const playTones = vi.fn();
vi.mock('@/lib/timer-chime', () => ({
  playTones: (...a: unknown[]): void => {
    playTones(...a);
  },
}));

import { track } from '@/lib/telemetry';
import {
  BELL_RADIUS,
  bellToast,
  hearsBell,
  onBellRung,
  receiveBellOp,
  receptionDesks,
  resetBell,
  ringBell,
  SELF_RINGER,
  useBellRings,
  useBellRung,
  useReceptionBell,
} from './reception-bell';

// docs/specs/009-elements/workday-pieces.md "Reception Desk": who hears the bell, and the wire.

const zone = (id: string, x0: number, y0: number, x1: number, y1: number): CallZone => ({
  id,
  x0,
  y0,
  x1,
  y1,
  area: (x1 - x0) * (y1 - y0),
});
const deskAt = (id: string, x: number, y: number): Element => ({
  ...createShape('reception-desk', x, y),
  id,
});
const zones = [zone('lobby', 0, 0, 800, 600)];
const elements = [deskAt('in-lobby', 100, 100), deskAt('outside', 3000, 3000)];

beforeEach(() => {
  resetBell();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('who hears the reception bell', () => {
  const desks = receptionDesks(elements, zones);

  it("finds each desk's room, and none for a desk in no room", () => {
    expect(desks.get('in-lobby')).toEqual({ at: { x: 200, y: 156 }, room: 'lobby' });
    expect(desks.get('outside')?.room).toBeNull();
  });

  it('rings for everyone in its room, and round a desk in no room within its radius', () => {
    expect(hearsBell(desks.get('in-lobby'), { x: 700, y: 500 }, zones)).toBe(true);
    expect(hearsBell(desks.get('in-lobby'), { x: 900, y: 200 }, zones)).toBe(false);
    const out = desks.get('outside')!;
    expect(hearsBell(out, { x: out.at.x + BELL_RADIUS, y: out.at.y }, zones)).toBe(true);
    expect(hearsBell(out, { x: out.at.x + BELL_RADIUS + 1, y: out.at.y }, zones)).toBe(false);
    // A desk not on this board, or nobody walking, rings nobody.
    expect(hearsBell(undefined, { x: 1, y: 1 }, zones)).toBe(false);
    expect(hearsBell(desks.get('in-lobby'), null, zones)).toBe(false);
  });

  it('names who rang, or Someone', () => {
    expect(bellToast('Sam')).toBe('Sam rang the bell at Reception');
    expect(bellToast('  ')).toBe('Someone rang the bell at Reception');
    expect(bellToast(undefined)).toBe('Someone rang the bell at Reception');
  });
});

describe('ringing the bell', () => {
  it('rings once per five seconds, heard by the ringer, and reads Rang until then', () => {
    vi.useFakeTimers();
    const rung = renderHook(() => useBellRung());
    const rings = renderHook(() => useBellRings('in-lobby'));
    expect(rung.result.current).toBe(false);
    let first = false;
    act(() => {
      first = ringBell('in-lobby');
    });
    expect(first).toBe(true);
    expect(rung.result.current).toBe(true);
    expect(rings.result.current).toBe(1);
    expect(playTones).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'ReceptionBell');
    expect(ringBell('in-lobby')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(BELL_THROTTLE_MS);
    });
    expect(rung.result.current).toBe(false);
    expect(ringBell('in-lobby')).toBe(true);
  });
});

describe('the bell on the canvas', () => {
  const send = vi.fn();
  const mount = (over: Partial<Parameters<typeof useReceptionBell>[0]> = {}) =>
    renderHook((props: Parameters<typeof useReceptionBell>[0]) => useReceptionBell(props), {
      initialProps: {
        elements,
        zones,
        inMode: true,
        self: { x: 300, y: 300 },
        walkers: [{ id: 'tab-sam', name: 'Sam' }],
        doNotDisturb: false,
        send,
        ...over,
      },
    });

  it('sends a ring to the room while walking with a desk on the board', () => {
    const view = mount();
    ringBell('in-lobby');
    expect(send).toHaveBeenCalledWith({ kind: 'avatar-bell', deskId: 'in-lobby' });
    view.unmount();
    resetBell();
    send.mockClear();
    ringBell('in-lobby');
    expect(send).not.toHaveBeenCalled();
  });

  it('dings and tells you who rang when you stand in earshot', () => {
    const view = mount();
    const rings = renderHook(() => useBellRings('in-lobby'));
    act(() => receiveBellOp('tab-sam', { kind: 'avatar-bell', tabId: 't1', deskId: 'in-lobby' }));
    expect(playTones).toHaveBeenCalledTimes(1);
    expect(rings.result.current).toBe(1);
    expect(toast.info).toHaveBeenCalledWith('Sam rang the bell at Reception');
    view.unmount();
  });

  it('stays quiet out of earshot, out of Avatar mode, under Do Not Disturb, and for a malformed ring', () => {
    for (const over of [
      { self: { x: 2000, y: 2000 } },
      { inMode: false },
      { doNotDisturb: true },
    ]) {
      const view = mount(over);
      receiveBellOp('tab-sam', { kind: 'avatar-bell', tabId: 't1', deskId: 'in-lobby' });
      view.unmount();
    }
    const view = mount();
    receiveBellOp('tab-sam', { kind: 'avatar-bell' });
    receiveBellOp('tab-sam', { kind: 'avatar-bell', tabId: 't1', deskId: 'not-here' });
    view.unmount();
    expect(playTones).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });
});

describe('telling the Receptionist of a ring', () => {
  it('tells him of every ring on the tab, yours and anyone’s, in earshot or not, until unsubscribed', () => {
    const heard = vi.fn();
    const off = onBellRung(heard);
    receiveBellOp('tab-sam', { kind: 'avatar-bell', tabId: 't1', deskId: 'far-desk' });
    ringBell('in-lobby', 10 * BELL_THROTTLE_MS);
    receiveBellOp('tab-sam', { kind: 'avatar-bell' });
    expect(heard.mock.calls).toEqual([
      ['far-desk', 'tab-sam'],
      ['in-lobby', SELF_RINGER],
    ]);
    off();
    receiveBellOp('tab-sam', { kind: 'avatar-bell', tabId: 't1', deskId: 'far-desk' });
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
