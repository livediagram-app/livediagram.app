import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsApiError } from '@/lib/api/calls';
import {
  callSelf,
  receiveCallOp,
  receiveCallsMode,
  resetCallPeers,
  resetCallSelf,
} from './calls-store';
import { MIC_IDLE_CLOSE_MS, ProximityCall, type CallSignal } from './proximity-call';

const sfu = vi.hoisted(() => ({
  instances: [] as {
    events: {
      onTrack: (p: string, s: unknown) => void;
      onTrackEnded: (p: string) => void;
      onFailed: () => void;
      onPaused: () => void;
    };
    publish: ReturnType<typeof vi.fn>;
    replaceMic: ReturnType<typeof vi.fn>;
    want: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }[],
}));
const graph = vi.hoisted(() => ({
  attach: vi.fn(),
  detach: vi.fn(),
  place: vi.fn(),
  listenTo: vi.fn(),
  micLevel: vi.fn(() => 0.05),
  close: vi.fn(),
}));
const api = vi.hoisted(() => ({ apiCallSession: vi.fn() }));

vi.mock('@/lib/api/calls', async (load) => ({
  ...(await load<typeof import('@/lib/api/calls')>()),
  apiCallSession: api.apiCallSession,
}));
vi.mock('./sfu-session', () => ({
  SfuSession: class {
    events: (typeof sfu.instances)[number]['events'];
    publish = vi.fn(async () => {});
    replaceMic = vi.fn(async () => {});
    want = vi.fn();
    close = vi.fn();
    constructor(
      _caller: unknown,
      _session: unknown,
      events: (typeof sfu.instances)[number]['events'],
    ) {
      this.events = events;
      sfu.instances.push(this);
    }
    locator(token: string) {
      return { sessionId: 'me', trackName: 'mic', token };
    }
  },
}));
vi.mock('./audio-graph', () => ({
  AudioGraph: class {
    attach = graph.attach;
    detach = graph.detach;
    place = graph.place;
    listenTo = graph.listenTo;
    micLevel = graph.micLevel;
    close = graph.close;
  },
}));

const caller = { ownerId: 'o', documentId: 'd', shareCode: null };
const session = {
  sessionId: 'me',
  sessionToken: 's.x',
  trackToken: 'tt',
  iceServers: [],
  canSpeak: true,
  mode: 'on',
};

function micStream() {
  const track = { enabled: true, stop: vi.fn() };
  return {
    track,
    stream: { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream,
  };
}

function makeCall(opts: { canSpeak?: boolean; getUserMedia?: () => Promise<MediaStream> } = {}) {
  const sent: CallSignal[] = [];
  const mic = micStream();
  const getUserMedia = opts.getUserMedia ?? vi.fn(async () => mic.stream);
  const context = { resume: vi.fn(async () => {}) } as unknown as AudioContext;
  const call = new ProximityCall({
    caller,
    canSpeak: opts.canSpeak ?? true,
    context,
    send: (s) => sent.push(s),
    getUserMedia,
  });
  return { call, sent, mic, getUserMedia };
}

const scene = (walkers: [string, number][], tabId = 't1') => ({
  tabId,
  self: { x: 0, y: 0 },
  walkers: new Map(walkers.map(([id, x]) => [id, { x, y: 0 }])),
});

beforeEach(() => {
  vi.useFakeTimers();
  sfu.instances.length = 0;
  api.apiCallSession.mockResolvedValue(session);
});
afterEach(() => {
  resetCallPeers();
  resetCallSelf();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// docs/specs/012-collaboration/proximity-audio.md.
describe('ProximityCall', () => {
  it('joins as a speaker: mints, opens the microphone, publishes and tells the room where it is', async () => {
    const { call, sent } = makeCall();
    await call.start();
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'open' });
    expect(sfu.instances[0]!.publish).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([
      { kind: 'call-track', track: { sessionId: 'me', trackName: 'mic', token: 'tt' } },
    ]);
    call.stop();
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: null });
    expect(callSelf().phase).toBe('off');
  });

  it('a listener joins without a microphone and never publishes', async () => {
    const { call, getUserMedia, sent } = makeCall({ canSpeak: false });
    await call.start();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'closed' });
    call.update(scene([['p1', 10]]));
    expect(sent).toEqual([]);
    call.stop();
  });

  it('hears only speakers in earshot on this tab, at their distance and side', async () => {
    const { call } = makeCall();
    await call.start();
    const near = { sessionId: 'p1s', trackName: 'mic', token: 'a' };
    receiveCallOp('p1', { kind: 'call-track', tabId: 't1', track: near });
    receiveCallOp('p2', { kind: 'call-track', tabId: 't1', track: { ...near, sessionId: 'p2s' } });
    receiveCallOp('p3', { kind: 'call-track', tabId: 't2', track: { ...near, sessionId: 'p3s' } });
    call.update(
      scene([
        ['p1', -100],
        ['p2', 900],
        ['p3', 10],
        ['p4', 20],
      ]),
    );
    const s = sfu.instances[0]!;
    expect(s.want).toHaveBeenLastCalledWith([near]);
    expect(callSelf().heard).toEqual(new Set(['p1']));
    expect(callSelf().someoneNear).toBe(true);
    s.events.onTrack('p1s', {});
    expect(graph.attach).toHaveBeenCalledWith('p1', {});
    expect(graph.place).toHaveBeenLastCalledWith('p1', expect.any(Number), expect.any(Number));
    expect(graph.place.mock.lastCall![2]).toBeLessThan(0);
    s.events.onTrack('unknown', {});
    s.events.onTrackEnded('p1s');
    expect(graph.detach).toHaveBeenCalledWith('p1');
    s.events.onTrackEnded('unknown');
    call.stop();
  });

  it('sends its talking level, and nothing once muted', async () => {
    const { call, sent, mic } = makeCall();
    await call.start();
    vi.advanceTimersByTime(60);
    expect(sent.some((s) => s.kind === 'avatar-voice' && s.level > 0)).toBe(true);
    call.toggleMute();
    expect(mic.track.enabled).toBe(false);
    expect(sent.at(-1)).toEqual({ kind: 'avatar-voice', level: 0 });
    expect(callSelf().muted).toBe(true);
    const count = sent.length;
    vi.advanceTimersByTime(1000);
    expect(sent.length).toBe(count);
    call.toggleMute();
    expect(mic.track.enabled).toBe(true);
    call.stop();
  });

  it('closes the microphone after 15 s alone and opens it when somebody arrives', async () => {
    const { call, mic, getUserMedia } = makeCall();
    await call.start();
    call.update(scene([]));
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS);
    expect(mic.track.stop).toHaveBeenCalled();
    expect(callSelf().mic).toBe('closed');
    call.update(scene([['p1', 1000]]));
    await vi.waitFor(() => expect(callSelf().mic).toBe('open'));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(sfu.instances[0]!.replaceMic).toHaveBeenCalled();
    call.stop();
  });

  it('resends its locator for a new walker, at most once a second', async () => {
    const { call, sent } = makeCall();
    await call.start();
    call.update(scene([['p1', 1000]]));
    call.update(
      scene([
        ['p1', 1000],
        ['p2', 1000],
      ]),
    );
    const tracks = () => sent.filter((s) => s.kind === 'call-track').length;
    expect(tracks()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(tracks()).toBe(2);
    call.stop();
  });

  it('a refused microphone joins as a listener with the indicator blocked', async () => {
    const { call } = makeCall({ getUserMedia: () => Promise.reject(new Error('NotAllowed')) });
    await call.start();
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'blocked' });
    call.stop();
  });

  it('a refused session or a failed connection ends in error', async () => {
    api.apiCallSession.mockRejectedValueOnce(new CallsApiError(503, 'calls_off'));
    const first = makeCall();
    await first.call.start();
    expect(callSelf().phase).toBe('error');
    api.apiCallSession.mockRejectedValueOnce(new Error('network'));
    await makeCall().call.start();
    expect(callSelf().phase).toBe('error');

    const { call } = makeCall();
    await call.start();
    sfu.instances.at(-1)!.events.onFailed();
    expect(callSelf().phase).toBe('error');
    expect(graph.close).toHaveBeenCalled();
    call.stop();
    call.update(scene([]));
  });

  it('leaving before the session arrives releases nothing it never had', async () => {
    const { call, getUserMedia } = makeCall();
    const started = call.start();
    call.stop();
    await started;
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(callSelf().phase).toBe('off');
  });

  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
  describe('the kill switch', () => {
    it('ends a live call quietly into Calls Paused when the room says calls are off', async () => {
      const { call, sent, mic } = makeCall();
      await call.start();
      call.update(scene([['p1', 100]]));
      expect(callSelf().phase).toBe('live');
      // Audio only leaves an audio call alone.
      receiveCallsMode('system', { kind: 'calls-mode', mode: 'audio-only' });
      expect(callSelf().phase).toBe('live');
      receiveCallsMode('system', { kind: 'calls-mode', mode: 'off' });
      expect(callSelf()).toMatchObject({ phase: 'off', mode: 'off', mic: 'closed' });
      expect(call.ended).toBe(true);
      expect(mic.track.stop).toHaveBeenCalled();
      expect(sfu.instances.at(-1)!.close).toHaveBeenCalled();
      expect(sent.at(-1)).toEqual({ kind: 'call-track', track: null });
    });

    it('a paused session refusal is no error, and the session says the mode', async () => {
      api.apiCallSession.mockRejectedValueOnce(new CallsApiError(503, 'calls_off', 'paused'));
      const first = makeCall();
      await first.call.start();
      expect(callSelf()).toMatchObject({ phase: 'off', mode: 'off' });
      expect(first.call.ended).toBe(true);
      api.apiCallSession.mockResolvedValueOnce({ ...session, mode: 'audio-only' });
      const { call } = makeCall();
      await call.start();
      expect(callSelf()).toMatchObject({ phase: 'live', mode: 'audio-only' });
      call.stop();
    });

    it('a paused publish or subscribe ends the call the same way', async () => {
      const { call } = makeCall();
      await call.start();
      sfu.instances.at(-1)!.events.onPaused();
      expect(callSelf()).toMatchObject({ phase: 'off', mode: 'off' });
      // Already ended: a second refusal changes nothing.
      sfu.instances.at(-1)!.events.onPaused();
      expect(call.ended).toBe(true);
    });
  });
});
