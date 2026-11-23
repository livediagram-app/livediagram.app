// @vitest-environment jsdom
// docs/specs/012-collaboration/call-minutes.md "The wire", "When the minutes are used": a call whose session is
// metered says when it leaves, and ends as Leave does when the Space's owner's minutes are used. A session that is
// not metered (Pro off) behaves exactly as before: nothing more is sent, nothing is kept.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsApiError } from '@/lib/api/calls';
import { callMinutes, receiveCallMinutes, resetCallMinutes } from './call-minutes-store';
import { callSelf, resetCallPeers, resetCallSelf } from './calls-store';
import { ProximityCall, type CallSignal } from './proximity-call';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const sfu = vi.hoisted(() => ({ events: [] as { onSessionGone: () => void }[] }));
const api = vi.hoisted(() => ({ apiCallSession: vi.fn() }));
vi.mock('@/lib/api/calls', async (load) => ({
  ...(await load<typeof import('@/lib/api/calls')>()),
  apiCallSession: api.apiCallSession,
}));
vi.mock('./sfu-session', () => ({
  SfuSession: class {
    publish = vi.fn(async () => {});
    want = vi.fn();
    close = vi.fn();
    constructor(_caller: unknown, _session: unknown, events: { onSessionGone: () => void }) {
      sfu.events.push(events);
    }
    locator(token: string, trackName = 'mic') {
      return { sessionId: 'me', trackName, token };
    }
  },
}));
vi.mock('./audio-graph', () => ({
  AudioGraph: class {
    attach = vi.fn();
    detach = vi.fn();
    place = vi.fn();
    listenTo = vi.fn();
    micLevel = vi.fn(() => 0);
    close = vi.fn();
  },
}));

const OWNER = 'p:user_owner';
const caller = { ownerId: 'o', documentId: 'd', shareCode: null };
const session = {
  sessionId: 'me',
  sessionToken: 's.x',
  trackToken: 'tt',
  iceServers: [],
  canSpeak: true,
  mode: 'on',
};
const metered = { ...session, minutes: { owner: OWNER, low: false } };
const refusal = () =>
  new CallsApiError(429, 'calls_minutes_used', null, {
    owner: OWNER,
    guest: false,
    used: 1000,
    limit: 1000,
  });

function newCall() {
  const sent: CallSignal[] = [];
  const context = { resume: vi.fn(async () => {}) } as unknown as AudioContext;
  const call = new ProximityCall({ caller, canSpeak: true, context, send: (s) => sent.push(s) });
  const said = () => sent.filter((s) => s.kind === 'call-session');
  return { call, said };
}

beforeEach(() => {
  sfu.events = [];
  api.apiCallSession.mockReset();
});
afterEach(() => {
  resetCallSelf();
  resetCallPeers();
  resetCallMinutes();
});

describe('a call and the call minutes', () => {
  it('with a session that is not metered, says nothing more and keeps nothing', async () => {
    api.apiCallSession.mockResolvedValue(session);
    const { call, said } = newCall();
    await call.start();
    call.stop();
    expect(said()).toEqual([{ kind: 'call-session', sessionId: 'me', sessionToken: 's.x' }]);
    expect(callMinutes().owner).toBeNull();
  });

  it('with a metered session, knows whose month it counts against and says when it leaves', async () => {
    api.apiCallSession.mockResolvedValue({ ...metered, minutes: { owner: OWNER, low: true } });
    const { call, said } = newCall();
    await call.start();
    expect(callMinutes()).toMatchObject({ caller, owner: OWNER, low: true });
    call.stop();
    expect(said().at(-1)).toEqual({
      kind: 'call-session',
      sessionId: 'me',
      sessionToken: 's.x',
      left: true,
    });
  });

  it('ends as Leave does when the room says the minutes are used', async () => {
    api.apiCallSession.mockResolvedValue(metered);
    const { call, said } = newCall();
    await call.start();
    expect(callSelf().phase).toBe('live');
    receiveCallMinutes('system', { kind: 'call-minutes', state: 'used' }, true);
    expect(call.ended).toBe(true);
    expect(callSelf().phase).toBe('off');
    expect(said().at(-1)).toMatchObject({ left: true });
    // The call was running, so the dialog says why it stopped.
    // The room's word is the state alone; whose month it is came with the session.
    expect(callMinutes()).toMatchObject({
      owner: OWNER,
      used: { used: null, limit: null },
      notice: true,
    });
  });

  it('a join refused for minutes is no error: the dock pauses, with no dialog', async () => {
    api.apiCallSession.mockRejectedValue(refusal());
    const { call, said } = newCall();
    await call.start();
    expect(callSelf().phase).toBe('off');
    expect(callMinutes()).toMatchObject({
      caller,
      owner: OWNER,
      used: { used: 1000, limit: 1000 },
      notice: false,
    });
    // Nothing was minted, so there is nothing to leave.
    expect(said()).toEqual([]);
  });

  it('a renewal refused for minutes ends the running call and says why', async () => {
    api.apiCallSession.mockResolvedValueOnce(metered).mockRejectedValueOnce(refusal());
    const { call } = newCall();
    await call.start();
    sfu.events[0]!.onSessionGone();
    await vi.waitFor(() => expect(call.ended).toBe(true));
    expect(callSelf().phase).toBe('off');
    expect(callMinutes().notice).toBe(true);
  });
});
