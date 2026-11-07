import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsApiError } from '@/lib/api/calls';
import {
  NOT_HEARD_RETRY_MAX_MS,
  NOT_HEARD_RETRY_MS,
  SfuSession,
  SUBSCRIBE_BATCH,
} from './sfu-session';

const api = vi.hoisted(() => ({
  apiCallTracks:
    vi.fn<(caller: unknown, body: { subscribe?: { sessionId: string }[] }) => Promise<unknown>>(),
  apiCallRenegotiate: vi.fn(),
  apiCallClose: vi.fn(),
  apiCallLayer: vi.fn(),
}));
vi.mock('@/lib/api/calls', async (load) => ({
  ...(await load<typeof import('@/lib/api/calls')>()),
  ...api,
}));

type Listener = (e: unknown) => void;
class FakePc {
  static last: FakePc;
  listeners = new Map<string, Listener>();
  transceivers: {
    mid: string | null;
    sender: { replaceTrack: ReturnType<typeof vi.fn> };
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  localDescription: { sdp: string } | null = null;
  iceConnectionState = 'new';
  remote: unknown[] = [];
  closed = false;
  constructor() {
    FakePc.last = this;
  }
  addEventListener(name: string, fn: Listener) {
    this.listeners.set(name, fn);
  }
  added: unknown[] = [];
  addTransceiver(_track: unknown, init: unknown) {
    this.added.push(init);
    const t = {
      mid: String(this.added.length - 1),
      sender: { replaceTrack: vi.fn(async () => {}) },
      stop: vi.fn(),
    };
    this.transceivers.push(t);
    return t;
  }
  getTransceivers() {
    return this.transceivers;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer' };
  }
  async setLocalDescription(d: { sdp: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: unknown) {
    this.remote.push(d);
  }
  close() {
    this.closed = true;
  }
}

const caller = { ownerId: 'o', documentId: 'd', shareCode: null };
const session = {
  sessionId: 'me',
  sessionToken: 'tok',
  iceServers: [],
  canSpeak: true,
  mode: 'on' as const,
};
const loc = (id: string) => ({ sessionId: id, trackName: 'mic', token: 't' });
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.stubGlobal('RTCPeerConnection', FakePc);
  vi.stubGlobal('MediaStream', class {});
  api.apiCallTracks.mockImplementation(
    async (_c, body: { subscribe?: { sessionId: string }[] }) => ({
      requiresImmediateRenegotiation: !!body.subscribe,
      sessionDescription: body.subscribe
        ? { type: 'offer', sdp: 'sfu-offer' }
        : { type: 'answer', sdp: 'sfu-answer' },
      tracks: (body.subscribe ?? [{}]).map((_, i) => ({ mid: String(i + 1) })),
    }),
  );
  api.apiCallRenegotiate.mockResolvedValue({ ok: true });
  api.apiCallLayer.mockResolvedValue({ requiresImmediateRenegotiation: false, tracks: [] });
  api.apiCallClose.mockResolvedValue({
    requiresImmediateRenegotiation: false,
    tracks: [],
    sessionDescription: { type: 'answer', sdp: 'x' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function open() {
  const events = {
    onTrack: vi.fn(),
    onTrackEnded: vi.fn(),
    onFailed: vi.fn(),
    onPaused: vi.fn(),
    onAudioOnly: vi.fn(),
    onNotHeard: vi.fn(),
    onSessionGone: vi.fn(),
  };
  const sfu = new SfuSession(caller, session, events);
  return { sfu, events, pc: FakePc.last };
}

// docs/specs/012-collaboration/blueprints/proximity-audio.md "Subscriptions".
describe('SfuSession', () => {
  it('publishes the microphone once, then replaces its track', async () => {
    const { sfu, pc } = open();
    const track = {} as MediaStreamTrack;
    await sfu.publish(track);
    expect(api.apiCallTracks).toHaveBeenCalledWith(caller, {
      sessionId: 'me',
      sessionToken: 'tok',
      publish: { sdp: 'offer', mid: '0' },
    });
    expect(pc.remote).toEqual([{ type: 'answer', sdp: 'sfu-answer' }]);
    await sfu.publish(track);
    await sfu.replaceMic(null);
    expect(api.apiCallTracks).toHaveBeenCalledTimes(1);
    expect(pc.transceivers[0]!.sender.replaceTrack).toHaveBeenCalledTimes(2);
    expect(sfu.locator('tt')).toEqual({ sessionId: 'me', trackName: 'mic', token: 'tt' });
  });

  it('subscribes to who is wanted, answers the SFU, routes tracks, and closes who is not', async () => {
    const { sfu, events, pc } = open();
    sfu.want([loc('a'), loc('b')]);
    await settle();
    expect(api.apiCallTracks).toHaveBeenCalledTimes(1);
    expect(api.apiCallRenegotiate).toHaveBeenCalledWith(caller, {
      sessionId: 'me',
      sessionToken: 'tok',
      sdp: 'answer',
    });
    pc.listeners.get('track')!({ transceiver: { mid: '2' }, track: 'tb' });
    expect(events.onTrack).toHaveBeenCalledWith('b', 'mic', expect.anything());
    pc.listeners.get('track')!({ transceiver: { mid: '9' }, track: 'x' });
    pc.listeners.get('track')!({ transceiver: { mid: null }, track: 'x' });
    expect(events.onTrack).toHaveBeenCalledTimes(1);
    // The same set again costs nothing.
    sfu.want([loc('b'), loc('a')]);
    await settle();
    expect(api.apiCallTracks).toHaveBeenCalledTimes(1);
    pc.transceivers.push({ mid: '1', sender: { replaceTrack: vi.fn() }, stop: vi.fn() });
    sfu.want([loc('b')]);
    await settle();
    expect(events.onTrackEnded).toHaveBeenCalledWith('a', 'mic');
    expect(api.apiCallClose).toHaveBeenCalledWith(caller, {
      sessionId: 'me',
      sessionToken: 'tok',
      mids: ['1'],
      sdp: 'offer',
    });
    expect(pc.transceivers.at(-1)!.stop).toHaveBeenCalled();
  });

  it('collapses changes made while a step is in flight into one reconcile', async () => {
    const { sfu } = open();
    sfu.want([loc('a')]);
    sfu.want([loc('b')]);
    sfu.want([loc('c')]);
    await settle();
    expect(api.apiCallTracks).toHaveBeenCalledTimes(1);
    expect(api.apiCallTracks.mock.calls[0]![1].subscribe).toEqual([loc('c')]);
  });

  it('asks for a crowd in batches', async () => {
    const { sfu } = open();
    sfu.want(Array.from({ length: SUBSCRIBE_BATCH + 2 }, (_, i) => loc(`p${i}`)));
    await settle();
    await settle();
    expect(api.apiCallTracks).toHaveBeenCalledTimes(2);
    expect(api.apiCallTracks.mock.calls[1]![1].subscribe).toHaveLength(2);
  });

  it('skips a refused track, keeps going after a failed step, and reports a failed connection', async () => {
    const { sfu, events, pc } = open();
    api.apiCallTracks.mockResolvedValueOnce({
      requiresImmediateRenegotiation: false,
      tracks: [{ errorCode: 'gone' }],
    });
    sfu.want([loc('a')]);
    await settle();
    api.apiCallTracks.mockRejectedValueOnce(new Error('502'));
    sfu.want([loc('b')]);
    await settle();
    sfu.want([loc('c')]);
    await settle();
    // The refused one is not asked for again; the failed one is, with the next change.
    sfu.want([loc('a'), loc('b')]);
    await settle();
    expect(
      api.apiCallTracks.mock.calls.map(([, body]) => body.subscribe?.map((l) => l.sessionId)),
    ).toEqual([['a'], ['b'], ['c'], ['b']]);
    api.apiCallTracks.mockResolvedValueOnce({ requiresImmediateRenegotiation: false, tracks: [] });
    sfu.want([loc('d')]);
    await settle();
    sfu.want([loc('d'), loc('a')]);
    await settle();
    expect(api.apiCallTracks).toHaveBeenCalledTimes(5);
    pc.iceConnectionState = 'checking';
    pc.listeners.get('iceconnectionstatechange')!({});
    pc.iceConnectionState = 'failed';
    pc.listeners.get('iceconnectionstatechange')!({});
    expect(events.onFailed).toHaveBeenCalledTimes(1);
  });

  // The server hearing check (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Trust", #483).
  it('asks again for a track the room said is not heard yet, waiting longer each time, and stops once closed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const { sfu, events } = open();
      const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
      const notHeard = {
        requiresImmediateRenegotiation: false,
        tracks: [{ errorCode: 'not_heard' }],
      };
      api.apiCallTracks.mockResolvedValueOnce(notHeard).mockResolvedValueOnce(notHeard);
      sfu.want([loc('a')]);
      await tick(0);
      expect(events.onNotHeard).toHaveBeenCalledTimes(1);
      // Held back meanwhile: another step asks nothing for it.
      sfu.want([loc('a')]);
      await tick(NOT_HEARD_RETRY_MS - 1);
      expect(api.apiCallTracks).toHaveBeenCalledTimes(1);
      await tick(1);
      expect(api.apiCallTracks).toHaveBeenCalledTimes(2);
      // Refused again: the next wait doubles, then it is received.
      await tick(NOT_HEARD_RETRY_MS * 2 - 1);
      expect(api.apiCallTracks).toHaveBeenCalledTimes(2);
      await tick(1);
      expect(api.apiCallTracks).toHaveBeenCalledTimes(3);
      expect(events.onNotHeard).toHaveBeenCalledTimes(2);
      // The waits are capped, and nothing is asked once the session closed.
      expect(NOT_HEARD_RETRY_MAX_MS).toBe(NOT_HEARD_RETRY_MS * 8);
      api.apiCallTracks.mockResolvedValueOnce(notHeard);
      sfu.want([loc('a'), loc('b')]);
      await tick(0);
      sfu.close();
      await tick(NOT_HEARD_RETRY_MAX_MS);
      expect(api.apiCallTracks).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
  it('says so when a step is refused because calls are paused, and only then', async () => {
    const { sfu, events } = open();
    api.apiCallTracks.mockRejectedValueOnce(new CallsApiError(503, 'calls_off', 'unconfigured'));
    sfu.want([loc('a')]);
    await settle();
    expect(events.onPaused).not.toHaveBeenCalled();
    api.apiCallTracks.mockRejectedValueOnce(new CallsApiError(503, 'calls_off', 'paused'));
    sfu.want([loc('b')]);
    await settle();
    expect(events.onPaused).toHaveBeenCalledTimes(1);
  });

  // proximity-audio.md "A session that expires".
  it('says so when Realtime dropped the session, and forgets a publish it never took', async () => {
    const { sfu, events, pc } = open();
    const track = {} as MediaStreamTrack;
    api.apiCallTracks.mockRejectedValueOnce(new CallsApiError(410, 'calls_session_gone'));
    await expect(sfu.publish(track)).rejects.toThrow('calls 410');
    await settle();
    expect(events.onSessionGone).toHaveBeenCalledTimes(1);
    expect(pc.transceivers[0]!.stop).toHaveBeenCalledTimes(1);
    // Nothing claims it: a later publish of the name negotiates afresh rather than swapping a track in.
    await sfu.publish(track);
    expect(api.apiCallTracks).toHaveBeenCalledTimes(2);
    expect(pc.transceivers[0]!.sender.replaceTrack).not.toHaveBeenCalled();
    expect(events.onPaused).not.toHaveBeenCalled();
  });

  it('closes every subscription and does nothing after', async () => {
    const { sfu, events, pc } = open();
    sfu.want([loc('a')]);
    await settle();
    sfu.close();
    expect(events.onTrackEnded).toHaveBeenCalledWith('a', 'mic');
    expect(pc.closed).toBe(true);
    sfu.want([loc('b')]);
    await settle();
    expect(api.apiCallTracks).toHaveBeenCalledTimes(1);
  });

  // docs/specs/012-collaboration/blueprints/video-and-screen-bubbles.md "Subscriptions".
  describe('video and screens', () => {
    const cam = (id: string) => ({ sessionId: id, trackName: 'cam', token: 't' });
    const screen = (id: string) => ({ sessionId: id, trackName: 'screen', token: 't' });

    it('publishes each track once by name, with its encodings, and swaps it in place', async () => {
      const { sfu, pc } = open();
      const encodings = [{ rid: 'f' }, { rid: 'h' }];
      await sfu.publish({} as MediaStreamTrack);
      await sfu.publish({} as MediaStreamTrack, 'cam', encodings);
      expect(api.apiCallTracks).toHaveBeenLastCalledWith(caller, {
        sessionId: 'me',
        sessionToken: 'tok',
        publish: { sdp: 'offer', mid: '1', trackName: 'cam' },
      });
      expect(pc.added).toEqual([
        { direction: 'sendonly' },
        { direction: 'sendonly', sendEncodings: encodings },
      ]);
      await sfu.replaceTrack('cam', null);
      await sfu.replaceTrack('screen', null);
      expect(pc.transceivers[1]!.sender.replaceTrack).toHaveBeenCalledWith(null);
      expect(sfu.locator('tt', 'screen')).toEqual({
        sessionId: 'me',
        trackName: 'screen',
        token: 'tt',
      });
    });

    it('subscribes one publisher’s microphone, camera and screen apart, and routes each', async () => {
      const { sfu, events, pc } = open();
      sfu.want([loc('a'), cam('a'), screen('a')]);
      await settle();
      // A camera on the small layer asks for no layer (the route's default).
      expect(api.apiCallTracks.mock.calls[0]![1].subscribe).toEqual([
        loc('a'),
        cam('a'),
        screen('a'),
      ]);
      pc.listeners.get('track')!({ transceiver: { mid: '2' }, track: 'tc' });
      pc.listeners.get('track')!({ transceiver: { mid: '3' }, track: 'ts' });
      expect(events.onTrack).toHaveBeenNthCalledWith(1, 'a', 'cam', expect.anything());
      expect(events.onTrack).toHaveBeenNthCalledWith(2, 'a', 'screen', expect.anything());
      // Dropping the screen alone closes it alone.
      sfu.want([loc('a'), cam('a')]);
      await settle();
      expect(events.onTrackEnded).toHaveBeenCalledWith('a', 'screen');
      expect(api.apiCallClose.mock.lastCall![1]).toMatchObject({ mids: ['3'] });
    });

    it('asks a maximised camera on the large layer, and switches a held one in place', async () => {
      const { sfu } = open();
      sfu.want([{ ...cam('a'), layer: 'f' }]);
      await settle();
      expect(api.apiCallTracks.mock.calls[0]![1].subscribe).toEqual([{ ...cam('a'), layer: 'f' }]);
      // Restore: the same subscription moves to the small layer, without a new one.
      sfu.want([cam('a')]);
      await settle();
      expect(api.apiCallLayer).toHaveBeenCalledWith(caller, {
        sessionId: 'me',
        sessionToken: 'tok',
        tracks: [{ mid: '1', sessionId: 'a', trackName: 'cam', layer: 'h' }],
      });
      expect(api.apiCallTracks).toHaveBeenCalledTimes(1);
      // Asked again, settled: nothing more.
      sfu.want([cam('a')]);
      await settle();
      expect(api.apiCallLayer).toHaveBeenCalledTimes(1);
      // A refused layer change is not retried in a loop.
      api.apiCallLayer.mockRejectedValueOnce(new Error('update_track_error'));
      sfu.want([{ ...cam('a'), layer: 'f' }]);
      await settle();
      sfu.want([{ ...cam('a'), layer: 'f' }]);
      await settle();
      expect(api.apiCallLayer).toHaveBeenCalledTimes(2);
    });

    it('says so when a camera or screen is refused because calls are audio only', async () => {
      const { sfu, events } = open();
      api.apiCallTracks.mockRejectedValueOnce(new CallsApiError(503, 'calls_off', 'audio-only'));
      sfu.want([cam('a')]);
      await settle();
      expect(events.onAudioOnly).toHaveBeenCalledTimes(1);
      expect(events.onPaused).not.toHaveBeenCalled();
    });
  });
});
