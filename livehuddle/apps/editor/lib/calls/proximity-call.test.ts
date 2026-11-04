// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsApiError } from '@/lib/api/calls';
import {
  callMedia,
  callSelf,
  receiveCallOp,
  receiveCallsMode,
  resetCallMedia,
  resetCallPeers,
  resetCallSelf,
  setCallMaximised,
  setCallsMode,
} from './calls-store';
import {
  CAMERA_ENCODINGS,
  MIC_IDLE_CLOSE_MS,
  ProximityCall,
  SCREEN_CONSTRAINTS,
  type CallSignal,
} from './proximity-call';
import { roomZones } from './zones';

const sfu = vi.hoisted(() => ({
  instances: [] as {
    events: {
      onTrack: (p: string, name: string, s: unknown) => void;
      onTrackEnded: (p: string, name: string) => void;
      onFailed: () => void;
      onPaused: () => void;
      onAudioOnly: () => void;
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
  const track = { enabled: true, stop: vi.fn() };
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
  } = {},
) {
  const sent: CallSignal[] = [];
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
    context,
    send: (s) => sent.push(s),
    getUserMedia,
    getDisplayMedia,
    ...(opts.visible ? { pageVisible: opts.visible } : {}),
  });
  return { call, sent, mic, camera, display, getUserMedia, getDisplayMedia };
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

// docs/specs/012-collaboration/video-and-screen-bubbles.md.
describe('ProximityCall video and screens', () => {
  const me = (trackName: string) => ({ sessionId: 'me', trackName, token: 'tt' });
  const at = (id: string, trackName: string) => ({ sessionId: `${id}s`, trackName, token: 'a' });

  it('turns the camera on in two layers, shows it to you, tells the room, and off again', async () => {
    const { call, sent, camera, getUserMedia } = makeCall();
    await call.start();
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

  it('shares a screen for an Editor, capped and tuned for text, and stops from either control', async () => {
    const { call, sent, display, getDisplayMedia } = makeCall({ canShare: true });
    await call.start();
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

  it('hears and sees the whole room at full volume, and nobody outside it, however close', async () => {
    const { call } = makeCall();
    await call.start();
    for (const id of ['far', 'outside']) {
      receiveCallOp(id, {
        kind: 'call-track',
        tabId: 't1',
        track: loc(id, 'mic'),
        video: loc(id, 'cam'),
      });
    }
    // You in one corner, a colleague in the opposite one, somebody just past the front wall in the corridor.
    call.update(
      roomScene({ x: 20, y: 380 }, [
        ['far', 580, 50],
        ['outside', 20, 420],
      ]),
    );
    const s = sfu.instances[0]!;
    expect(callSelf().heard).toEqual(new Set(['far']));
    expect(callSelf().someoneNear).toBe(true);
    expect(s.want).toHaveBeenLastCalledWith([loc('far', 'mic'), loc('far', 'cam')]);
    s.events.onTrack('fars', 'mic', {});
    expect(graph.place).toHaveBeenLastCalledWith('far', 1, expect.any(Number));

    // Stepping out into the corridor: the room goes, the neighbour comes, by distance.
    call.update(
      roomScene({ x: 60, y: 420 }, [
        ['far', 580, 50],
        ['outside', 20, 420],
      ]),
    );
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
