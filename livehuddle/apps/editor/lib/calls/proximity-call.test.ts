// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsApiError } from '@/lib/api/calls';
import {
  callMedia,
  callSelf,
  noteLetSpeak,
  noteRoomDropped,
  receiveCallOp,
  receiveLetSpeak,
  receiveStopShare,
  receiveCallsMode,
  resetCallMedia,
  resetCallPeers,
  resetCallSelf,
  setCallLevels,
  setCallMaximised,
  setCallsMode,
} from './calls-store';
import {
  CALLS_CHECK_MS,
  CAMERA_ENCODINGS,
  LOCATOR_RESEND_MS,
  MIC_IDLE_CLOSE_MS,
  ProximityCall,
  RENEW_MAX,
  REPROVE_MS,
  SCREEN_CONSTRAINTS,
  type CallSignal,
} from './proximity-call';
import { LocalPreview } from './local-preview';
import { callStages } from './stage';
import { roomZones } from './zones';

const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

const sfu = vi.hoisted(() => ({
  instances: [] as {
    events: {
      onTrack: (p: string, name: string, s: unknown) => void;
      onTrackEnded: (p: string, name: string) => void;
      onFailed: () => void;
      onPaused: () => void;
      onAudioOnly: () => void;
      onNotHeard: () => void;
      onSessionGone: () => void;
    };
    publish: ReturnType<typeof vi.fn>;
    replaceMic: ReturnType<typeof vi.fn>;
    replaceTrack: ReturnType<typeof vi.fn>;
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
    replaceTrack = vi.fn(async () => {});
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
    locator(token: string, trackName = 'mic') {
      return { sessionId: 'me', trackName, token };
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
  const listeners = new Map<string, () => void>();
  const track = {
    enabled: true,
    stop: vi.fn(),
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    end: () => listeners.get('ended')?.(),
  };
  return {
    track,
    stream: { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream,
  };
}

function videoStream() {
  const listeners = new Map<string, () => void>();
  const track = {
    stop: vi.fn(),
    contentHint: '',
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    end: () => listeners.get('ended')?.(),
  };
  return {
    track,
    stream: { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream,
  };
}

function makeCall(
  opts: {
    canSpeak?: boolean;
    canShare?: boolean;
    getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
    getDisplayMedia?: () => Promise<MediaStream>;
    visible?: () => boolean;
    preview?: LocalPreview;
    onShareStopped?: (by: string) => void;
  } = {},
) {
  const sent: CallSignal[] = [];
  // The call's proof of its session to the room (meeting-rooms-and-stage.md "Trust"), kept apart from what it says.
  const proved: CallSignal[] = [];
  const mic = micStream();
  const camera = videoStream();
  const display = videoStream();
  const getUserMedia =
    opts.getUserMedia ??
    vi.fn(async (c: MediaStreamConstraints) => (c.video ? camera.stream : mic.stream));
  const getDisplayMedia = opts.getDisplayMedia ?? vi.fn(async () => display.stream);
  const context = { resume: vi.fn(async () => {}) } as unknown as AudioContext;
  const call = new ProximityCall({
    caller,
    canSpeak: opts.canSpeak ?? true,
    canShare: opts.canShare ?? false,
    onShareStopped: opts.onShareStopped,
    context,
    send: (s) => (s.kind === 'call-session' ? proved : sent).push(s),
    getUserMedia,
    getDisplayMedia,
    ...(opts.visible ? { pageVisible: opts.visible } : {}),
    ...(opts.preview ? { preview: opts.preview } : {}),
  });
  return { call, sent, proved, mic, camera, display, getUserMedia, getDisplayMedia };
}

// Let the microphone's open and publish settle (a resolved capture, then the publish).
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// Join, then the first unmute: the microphone opens and is published (call-mic.ts).
async function speak(call: ProximityCall) {
  await call.start();
  call.toggleMute();
  await settle();
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
  resetCallMedia();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// docs/specs/012-collaboration/proximity-audio.md.
describe('ProximityCall', () => {
  // Owner, 2026-11-07: "your mic stays muted by default when joining".
  it('joins as a speaker muted, the microphone unopened, so walking in never asks for it', async () => {
    const { call, sent, getUserMedia } = makeCall();
    await call.start();
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'closed', muted: true });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(sfu.instances[0]!.publish).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    // Somebody arriving opens nothing while muted.
    call.update(scene([['p1', 10]]));
    await settle();
    expect(getUserMedia).not.toHaveBeenCalled();
    call.stop();
    expect(callSelf()).toMatchObject({ phase: 'off', muted: true });
  });

  it('opens, publishes and tells the room where it is on the first unmute', async () => {
    const { call, sent, mic, getUserMedia } = makeCall();
    await speak(call);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'open', muted: false });
    expect(mic.track.enabled).toBe(true);
    expect(sfu.instances[0]!.publish).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([
      { kind: 'call-track', track: { sessionId: 'me', trackName: 'mic', token: 'tt' } },
    ]);
    call.stop();
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: null });
    expect(callSelf()).toMatchObject({ phase: 'off', muted: true, mic: 'closed' });
  });

  it('leaving with a release due clears it', async () => {
    const { call, mic } = makeCall();
    await speak(call);
    call.toggleMute();
    call.update(scene([]));
    call.stop();
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS);
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
    expect(callSelf().mic).toBe('closed');
  });

  it('leaving while the microphone opens on an unmute releases it, never published', async () => {
    const { stream, track } = micStream();
    let open: (s: MediaStream) => void = () => {};
    const { call } = makeCall({ getUserMedia: () => new Promise((r) => (open = r)) });
    await call.start();
    call.toggleMute();
    call.stop();
    open(stream);
    await settle();
    expect(track.stop).toHaveBeenCalled();
    expect(sfu.instances[0]!.publish).not.toHaveBeenCalled();
    expect(callSelf().mic).toBe('closed');
  });

  // An unmute, then a mute while the browser still asks, alone on the tab: the open lands muted, and the quiet spell
  // still releases it.
  it('releases a microphone muted again while it opened, once the quiet spell is over', async () => {
    const { stream, track } = micStream();
    let open: (s: MediaStream) => void = () => {};
    const { call } = makeCall({ getUserMedia: () => new Promise((r) => (open = r)) });
    await call.start();
    call.update(scene([]));
    call.toggleMute();
    call.toggleMute();
    open(stream);
    await settle();
    expect(callSelf()).toMatchObject({ mic: 'open', muted: true });
    expect(track.enabled).toBe(false);
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS);
    expect(track.stop).toHaveBeenCalled();
    expect(callSelf().mic).toBe('closed');
    call.stop();
  });

  it('a listener’s unmute opens nothing', async () => {
    const { call, getUserMedia } = makeCall({ canSpeak: false });
    await call.start();
    call.toggleMute();
    await settle();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(callSelf().mic).toBe('closed');
    call.stop();
  });

  // The server hearing check (meeting-rooms-and-stage.md "Trust", #483).
  it('proves its session to the room once minted, and again when the room says a track is not heard', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    try {
      const { call, proved } = makeCall({ canSpeak: false });
      await call.start();
      const proof = { kind: 'call-session', sessionId: 'me', sessionToken: 's.x' };
      expect(proved).toEqual([proof]);
      const s = sfu.instances[0]!;
      // At once: just proved, so only counted.
      s.events.onNotHeard();
      expect(proved).toHaveLength(1);
      expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'CallNotHeard');
      vi.advanceTimersByTime(REPROVE_MS);
      s.events.onNotHeard();
      expect(proved).toEqual([proof, proof]);
      call.stop();
    } finally {
      vi.useRealTimers();
    }
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
    s.events.onTrack('p1s', 'mic', {});
    expect(graph.attach).toHaveBeenCalledWith('p1', {});
    expect(graph.place).toHaveBeenLastCalledWith('p1', expect.any(Number), expect.any(Number));
    expect(graph.place.mock.lastCall![2]).toBeLessThan(0);
    s.events.onTrack('unknown', 'mic', {});
    s.events.onTrackEnded('p1s', 'mic');
    expect(graph.detach).toHaveBeenCalledWith('p1');
    s.events.onTrackEnded('unknown', 'mic');
    call.stop();
  });

  it('sends its talking level, and nothing once muted', async () => {
    const { call, sent, mic } = makeCall();
    await speak(call);
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

  it('keeps the microphone open while unmuted, alone or not', async () => {
    const { call, mic } = makeCall();
    await speak(call);
    call.update(scene([]));
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS * 2);
    expect(mic.track.stop).not.toHaveBeenCalled();
    expect(callSelf().mic).toBe('open');
    call.stop();
  });

  // An unplugged microphone, or its permission withdrawn: the browser ends the track.
  it('releases a microphone the browser ended, and opens one again while unmuted', async () => {
    const { call, mic, getUserMedia } = makeCall();
    await speak(call);
    mic.track.end();
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
    await settle();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(callSelf()).toMatchObject({ mic: 'open', muted: false });
    expect(sfu.instances[0]!.replaceMic).toHaveBeenLastCalledWith(mic.track);
    // Muted, it is released and stays closed until the next unmute.
    call.toggleMute();
    mic.track.end();
    await settle();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(callSelf()).toMatchObject({ mic: 'closed', muted: true });
    call.stop();
  });

  it('releases a muted microphone after 15 s alone, keeps it with company, and swaps it back in on an unmute', async () => {
    const { call, mic, getUserMedia } = makeCall();
    await speak(call);
    call.update(scene([['p1', 1000]]));
    call.toggleMute();
    // Muted with somebody on the tab: kept.
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS);
    expect(callSelf().mic).toBe('open');
    call.update(scene([]));
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS - 1);
    expect(callSelf().mic).toBe('open');
    // Somebody passing through stops the clock; leaving again starts it afresh.
    call.update(scene([['p1', 1000]]));
    call.update(scene([]));
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS - 1);
    expect(callSelf().mic).toBe('open');
    vi.advanceTimersByTime(1);
    expect(mic.track.stop).toHaveBeenCalled();
    expect(callSelf().mic).toBe('closed');
    // Somebody arriving while muted asks for nothing.
    call.update(scene([['p1', 1000]]));
    await settle();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    // The unmute opens it again, swapped in place rather than published afresh.
    call.toggleMute();
    await settle();
    expect(callSelf()).toMatchObject({ mic: 'open', muted: false });
    expect(sfu.instances[0]!.replaceMic).toHaveBeenCalled();
    expect(sfu.instances[0]!.publish).toHaveBeenCalledTimes(1);
    call.stop();
  });

  // An unmute opens the released microphone and keepFor would open it again before the capture lands: open() takes one
  // capture at a time, so the browser is asked once and no stream is left running.
  it('asks for a released microphone once on an unmute, and stops every stream it took', async () => {
    const streams: ReturnType<typeof micStream>[] = [];
    const getUserMedia = vi.fn(async () => {
      const m = micStream();
      streams.push(m);
      return m.stream;
    });
    const { call } = makeCall({ getUserMedia });
    await speak(call);
    call.update(scene([['p1', 1000]]));
    call.toggleMute();
    call.update(scene([]));
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS);
    call.update(scene([['p1', 1000]]));
    call.toggleMute();
    await settle();
    call.stop();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    for (const m of streams) expect(m.track.stop).toHaveBeenCalled();
  });

  it('resends its locator for a new walker, at most once a second', async () => {
    const { call, sent } = makeCall();
    await speak(call);
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

  it('a refused microphone stays in the call as a listener, blocked, and a press asks again', async () => {
    const { stream } = micStream();
    const getUserMedia = vi
      .fn<(c: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockRejectedValueOnce(new Error('NotAllowed'))
      .mockResolvedValue(stream);
    const { call } = makeCall({ getUserMedia });
    await speak(call);
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'blocked' });
    expect(sfu.instances[0]!.publish).not.toHaveBeenCalled();
    // Mic Blocked pressed: unmuted, asked again, and open this time.
    call.toggleMute();
    expect(callSelf()).toMatchObject({ muted: false });
    await settle();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'open', muted: false });
    expect(sfu.instances[0]!.publish).toHaveBeenCalledTimes(1);
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
      await speak(call);
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

// docs/specs/012-collaboration/video-and-screen-bubbles.md.
describe('ProximityCall video and screens', () => {
  const me = (trackName: string) => ({ sessionId: 'me', trackName, token: 'tt' });
  const at = (id: string, trackName: string) => ({ sessionId: `${id}s`, trackName, token: 'a' });

  // video-and-screen-bubbles.md "Local preview": a call that goes live sends the preview, never asking again.
  describe('a local preview', () => {
    function previewed() {
      const cam = videoStream();
      const screen = videoStream();
      const capture = {
        getUserMedia: vi.fn(async () => cam.stream),
        getDisplayMedia: vi.fn(async () => screen.stream),
      };
      return { cam, screen, capture, preview: new LocalPreview(capture) };
    }

    it('is sent the moment the call goes live, the same tracks, with no second prompt', async () => {
      const { cam, screen, capture, preview } = previewed();
      await preview.start('camera');
      await preview.start('screen');
      const { call, sent, getUserMedia, getDisplayMedia } = makeCall({ canShare: true, preview });
      await call.start();
      const s = sfu.instances[0]!;
      expect(s.publish).toHaveBeenCalledWith(cam.track, 'cam', CAMERA_ENCODINGS);
      expect(s.publish).toHaveBeenCalledWith(screen.track, 'screen', expect.any(Array));
      // The call asked the browser for nothing (the microphone waits for an unmute); the preview asked once for each.
      expect(getUserMedia).not.toHaveBeenCalled();
      expect(getDisplayMedia).not.toHaveBeenCalled();
      expect(capture.getUserMedia).toHaveBeenCalledTimes(1);
      expect(callSelf()).toMatchObject({
        camera: 'on',
        screen: 'on',
        previewCamera: 'off',
        previewScreen: 'off',
      });
      expect(preview.stream('camera')).toBeNull();
      expect(callMedia().get('self')).toEqual({ video: cam.stream, screen: screen.stream });
      await settle();
      expect(sent.at(-1)).toMatchObject({ video: me('cam'), screen: me('screen') });
      // Now the call's: leaving stops it, as a camera turned on in the call.
      call.stop();
      expect(cam.track.stop).toHaveBeenCalled();
      expect(screen.track.stop).toHaveBeenCalled();
      expect(callMedia().size).toBe(0);
    });

    it('sends a preview turned on while the call runs or joins', async () => {
      const { cam, preview } = previewed();
      const { call } = makeCall({ preview });
      await call.start();
      await preview.start('camera');
      expect(sfu.instances[0]!.publish).toHaveBeenCalledWith(cam.track, 'cam', CAMERA_ENCODINGS);
      expect(callSelf()).toMatchObject({ camera: 'on', previewCamera: 'off' });
      call.stop();
      // An ended call takes nothing more.
      await preview.start('camera');
      expect(callSelf().previewCamera).toBe('on');
      preview.stopAll();
    });

    it('keeps a Participant’s screen a preview in a call, and through its end', async () => {
      const { screen, preview } = previewed();
      await preview.start('screen');
      const { call, sent } = makeCall({ canShare: false, preview });
      await call.start();
      const s = sfu.instances[0]!;
      expect(s.publish).not.toHaveBeenCalledWith(screen.track, 'screen', expect.anything());
      expect(sent.some((op) => 'screen' in op)).toBe(false);
      expect(callSelf()).toMatchObject({ screen: 'off', previewScreen: 'on' });
      call.stop();
      expect(screen.track.stop).not.toHaveBeenCalled();
      expect(callMedia().get('self')?.screen).toBe(screen.stream);
      preview.stopAll();
      expect(screen.track.stop).toHaveBeenCalled();
      expect(callMedia().size).toBe(0);
    });

    it('stops a preview the mode forbids once live, as a sent one would be', async () => {
      const { cam, preview } = previewed();
      await preview.start('camera');
      api.apiCallSession.mockResolvedValue({ ...session, mode: 'audio-only' });
      const { call } = makeCall({ preview });
      await call.start();
      expect(cam.track.stop).toHaveBeenCalled();
      expect(callSelf()).toMatchObject({ camera: 'off', previewCamera: 'off' });
      expect(callMedia().size).toBe(0);
      call.stop();
    });

    it('a Viewer’s call takes nothing', async () => {
      const { preview } = previewed();
      await preview.start('camera');
      const { call } = makeCall({ canSpeak: false, preview });
      await call.start();
      expect(callSelf().previewCamera).toBe('on');
      call.stop();
      preview.stopAll();
    });
  });

  it('turns the camera on in two layers, shows it to you, tells the room, and off again', async () => {
    const { call, sent, camera, getUserMedia } = makeCall();
    await speak(call);
    await call.toggleCamera();
    const s = sfu.instances[0]!;
    expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ audio: false }));
    expect(s.publish).toHaveBeenLastCalledWith(camera.track, 'cam', CAMERA_ENCODINGS);
    expect(callSelf().camera).toBe('on');
    expect(callMedia().get('self')?.video).toBe(camera.stream);
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: me('mic'), video: me('cam') });
    await call.toggleCamera();
    expect(camera.track.stop).toHaveBeenCalled();
    expect(s.replaceTrack).toHaveBeenCalledWith('cam', null);
    expect(callSelf().camera).toBe('off');
    expect(callMedia().has('self')).toBe(false);
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: me('mic'), video: null });
    call.stop();
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: null, video: null });
  });

  it('a refused camera reads blocked and a press tries again; a Viewer has none', async () => {
    let refuse = true;
    const camera = videoStream();
    const { call } = makeCall({
      getUserMedia: async (c) => {
        if (!c.video) return micStream().stream;
        if (refuse) throw new Error('NotAllowed');
        return camera.stream;
      },
    });
    await call.start();
    await call.toggleCamera();
    expect(callSelf().camera).toBe('blocked');
    refuse = false;
    await call.toggleCamera();
    expect(callSelf().camera).toBe('on');
    call.stop();
    expect(callSelf().camera).toBe('off');

    const viewer = makeCall({ canSpeak: false });
    await viewer.call.start();
    await viewer.call.toggleCamera();
    expect(viewer.getUserMedia).not.toHaveBeenCalled();
    viewer.call.stop();
  });

  it('a camera alone, with the microphone blocked, still tells the room', async () => {
    const camera = videoStream();
    const { call, sent } = makeCall({
      getUserMedia: async (c) => {
        if (c.video) return camera.stream;
        throw new Error('NotAllowed');
      },
    });
    await call.start();
    await call.toggleCamera();
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: null, video: me('cam') });
    call.stop();
  });

  it('leaving while the camera opens releases it', async () => {
    const camera = videoStream();
    let open: (s: MediaStream) => void = () => {};
    const { call } = makeCall({
      getUserMedia: (c) =>
        c.video ? new Promise((r) => (open = r)) : Promise.resolve(micStream().stream),
    });
    await call.start();
    const opening = call.toggleCamera();
    // A second press while it opens does nothing.
    await call.toggleCamera();
    call.stop();
    open(camera.stream);
    await opening;
    expect(camera.track.stop).toHaveBeenCalled();
    expect(callSelf().camera).toBe('off');
  });

  // An unplugged camera, one another app took, or its permission withdrawn: the browser ends the track.
  it('turns a camera the browser ended off, as a press would, and tells the room', async () => {
    const { call, sent, camera } = makeCall();
    await speak(call);
    await call.toggleCamera();
    expect(callSelf().camera).toBe('on');
    camera.track.end();
    expect(callSelf().camera).toBe('off');
    expect(camera.track.stop).toHaveBeenCalled();
    expect(callMedia().get('self')?.video ?? null).toBeNull();
    expect(sfu.instances[0]!.replaceTrack).toHaveBeenCalledWith('cam', null);
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: me('mic'), video: null });
    call.stop();
  });

  it('shares a screen for an Editor, capped and tuned for text, and stops from either control', async () => {
    const { call, sent, display, getDisplayMedia } = makeCall({ canShare: true });
    await speak(call);
    await call.toggleScreen();
    const s = sfu.instances[0]!;
    expect(getDisplayMedia).toHaveBeenCalledWith(SCREEN_CONSTRAINTS);
    expect(display.track.contentHint).toBe('detail');
    expect(s.publish).toHaveBeenLastCalledWith(display.track, 'screen', [
      { maxBitrate: 1_000_000, maxFramerate: 15 },
    ]);
    expect(callSelf().screen).toBe('on');
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: me('mic'), screen: me('screen') });
    // The browser's own Stop Sharing.
    display.track.end();
    expect(callSelf().screen).toBe('off');
    expect(s.replaceTrack).toHaveBeenCalledWith('screen', null);
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: me('mic'), screen: null });
    // An ended track of a share already stopped changes nothing.
    display.track.end();
    // The button.
    await call.toggleScreen();
    await call.toggleScreen();
    expect(callSelf().screen).toBe('off');
    call.stop();
  });

  // video-and-screen-bubbles.md "Share roles" (#469): an Editor can stop someone else's share.
  it('stops its share when an Editor asks, and not when a Participant or a Viewer does', async () => {
    setCallLevels([
      { id: 'ed', role: 'edit' },
      { id: 'pt', role: 'participate' },
      { id: 'vw', role: 'view' },
    ]);
    const onShareStopped = vi.fn();
    const { call, sent } = makeCall({ canShare: true, onShareStopped });
    await speak(call);
    await call.toggleScreen();
    const stop = { kind: 'call-stop-share', tabId: 't1', targetId: 'me' };
    receiveStopShare('pt', stop);
    receiveStopShare('vw', stop);
    receiveStopShare('ed', { kind: 'call-stop-share' });
    expect(callSelf().screen).toBe('on');
    expect(onShareStopped).not.toHaveBeenCalled();
    receiveStopShare('ed', stop);
    expect(callSelf().screen).toBe('off');
    // The sharer is told who stopped it (#504), once.
    expect(onShareStopped).toHaveBeenCalledExactlyOnceWith('ed');
    expect(sent.at(-1)).toEqual({ kind: 'call-track', track: me('mic'), screen: null });
    // Nothing to stop: nothing said.
    const count = sent.length;
    receiveStopShare('ed', stop);
    expect(sent).toHaveLength(count);
    expect(onShareStopped).toHaveBeenCalledTimes(1);
    call.stop();
    // A call that has ended ignores it.
    receiveStopShare('ed', stop);
  });

  it('a cancelled picker is no error, and only an Editor shares', async () => {
    const { call } = makeCall({
      canShare: true,
      getDisplayMedia: () => Promise.reject(new Error('NotAllowed')),
    });
    await call.start();
    await call.toggleScreen();
    expect(callSelf()).toMatchObject({ phase: 'live', screen: 'off' });
    call.stop();
    const participant = makeCall();
    await participant.call.start();
    await participant.call.toggleScreen();
    expect(participant.getDisplayMedia).not.toHaveBeenCalled();
    participant.call.stop();
  });

  it('receives the cameras and screens of the people heard, a maximised camera large', async () => {
    const { call } = makeCall();
    await call.start();
    receiveCallOp('p1', {
      kind: 'call-track',
      tabId: 't1',
      track: at('p1', 'mic'),
      video: at('p1', 'cam'),
      screen: at('p1', 'screen'),
    });
    receiveCallOp('p2', { kind: 'call-track', tabId: 't1', track: null, video: at('p2', 'cam') });
    call.update(
      scene([
        ['p1', 50],
        ['p2', 900],
      ]),
    );
    const s = sfu.instances[0]!;
    expect(s.want).toHaveBeenLastCalledWith([at('p1', 'mic'), at('p1', 'cam'), at('p1', 'screen')]);
    setCallMaximised({ id: 'p1', media: 'video' });
    expect(s.want).toHaveBeenLastCalledWith([
      at('p1', 'mic'),
      { ...at('p1', 'cam'), layer: 'f' },
      at('p1', 'screen'),
    ]);
    // Their streams arrive in the bubbles, and leave them even once the locator has gone.
    const video = { id: 'v' } as unknown as MediaStream;
    s.events.onTrack('p1s', 'cam', video);
    s.events.onTrack('p1s', 'screen', video);
    expect(callMedia().get('p1')).toEqual({ video, screen: video });
    receiveCallOp('p1', { kind: 'call-track', tabId: 't1', track: at('p1', 'mic') });
    s.events.onTrackEnded('p1s', 'cam');
    s.events.onTrackEnded('p1s', 'screen');
    expect(callMedia().has('p1')).toBe(false);
    s.events.onTrackEnded('nobody', 'cam');
    call.stop();
  });

  it('a hidden page receives voices only', async () => {
    let visible = true;
    const { call } = makeCall({ visible: () => visible });
    await call.start();
    receiveCallOp('p1', {
      kind: 'call-track',
      tabId: 't1',
      track: at('p1', 'mic'),
      video: at('p1', 'cam'),
    });
    visible = false;
    call.update(scene([['p1', 50]]));
    expect(sfu.instances[0]!.want).toHaveBeenLastCalledWith([at('p1', 'mic')]);
    visible = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sfu.instances[0]!.want).toHaveBeenLastCalledWith([at('p1', 'mic'), at('p1', 'cam')]);
    call.stop();
  });

  it('audio only stops the camera and the share and every bubble, and keeps the call', async () => {
    const { call, camera, display } = makeCall({ canShare: true });
    await call.start();
    await call.toggleCamera();
    await call.toggleScreen();
    receiveCallOp('p1', {
      kind: 'call-track',
      tabId: 't1',
      track: at('p1', 'mic'),
      video: at('p1', 'cam'),
    });
    call.update(scene([['p1', 50]]));
    receiveCallsMode('system', { kind: 'calls-mode', mode: 'audio-only' });
    expect(callSelf()).toMatchObject({ phase: 'live', camera: 'off', screen: 'off' });
    expect(camera.track.stop).toHaveBeenCalled();
    expect(display.track.stop).toHaveBeenCalled();
    expect(sfu.instances[0]!.want).toHaveBeenLastCalledWith([at('p1', 'mic')]);
    // Pressing either now does nothing.
    await call.toggleCamera();
    await call.toggleScreen();
    expect(callSelf()).toMatchObject({ camera: 'off', screen: 'off' });
    call.stop();
  });

  it('a camera or screen refused as audio only switches the mode, and a camera arriving then is let go', async () => {
    const camera = videoStream();
    let open: (s: MediaStream) => void = () => {};
    const { call } = makeCall({
      getUserMedia: (c) =>
        c.video ? new Promise((r) => (open = r)) : Promise.resolve(micStream().stream),
    });
    await call.start();
    const opening = call.toggleCamera();
    sfu.instances[0]!.events.onAudioOnly();
    expect(callSelf().mode).toBe('audio-only');
    open(camera.stream);
    await opening;
    expect(camera.track.stop).toHaveBeenCalled();
    expect(callSelf().camera).toBe('off');
    setCallsMode('on');
    call.stop();
  });

  it('reads the page’s own visibility when none is given', async () => {
    const { call } = makeCall();
    await call.start();
    receiveCallOp('p1', { kind: 'call-track', tabId: 't1', track: null, video: at('p1', 'cam') });
    call.update(scene([['p1', 50]]));
    expect(sfu.instances[0]!.want).toHaveBeenLastCalledWith([at('p1', 'cam')]);
    call.stop();
  });

  it('a camera refused or a picker cancelled after leaving changes nothing', async () => {
    let refuseCamera: (e: Error) => void = () => {};
    let refuseScreen: (e: Error) => void = () => {};
    const { call } = makeCall({
      canShare: true,
      getUserMedia: (c) =>
        c.video ? new Promise((_, no) => (refuseCamera = no)) : Promise.resolve(micStream().stream),
      getDisplayMedia: () => new Promise((_, no) => (refuseScreen = no)),
    });
    await call.start();
    const camera = call.toggleCamera();
    const sharing = call.toggleScreen();
    call.stop();
    refuseCamera(new Error('NotAllowed'));
    refuseScreen(new Error('NotAllowed'));
    await Promise.all([camera, sharing]);
    expect(callSelf()).toMatchObject({ phase: 'off', camera: 'off', screen: 'off' });
  });

  it('a share chosen after leaving, or once audio only, is let go', async () => {
    const display = videoStream();
    let choose: (s: MediaStream) => void = () => {};
    const { call } = makeCall({
      canShare: true,
      getDisplayMedia: () => new Promise((r) => (choose = r)),
    });
    await call.start();
    const sharing = call.toggleScreen();
    setCallsMode('audio-only');
    choose(display.stream);
    await sharing;
    expect(display.track.stop).toHaveBeenCalled();
    expect(callSelf().screen).toBe('off');
    setCallsMode('on');
    const again = call.toggleScreen();
    call.stop();
    choose(display.stream);
    await again;
    expect(callSelf().screen).toBe('off');
  });

  it('audio only clears a blocked camera back to off', async () => {
    const { call } = makeCall({
      getUserMedia: async (c) => {
        if (c.video) throw new Error('NotAllowed');
        return micStream().stream;
      },
    });
    await call.start();
    await call.toggleCamera();
    expect(callSelf().camera).toBe('blocked');
    setCallsMode('audio-only');
    expect(callSelf().camera).toBe('off');
    setCallsMode('on');
    call.stop();
  });
});

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls" (Work Tracker #319, #436).
describe('ProximityCall in rooms', () => {
  const loc = (id: string, trackName: string) => ({ sessionId: `${id}s`, trackName, token: 't' });
  // A 600 × 400 room at the origin; the corridor runs below it.
  const zones = roomZones([
    { id: 'meeting', type: 'shape', shape: 'room', x: 0, y: 0, width: 600, height: 400 },
  ]);
  const roomScene = (self: { x: number; y: number }, walkers: [string, number, number][]) => ({
    tabId: 't1',
    self,
    walkers: new Map(walkers.map(([id, x, y]) => [id, { x, y }])),
    zones,
  });

  it('hears and sees the room by distance, and nobody outside it, however close', async () => {
    const { call } = makeCall();
    await call.start();
    for (const id of ['near', 'far', 'outside']) {
      receiveCallOp(id, {
        kind: 'call-track',
        tabId: 't1',
        track: loc(id, 'mic'),
        video: loc(id, 'cam'),
      });
    }
    // You in one corner, a colleague a step away, another in the opposite corner, somebody just past the front wall.
    const others: [string, number, number][] = [
      ['near', 60, 380],
      ['far', 580, 50],
      ['outside', 20, 420],
    ];
    call.update(roomScene({ x: 20, y: 380 }, others));
    const s = sfu.instances[0]!;
    expect(callSelf().heard).toEqual(new Set(['near']));
    expect(callSelf().someoneNear).toBe(true);
    expect(s.want).toHaveBeenLastCalledWith([loc('near', 'mic'), loc('near', 'cam')]);
    s.events.onTrack('nears', 'mic', {});
    expect(graph.place).toHaveBeenLastCalledWith('near', 1, expect.any(Number));

    // Stepping out into the corridor: the room goes, the neighbour comes, by distance.
    call.update(roomScene({ x: 60, y: 420 }, others));
    expect(callSelf().heard).toEqual(new Set(['outside']));
    expect(s.want).toHaveBeenLastCalledWith([loc('outside', 'mic'), loc('outside', 'cam')]);
    s.events.onTrack('outsides', 'mic', {});
    expect(graph.place).toHaveBeenLastCalledWith('outside', 1, expect.any(Number));
    call.stop();
  });

  it('reads Nobody Near when the only walker is through a wall, and keeps the zoning for a late locator', async () => {
    const { call } = makeCall();
    await call.start();
    call.update(roomScene({ x: 300, y: 380 }, [['corridor', 300, 420]]));
    expect(callSelf().someoneNear).toBe(false);
    expect(callSelf().heard).toEqual(new Set());
    // Their microphone's locator arrives after the scene: still not heard.
    receiveCallOp('corridor', { kind: 'call-track', tabId: 't1', track: loc('corridor', 'mic') });
    expect(callSelf().heard).toEqual(new Set());
    // Without your character, nobody is near.
    call.update({ ...roomScene({ x: 0, y: 0 }, [['corridor', 300, 420]]), self: null });
    expect(callSelf().someoneNear).toBe(false);
    call.stop();
  });
});

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage" (Work Tracker #319 part 2): a hall with a stage
// along its back, and a meeting room beside it.
describe('ProximityCall with a stage', () => {
  const loc = (id: string, trackName: string) => ({ sessionId: `${id}s`, trackName, token: 't' });
  const elements = [
    { id: 'hall', type: 'shape', shape: 'room', x: 0, y: 0, width: 1200, height: 800 },
    { id: 'meeting', type: 'shape', shape: 'room', x: 1300, y: 0, width: 400, height: 300 },
  ];
  const zones = roomZones(elements);
  const stageAt = (over: Record<string, unknown> = {}) =>
    callStages(
      [
        {
          id: 'stage',
          type: 'shape',
          shape: 'stage',
          x: 420,
          y: 40,
          width: 360,
          height: 140,
          ...over,
        },
      ],
      zones,
    );
  const hallScene = (
    self: { x: number; y: number },
    walkers: [string, number, number][],
    stages = stageAt(),
  ) => ({
    tabId: 't1',
    self,
    walkers: new Map(walkers.map(([id, x, y]) => [id, { x, y }])),
    zones,
    stages,
  });
  const publish = (id: string) =>
    receiveCallOp(id, {
      kind: 'call-track',
      tabId: 't1',
      track: loc(id, 'mic'),
      video: loc(id, 'cam'),
    });

  it('hears an Editor on the stage from the meeting room, full and centred, and not their camera', async () => {
    setCallLevels([
      { id: 'speaker', role: 'edit' },
      { id: 'colleague', role: 'participate' },
    ]);
    const { call } = makeCall();
    await call.start();
    publish('speaker');
    publish('colleague');
    call.update(
      hallScene({ x: 1320, y: 50 }, [
        ['speaker', 600, 120],
        ['colleague', 1500, 150],
      ]),
    );
    const s = sfu.instances[0]!;
    expect(callSelf().heard).toEqual(new Set(['speaker', 'colleague']));
    // The stage's camera stays with the stage; the meeting room's colleague is seen as before.
    expect(s.want).toHaveBeenLastCalledWith([
      loc('speaker', 'mic'),
      loc('colleague', 'mic'),
      loc('colleague', 'cam'),
    ]);
    s.events.onTrack('speakers', 'mic', {});
    expect(graph.place).toHaveBeenCalledWith('speaker', 1, 0);
    // Show Cameras: the stage's camera reaches the tab too.
    call.update(
      hallScene(
        { x: 1320, y: 50 },
        [
          ['speaker', 600, 120],
          ['colleague', 1500, 150],
        ],
        stageAt({ stageCameras: true }),
      ),
    );
    const wanted = s.want.mock.calls.at(-1)![0] as unknown[];
    expect(wanted).toHaveLength(4);
    expect(wanted).toEqual(
      expect.arrayContaining([loc('speaker', 'cam'), loc('colleague', 'cam')]),
    );
    call.stop();
  });

  it('follows the room’s levels: a Participant speaks only once the stage, or their level, allows it', async () => {
    setCallLevels([{ id: 'p', role: 'participate' }]);
    const { call } = makeCall();
    await call.start();
    publish('p');
    const corridor = { x: 100, y: 900 };
    call.update(hallScene(corridor, [['p', 600, 120]]));
    expect(callSelf().heard).toEqual(new Set());
    // Their level rises (a new grant): the call re-stages the scene it holds.
    setCallLevels([{ id: 'p', role: 'edit' }]);
    expect(callSelf().heard).toEqual(new Set(['p']));
    // The same presence list again changes nothing.
    setCallLevels([{ id: 'p', role: 'edit' }]);
    expect(callSelf().heard).toEqual(new Set(['p']));
    call.stop();
  });

  it('a failed call hears nobody: no bars stay lit for people it no longer hears', async () => {
    setCallLevels([{ id: 'p', role: 'edit' }]);
    const { call } = makeCall();
    await call.start();
    publish('p');
    call.update(hallScene({ x: 600, y: 130 }, [['p', 600, 120]]));
    expect(callSelf().heard).toEqual(new Set(['p']));
    api.apiCallSession.mockRejectedValueOnce(new Error('offline'));
    sfu.instances.at(-1)!.events.onSessionGone();
    await settle();
    expect(callSelf()).toMatchObject({ phase: 'error', someoneNear: false, heard: new Set() });
  });

  it('on the stage: Live to the whole tab, deaf to the audience, and StageSpeak once per stepping on', async () => {
    setCallLevels([{ id: 'audience', role: 'participate' }]);
    const { call } = makeCall({ canShare: true });
    await call.start();
    publish('audience');
    const walkers: [string, number, number][] = [['audience', 640, 300]];
    call.update(hallScene({ x: 600, y: 120 }, walkers));
    expect(callSelf()).toMatchObject({ someoneNear: true, heard: new Set() });
    call.update(hallScene({ x: 610, y: 120 }, walkers));
    expect(telemetry.track).toHaveBeenCalledTimes(1);
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'StageSpeak');
    // Off the stage, in the hall: back to the room, the audience heard again.
    call.update(hallScene({ x: 600, y: 400 }, walkers));
    expect(callSelf().heard).toEqual(new Set(['audience']));
    call.update(hallScene({ x: 600, y: 120 }, walkers));
    expect(telemetry.track).toHaveBeenCalledTimes(2);
    call.stop();
  });
  // meeting-rooms-and-stage.md "Raise hand" and "The stage line" (Work Tracker #319 part 3).
  const letSpeak = (from: string, on: boolean) =>
    receiveLetSpeak(from, { kind: 'avatar-let-speak', tabId: 't1', targetId: 'me', on });
  const hands = (sent: CallSignal[]) => sent.filter((x) => x.kind === 'avatar-hand');

  it('raises a hand as the audience, is let speak by the stage, heard by the tab, and Done lowers it', async () => {
    setCallLevels([
      { id: 'speaker', role: 'edit' },
      { id: 'floor', role: 'participate' },
      { id: 'out', role: 'participate' },
    ]);
    const { call, sent } = makeCall();
    await call.start();
    publish('speaker');
    publish('floor');
    const walkers: [string, number, number][] = [
      ['speaker', 600, 120],
      ['floor', 300, 600],
    ];
    const hall = { x: 320, y: 600 };
    // No stage live yet: Raise Hand is refused.
    call.update(hallScene(hall, [['floor', 300, 600]]));
    expect(callSelf()).toMatchObject({ stage: 'none', hand: 'down' });
    call.raiseHand();
    expect(hands(sent)).toEqual([]);
    call.update(hallScene(hall, walkers));
    expect(callSelf()).toMatchObject({ stage: 'audience', hand: 'down', barredBy: null });
    call.raiseHand();
    expect(callSelf().hand).toBe('raised');
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'RaiseHand');
    // A Participant on the floor may not let you speak.
    letSpeak('floor', true);
    expect(callSelf().hand).toBe('raised');
    letSpeak('speaker', true);
    expect(callSelf()).toMatchObject({ hand: 'speaking', stage: 'speaker' });
    expect(hands(sent).at(-1)).toEqual({ kind: 'avatar-hand', raised: true, letSpeak: 'speaker' });
    // As a speaker you hear the stage, not your neighbour on the floor.
    expect(callSelf().heard).toEqual(new Set(['speaker']));
    // A newcomer is told the hand is up.
    call.update(hallScene(hall, [...walkers, ['out', 100, 900]]));
    expect(hands(sent).at(-1)).toEqual({ kind: 'avatar-hand', raised: true, letSpeak: 'speaker' });
    letSpeak('speaker', false);
    expect(callSelf().hand).toBe('down');
    expect(hands(sent).at(-1)).toEqual({ kind: 'avatar-hand', raised: false });
    call.stop();
  });

  it('keeps speaking when whoever let it speak reconnects as the same person, and only then', async () => {
    setCallLevels([{ id: 'speaker', role: 'edit', key: 'K-ed' }]);
    const { call, sent } = makeCall();
    await call.start();
    const hall = { x: 320, y: 600 };
    call.update(hallScene(hall, [['speaker', 600, 120]]));
    call.raiseHand();
    letSpeak('speaker', true);
    expect(callSelf().hand).toBe('speaking');
    // The hand names the person too, so every browser can follow them.
    expect(hands(sent).at(-1)).toEqual({
      kind: 'avatar-hand',
      raised: true,
      letSpeak: 'speaker',
      letSpeakKey: 'K-ed',
    });
    // Their socket drops and comes back: a new presence id with the same key, still on the stage.
    setCallLevels([{ id: 'speaker2', role: 'edit', key: 'K-ed' }]);
    call.update(hallScene(hall, [['speaker2', 600, 120]]));
    expect(callSelf()).toMatchObject({ hand: 'speaking', stage: 'speaker' });
    // Someone else takes their place instead: the audience again, the hand still up.
    setCallLevels([{ id: 'other', role: 'edit', key: 'K-other' }]);
    call.update(hallScene(hall, [['other', 600, 120]]));
    expect(callSelf().hand).toBe('raised');
    call.stop();
  });

  it('lowers your own hand when your own room connection drops, as the room did for everyone', async () => {
    setCallLevels([{ id: 'speaker', role: 'edit' }]);
    const { call, sent } = makeCall();
    await call.start();
    call.update(hallScene({ x: 320, y: 600 }, [['speaker', 600, 120]]));
    call.raiseHand();
    expect(callSelf().hand).toBe('raised');
    noteRoomDropped();
    expect(callSelf().hand).toBe('down');
    expect(hands(sent).at(-1)).toEqual({ kind: 'avatar-hand', raised: false });
    // With no hand up, a drop sends nothing.
    const before = sent.length;
    noteRoomDropped();
    expect(sent.length).toBe(before);
    call.stop();
  });

  it('lowers a hand on walking out of the room, on Lower Hand, and on leaving', async () => {
    setCallLevels([{ id: 'speaker', role: 'edit' }]);
    const { call, sent } = makeCall();
    await call.start();
    const walkers: [string, number, number][] = [['speaker', 600, 120]];
    call.update(hallScene({ x: 320, y: 600 }, walkers));
    call.raiseHand();
    call.update(hallScene({ x: 100, y: 900 }, walkers));
    expect(callSelf().hand).toBe('down');
    call.update(hallScene({ x: 320, y: 600 }, walkers));
    call.raiseHand();
    call.lowerHand();
    expect(callSelf().hand).toBe('down');
    call.raiseHand();
    call.stop();
    expect(hands(sent).at(-1)).toEqual({ kind: 'avatar-hand', raised: false });
    expect(callSelf()).toMatchObject({ hand: 'down', stage: 'none', handsUp: 0 });
  });

  it('counts the raised hands for a speaker, and hears a hand it let speak', async () => {
    setCallLevels([
      { id: 'a', role: 'participate' },
      { id: 'b', role: 'participate' },
    ]);
    const { call } = makeCall({ canShare: true });
    await call.start();
    publish('a');
    publish('b');
    const walkers: [string, number, number][] = [
      ['a', 300, 600],
      ['b', 900, 600],
    ];
    call.update(hallScene({ x: 600, y: 120 }, walkers));
    expect(callSelf()).toMatchObject({ stage: 'speaker', handsUp: 0, heard: new Set() });
    receiveCallOp('a', { kind: 'avatar-hand', tabId: 't1', raised: true });
    receiveCallOp('b', { kind: 'avatar-hand', tabId: 't1', raised: true });
    expect(callSelf().handsUp).toBe(2);
    // You let a speak (your own id never comes back to you): a joins the stage.
    noteLetSpeak('a', true);
    receiveCallOp('a', { kind: 'avatar-hand', tabId: 't1', raised: true, letSpeak: 'p-me' });
    expect(callSelf()).toMatchObject({ handsUp: 1, heard: new Set(['a']) });
    call.stop();
  });

  it('says which stage bars you while you stand on it', async () => {
    const { call } = makeCall();
    await call.start();
    call.update(hallScene({ x: 600, y: 120 }, []));
    expect(callSelf()).toMatchObject({ stage: 'barred', barredBy: 'edit' });
    call.update(hallScene({ x: 600, y: 120 }, [], stageAt({ stageSpeakers: 'take-part' })));
    expect(callSelf()).toMatchObject({ stage: 'speaker', barredBy: null });
    call.stop();
  });

  // meeting-rooms-and-stage.md "Do Not Disturb".
  it('hears nobody under Do Not Disturb, the stage included, and keeps publishing', async () => {
    setCallLevels([{ id: 'speaker', role: 'edit' }]);
    const { call, sent } = makeCall();
    await speak(call);
    publish('speaker');
    call.update(hallScene({ x: 320, y: 600 }, [['speaker', 600, 120]]));
    expect(callSelf().heard).toEqual(new Set(['speaker']));
    call.setDoNotDisturb(true);
    call.setDoNotDisturb(true);
    expect(callSelf().heard).toEqual(new Set());
    expect(sfu.instances[0]!.want).toHaveBeenLastCalledWith([]);
    expect(sent.some((x) => x.kind === 'call-track')).toBe(true);
    call.setDoNotDisturb(false);
    expect(callSelf().heard).toEqual(new Set(['speaker']));
    call.stop();
  });
});

// docs/specs/016-platform/calls-kill-switch.md "The room tells its clients" (Work Tracker #463).
describe('ProximityCall in a silent room', () => {
  afterEach(() => graph.micLevel.mockReturnValue(0.05));

  it('asks the room to read the switch every 5 s of silence, and a flip lands within one check', async () => {
    // Nobody talks: the microphone hears nothing, so no level goes to the room.
    graph.micLevel.mockReturnValue(0);
    const { call, sent } = makeCall();
    await speak(call);
    call.update(scene([['p1', 100]]));
    // The locator goes out again for the new walker, a second after the first.
    vi.advanceTimersByTime(LOCATOR_RESEND_MS);
    expect(sent.at(-1)?.kind).toBe('call-track');
    sent.length = 0;
    vi.advanceTimersByTime(CALLS_CHECK_MS - 1);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([{ kind: 'calls-check' }]);
    vi.advanceTimersByTime(CALLS_CHECK_MS);
    expect(sent).toEqual([{ kind: 'calls-check' }, { kind: 'calls-check' }]);
    // The room read the switch on that check and pushed the flip: the call ends into Calls Paused.
    receiveCallsMode('system', { kind: 'calls-mode', mode: 'off' });
    expect(callSelf()).toMatchObject({ phase: 'off', mode: 'off' });
    sent.length = 0;
    vi.advanceTimersByTime(CALLS_CHECK_MS * 3);
    expect(sent).toEqual([]);
  });

  it('sends no check while its levels reach the room, and none from a listener', async () => {
    graph.micLevel.mockReturnValue(0.05);
    const { call, sent } = makeCall();
    await speak(call);
    // Talking: a level goes at least every few seconds, and each one lets the room read the switch on its own.
    vi.advanceTimersByTime(CALLS_CHECK_MS * 3);
    expect(sent.some((s) => s.kind === 'avatar-voice')).toBe(true);
    expect(sent.filter((s) => s.kind === 'calls-check')).toEqual([]);
    call.stop();

    const listener = makeCall({ canSpeak: false });
    await listener.call.start();
    vi.advanceTimersByTime(CALLS_CHECK_MS * 3);
    expect(listener.sent).toEqual([]);
    listener.call.stop();
  });
});

// proximity-audio.md "A session that expires": Realtime drops a session nobody connected to in time.
describe('ProximityCall renewing a session Realtime dropped', () => {
  const gone = () => new CallsApiError(410, 'calls_session_gone');
  const renewed = { ...session, sessionId: 'me2', sessionToken: 's.y' };

  // The first unmute, half a minute after walking in: its publish finds the session gone.
  // The session raises onSessionGone as the publish is refused.
  async function goneOnPublish(unmute: () => void) {
    const inst = sfu.instances[0]!;
    inst.publish.mockRejectedValueOnce(gone());
    unmute();
    inst.events.onSessionGone();
    await settle();
  }

  it('mints a new session, proves it, and publishes the microphone on it', async () => {
    const { call, sent, proved, mic } = makeCall();
    await call.start();
    api.apiCallSession.mockResolvedValueOnce(renewed);
    await goneOnPublish(() => call.toggleMute());
    expect(api.apiCallSession).toHaveBeenCalledTimes(2);
    expect(sfu.instances[0]!.close).toHaveBeenCalledTimes(1);
    expect(sfu.instances[1]!.publish).toHaveBeenCalledWith(mic.track);
    expect(proved.at(-1)).toEqual({ kind: 'call-session', sessionId: 'me2', sessionToken: 's.y' });
    expect(sent.at(-1)).toEqual({
      kind: 'call-track',
      track: { sessionId: 'me', trackName: 'mic', token: 'tt' },
    });
    expect(sfu.instances[1]!.want).toHaveBeenCalled();
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'CallRenewed');
    expect(callSelf()).toMatchObject({ phase: 'live', mic: 'open', muted: false });
    call.stop();
  });

  it('publishes the camera again beside the microphone', async () => {
    const { call, mic, camera } = makeCall();
    await speak(call);
    await call.toggleCamera();
    sfu.instances[0]!.events.onSessionGone();
    await settle();
    const publish = sfu.instances[1]!.publish;
    expect(publish).toHaveBeenCalledWith(mic.track);
    expect(publish).toHaveBeenCalledWith(camera.track, 'cam', CAMERA_ENCODINGS);
    call.stop();
  });

  it('keeps a camera whose publish was refused on your own screen, with no unhandled error', async () => {
    const { call } = makeCall();
    await call.start();
    sfu.instances[0]!.publish.mockRejectedValueOnce(new CallsApiError(502, 'calls_upstream'));
    await call.toggleCamera();
    expect(callSelf().camera).toBe('on');
    call.stop();
  });

  it('leaves a released microphone unpublished, so the next unmute publishes it on the new session', async () => {
    const { call } = makeCall();
    await speak(call);
    call.toggleMute();
    call.update(scene([]));
    vi.advanceTimersByTime(MIC_IDLE_CLOSE_MS);
    sfu.instances[0]!.events.onSessionGone();
    await settle();
    expect(sfu.instances[1]!.publish).not.toHaveBeenCalled();
    call.toggleMute();
    await settle();
    expect(sfu.instances[1]!.publish).toHaveBeenCalledTimes(1);
    expect(sfu.instances[1]!.replaceMic).not.toHaveBeenCalled();
    call.stop();
  });

  it('opens a microphone unmuted while the session was being renewed', async () => {
    const { call, getUserMedia } = makeCall();
    await call.start();
    let mint: (v: typeof session) => void = () => {};
    api.apiCallSession.mockImplementationOnce(() => new Promise((r) => (mint = r)));
    sfu.instances[0]!.events.onSessionGone();
    call.toggleMute();
    await settle();
    expect(getUserMedia).not.toHaveBeenCalled();
    mint(renewed);
    await settle();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(sfu.instances[1]!.publish).toHaveBeenCalledTimes(1);
    call.stop();
  });

  // A camera, a screen or a microphone the browser was still asking for when the session went: published on the
  // session as it is when the browser answers, never on the closed one the press found.
  it('publishes a camera and a screen started during a renewal on the new session', async () => {
    const { call, camera, display, sent } = makeCall({
      canShare: true,
      getUserMedia: () => new Promise((r) => (openCamera = r)),
      getDisplayMedia: () => new Promise((r) => (openScreen = r)),
    });
    let openCamera: (s: MediaStream) => void = () => {};
    let openScreen: (s: MediaStream) => void = () => {};
    await call.start();
    const cameraOn = call.toggleCamera();
    const screenOn = call.toggleScreen();
    api.apiCallSession.mockResolvedValueOnce(renewed);
    sfu.instances[0]!.events.onSessionGone();
    await settle();
    openCamera(camera.stream);
    openScreen(display.stream);
    await Promise.all([cameraOn, screenOn]);
    expect(sfu.instances[0]!.publish).not.toHaveBeenCalled();
    const publish = sfu.instances[1]!.publish;
    expect(publish).toHaveBeenCalledWith(camera.track, 'cam', CAMERA_ENCODINGS);
    expect(publish).toHaveBeenCalledWith(display.track, 'screen', expect.anything());
    expect(sent.at(-1)).toMatchObject({ kind: 'call-track', video: { trackName: 'cam' } });
    call.stop();
  });

  it('a camera the browser answers while the new session is minted goes out once it is up', async () => {
    const { call, camera } = makeCall({ getUserMedia: () => new Promise((r) => (openCamera = r)) });
    let openCamera: (s: MediaStream) => void = () => {};
    await call.start();
    const cameraOn = call.toggleCamera();
    let mint: (v: typeof session) => void = () => {};
    api.apiCallSession.mockImplementationOnce(() => new Promise((r) => (mint = r)));
    sfu.instances[0]!.events.onSessionGone();
    openCamera(camera.stream);
    await cameraOn;
    expect(callSelf().camera).toBe('on');
    expect(sfu.instances[0]!.publish).not.toHaveBeenCalled();
    mint(renewed);
    await settle();
    expect(sfu.instances[1]!.publish).toHaveBeenCalledWith(camera.track, 'cam', CAMERA_ENCODINGS);
    call.stop();
  });

  it('a camera pressed while the new session is minted starts, and goes out once it is up', async () => {
    const { call, camera, getUserMedia } = makeCall();
    await call.start();
    let mint: (v: typeof session) => void = () => {};
    api.apiCallSession.mockImplementationOnce(() => new Promise((r) => (mint = r)));
    sfu.instances[0]!.events.onSessionGone();
    await call.toggleCamera();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(callSelf().camera).toBe('on');
    mint(renewed);
    await settle();
    expect(sfu.instances[0]!.publish).not.toHaveBeenCalled();
    expect(sfu.instances[1]!.publish).toHaveBeenCalledWith(camera.track, 'cam', CAMERA_ENCODINGS);
    call.stop();
  });

  it('publishes a microphone the browser opened during a renewal on the new session', async () => {
    const { stream, track } = micStream();
    let open: (s: MediaStream) => void = () => {};
    const { call } = makeCall({ getUserMedia: () => new Promise((r) => (open = r)) });
    await call.start();
    call.toggleMute();
    let mint: (v: typeof session) => void = () => {};
    api.apiCallSession.mockImplementationOnce(() => new Promise((r) => (mint = r)));
    sfu.instances[0]!.events.onSessionGone();
    open(stream);
    await settle();
    expect(sfu.instances[0]!.publish).not.toHaveBeenCalled();
    mint(renewed);
    await settle();
    expect(sfu.instances[1]!.publish).toHaveBeenCalledWith(track);
    expect(callSelf()).toMatchObject({ mic: 'open', muted: false });
    call.stop();
  });

  it('renews once at a time, and ignores the closed session from then on', async () => {
    const { call } = makeCall();
    await call.start();
    sfu.instances[0]!.events.onSessionGone();
    sfu.instances[0]!.events.onSessionGone();
    await settle();
    expect(api.apiCallSession).toHaveBeenCalledTimes(2);
    const old = sfu.instances[0]!.events;
    old.onSessionGone();
    old.onFailed();
    old.onPaused();
    old.onAudioOnly();
    old.onNotHeard();
    old.onTrack('p1', 'mic', {});
    await settle();
    expect(api.apiCallSession).toHaveBeenCalledTimes(2);
    expect(callSelf()).toMatchObject({ phase: 'live', mode: 'on' });
    call.stop();
  });

  it('fails into Retry after RENEW_MAX renewals inside a minute, never looping', async () => {
    const { call } = makeCall();
    await call.start();
    for (let i = 0; i < RENEW_MAX; i++) {
      sfu.instances.at(-1)!.events.onSessionGone();
      await settle();
    }
    expect(api.apiCallSession).toHaveBeenCalledTimes(1 + RENEW_MAX);
    sfu.instances.at(-1)!.events.onSessionGone();
    await settle();
    expect(api.apiCallSession).toHaveBeenCalledTimes(1 + RENEW_MAX);
    expect(callSelf().phase).toBe('error');
  });

  it('renews again once the window has passed', async () => {
    const { call } = makeCall();
    await call.start();
    for (let i = 0; i < RENEW_MAX; i++) {
      sfu.instances.at(-1)!.events.onSessionGone();
      await settle();
    }
    vi.advanceTimersByTime(61_000);
    sfu.instances.at(-1)!.events.onSessionGone();
    await settle();
    expect(api.apiCallSession).toHaveBeenCalledTimes(2 + RENEW_MAX);
    expect(callSelf().phase).toBe('live');
    call.stop();
  });

  it('a renewal the kill switch refuses pauses calls; any other refusal fails', async () => {
    const paused = makeCall();
    await paused.call.start();
    api.apiCallSession.mockRejectedValueOnce(new CallsApiError(503, 'calls_off', 'paused'));
    sfu.instances[0]!.events.onSessionGone();
    await settle();
    expect(callSelf()).toMatchObject({ phase: 'off', mode: 'off' });
    setCallsMode('on');
    const failed = makeCall();
    await failed.call.start();
    api.apiCallSession.mockRejectedValueOnce(new Error('offline'));
    sfu.instances.at(-1)!.events.onSessionGone();
    await settle();
    expect(callSelf().phase).toBe('error');
  });

  it('stops renewing a call that ended meanwhile', async () => {
    const { call } = makeCall();
    await call.start();
    let mint: (v: typeof session) => void = () => {};
    api.apiCallSession.mockImplementationOnce(() => new Promise((r) => (mint = r)));
    sfu.instances[0]!.events.onSessionGone();
    call.stop();
    mint(renewed);
    await settle();
    expect(sfu.instances).toHaveLength(1);
    expect(callSelf().phase).toBe('off');
  });
});
