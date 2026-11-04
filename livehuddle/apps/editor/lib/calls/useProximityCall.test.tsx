// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callActions, callSelf, resetCallSelf } from './calls-store';
import { useProximityCall, type ProximityCallDeps } from './useProximityCall';

const caps = vi.hoisted(() => ({ apiGetCapabilities: vi.fn() }));
vi.mock('@/lib/api/capabilities', () => caps);
const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);
const calls = vi.hoisted(() => ({
  made: [] as {
    update: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    toggleMute: ReturnType<typeof vi.fn>;
  }[],
  fail: false,
}));
vi.mock('./proximity-call', () => ({
  ProximityCall: class {
    update = vi.fn();
    start = vi.fn(async () => {});
    stop = vi.fn();
    toggleMute = vi.fn();
    constructor() {
      if (calls.fail) throw new Error('chunk');
      calls.made.push(this);
    }
  },
}));

const base: ProximityCallDeps = {
  inMode: true,
  caller: { ownerId: 'o', documentId: 'd', shareCode: null },
  canSpeak: true,
  send: vi.fn(),
  tabId: 't1',
  self: { x: 0, y: 0 },
  walkers: [],
};

beforeEach(() => {
  calls.made.length = 0;
  calls.fail = false;
  caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false, callsEnabled: true });
  vi.stubGlobal(
    'AudioContext',
    class {
      close = vi.fn(async () => {});
    },
  );
});
afterEach(() => {
  act(() => resetCallSelf());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mount(deps: Partial<ProximityCallDeps> = {}) {
  return renderHook((d: ProximityCallDeps) => useProximityCall(d), {
    initialProps: { ...base, ...deps },
  });
}

// docs/specs/012-collaboration/proximity-audio.md "Who is in a call" and "Turning calls on".
describe('useProximityCall', () => {
  it('offers calls only in the mode, with a room, when the api has them on', async () => {
    const off = mount({ send: undefined });
    await act(async () => {});
    expect(callSelf().available).toBe(false);
    expect(caps.apiGetCapabilities).not.toHaveBeenCalled();
    off.unmount();
    caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false });
    const closed = mount();
    await act(async () => {});
    expect(callSelf().available).toBe(false);
    closed.unmount();
    caps.apiGetCapabilities.mockResolvedValue({ emailEnabled: false, callsEnabled: true });
    mount({ canSpeak: false });
    await waitFor(() => expect(callSelf().available).toBe(true));
    expect(callSelf().canSpeak).toBe(false);
  });

  it('joins on the press, feeds the call positions, and leaves with the mode', async () => {
    const hook = mount();
    await waitFor(() => expect(callSelf().available).toBe(true));
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(1));
    const call = calls.made[0]!;
    expect(call.start).toHaveBeenCalled();
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'AudioJoin');
    act(() => callActions()!.join());
    expect(calls.made).toHaveLength(1);
    hook.rerender({ ...base, walkers: [{ id: 'p1', at: { x: 5, y: 5 } }] });
    expect(call.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ walkers: new Map([['p1', { x: 5, y: 5 }]]) }),
    );
    act(() => callActions()!.toggleMute());
    expect(call.toggleMute).toHaveBeenCalled();
    expect(telemetry.track).toHaveBeenCalledWith('UI', 'Changed', 'AudioMute');
    hook.rerender({ ...base, inMode: false });
    expect(call.stop).toHaveBeenCalled();
  });

  it('ends the call on a tab change and on leaving, and rejoins after a failure', async () => {
    const hook = mount({ canSpeak: false });
    await waitFor(() => expect(callSelf().available).toBe(true));
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(1));
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'AudioListen');
    hook.rerender({ ...base, canSpeak: false, tabId: 't2' });
    expect(calls.made[0]!.stop).toHaveBeenCalled();
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(2));
    act(() => callActions()!.leave());
    expect(calls.made[1]!.stop).toHaveBeenCalled();
    calls.fail = true;
    act(() => callActions()!.join());
    await waitFor(() => expect(callSelf().phase).toBe('error'));
    calls.fail = false;
    act(() => callActions()!.join());
    await waitFor(() => expect(calls.made).toHaveLength(3));
    hook.unmount();
    expect(calls.made[2]!.stop).toHaveBeenCalled();
    expect(callActions()).toBeNull();
  });

  it('a press without a room does nothing', async () => {
    mount({ caller: null });
    await act(async () => {});
    act(() => callActions()!.join());
    expect(calls.made).toHaveLength(0);
  });
});
