// One browser's proximity call (docs/specs/012-collaboration/proximity-audio.md): from Join Audio to Leave Audio, it
// mints a Realtime session through the api, publishes the microphone, hears the speakers in earshot at their
// distance and side, detects your own voice for the equaliser, and closes the microphone while nobody is on your
// tab. Loaded only when somebody presses Join Audio; the canvas feeds it positions through `update`. The calls kill
// switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused") ends it quietly, from the room's push or a
// refused mint. The camera and a shared screen ride the same session (docs/specs/012-collaboration/
// video-and-screen-bubbles.md): published on demand, received as bubbles from the people heard and on screen. A
// stage (meeting-rooms-and-stage.md "The stage") reaches the whole tab; a silent call that publishes nudges the room
// to read the kill switch (calls-kill-switch.md "The room tells its clients"). The stage's audience raises a hand
// and may be let speak, and Do Not Disturb hears nobody (meeting-rooms-and-stage.md "Raise hand", "Do Not Disturb").
import {
  CALL_SCREEN_TRACK_NAME,
  CALL_VIDEO_TRACK_NAME,
  callsModeAllows,
  type AccessLevel,
  type CallTrackLocator,
  type VoiceLevel,
} from '@livehuddle/api-schema';
import { apiCallSession, CallsApiError, type CallsCaller } from '@/lib/api/calls';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { AudioGraph } from './audio-graph';
import { pickSeen, type ViewRect } from './bubbles';
import {
  callHands,
  callLetByMe,
  callLevels,
  callMaximised,
  callPeers,
  callSelf,
  onCallHands,
  onCallLevels,
  onCallMaximised,
  onCallsMode,
  onCallTracks,
  onLetSpeak,
  resetCallMedia,
  SELF_MEDIA_ID,
  setCallMedia,
  setCallSelf,
  setCallsMode,
  type CallMedia,
} from './calls-store';
import { nextHeard, placeFor, someoneHears, togetherWith, type Point } from './hearing';
import { SfuSession, type SfuWant } from './sfu-session';
import { RaisedHand, stagePlace, type HandSignal } from './raised-hand';
import {
  barringStage,
  letSpeakers,
  mayLetSpeak,
  mayLetSpeakSelf,
  staging,
  type CallStage,
} from './stage';
import { zoning, type CallZone, type CallZoning } from './zones';
import {
  silenceVoice,
  SILENT,
  stepVoice,
  VOICE_REFRESH_MS,
  VOICE_SAMPLE_MS,
  type VoiceState,
} from './voice-detector';

/** Alone on a tab this long, the microphone closes. */
export const MIC_IDLE_CLOSE_MS = 15_000;
/** A speaker's locator goes out again for a new walker at most this often. */
export const LOCATOR_RESEND_MS = 1000;
/**
 * A publishing call that has sent the room nothing this long asks it to read the kill switch (#463): just past a
 * talking speaker's level refresh, so a speaker who is talking never sends one.
 */
export const CALLS_CHECK_MS = VOICE_REFRESH_MS + 2 * VOICE_SAMPLE_MS;

/** The camera's source: the large layer's size (video-and-screen-bubbles.md "Two layers"). */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
};
/** Two simulcast layers, large first (Realtime ranks RIDs a to z): `f` 720p at 1.5 Mbps, `h` half size at 300 kbps. */
export const CAMERA_ENCODINGS: RTCRtpEncodingParameters[] = [
  { rid: 'f', maxBitrate: 1_500_000, maxFramerate: 24 },
  { rid: 'h', scaleResolutionDownBy: 2, maxBitrate: 300_000, maxFramerate: 24 },
];
/** A screen, capped for cost and clarity: up to 1080p at 5 to 15 fps (video-and-screen-bubbles.md "The screen share"). */
export const SCREEN_MAX_FPS = 15;
export const SCREEN_MAX_BITRATE = 1_000_000;
export const SCREEN_CONSTRAINTS: DisplayMediaStreamOptions = {
  audio: false,
  video: {
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { ideal: SCREEN_MAX_FPS, max: SCREEN_MAX_FPS },
  },
};
const SCREEN_ENCODINGS: RTCRtpEncodingParameters[] = [
  { maxBitrate: SCREEN_MAX_BITRATE, maxFramerate: SCREEN_MAX_FPS },
];

/** What a call sends over the room: the editor adds the tab. */
export type CallSignal =
  | { kind: 'avatar-voice'; level: VoiceLevel }
  | { kind: 'calls-check' }
  | {
      kind: 'call-track';
      track: CallTrackLocator | null;
      video?: CallTrackLocator | null;
      screen?: CallTrackLocator | null;
    }
  | HandSignal
  | { kind: 'avatar-let-speak'; targetId: string; on: boolean };

const NOBODY: ReadonlySet<string> = new Set();

/**
 * Where everyone stands, as the canvas sees it: your feet, every other walker's on your tab, the visible area, the
 * tab's visible Office rooms, each one call (meeting-rooms-and-stage.md "Rooms are calls"), and its visible stages
 * (the same spec's "The stage").
 */
export type CallScene = {
  tabId: string;
  self: Point | null;
  walkers: ReadonlyMap<string, Point>;
  view?: ViewRect | null;
  zones?: readonly CallZone[];
  stages?: readonly CallStage[];
};

export type ProximityCallInput = {
  caller: CallsCaller;
  canSpeak: boolean;
  // An Editor: may share a screen.
  canShare?: boolean;
  // Made in the Join press, so the browser lets it play.
  context: AudioContext;
  send: (signal: CallSignal) => void;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  getDisplayMedia?: (options: DisplayMediaStreamOptions) => Promise<MediaStream>;
  // Whether the page is visible; a hidden tab receives no bubbles. Defaults to the document's.
  pageVisible?: () => boolean;
};

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

const MEDIA_OF: Readonly<Record<string, CallMedia | undefined>> = {
  [CALL_VIDEO_TRACK_NAME]: 'video',
  [CALL_SCREEN_TRACK_NAME]: 'screen',
};

// Out of the call: off every stage, hand down.
const LEFT_STAGE = { stage: 'none', barredBy: null, hand: 'down', handsUp: 0 } as const;

const documentVisible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

export class ProximityCall {
  private readonly input: ProximityCallInput;
  private readonly graph: AudioGraph;
  private sfu: SfuSession | null = null;
  private trackToken: string | null = null;
  private mic: MediaStream | null = null;
  private micBlocked = false;
  private muted = false;
  private published = false;
  private camera: MediaStream | null = null;
  private screen: MediaStream | null = null;
  // Whether the op carries a camera or screen slot: once used in this call, it says when it goes off too.
  private cameraAnnounced = false;
  private screenAnnounced = false;
  private voice: VoiceState = SILENT;
  private sampler: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private heard: ReadonlySet<string> = new Set();
  private scene: CallScene = { tabId: '', self: null, walkers: new Map() };
  // Everyone's room, and who speaks from a stage, worked out once per scene and read by hearing, placing and the mic
  // indicator.
  private zoning: CallZoning = { self: null, of: new Map() };
  // Whether you spoke from a stage at the last scene, so stepping on is counted once.
  private onStage = false;
  // When this call last sent the room anything, and the nudge due after a quiet CALLS_CHECK_MS.
  private checkDue: ReturnType<typeof setTimeout> | null = null;
  private knownWalkers = new Set<string>();
  private locatorSentAt = -Infinity;
  private locatorDue: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  // Publisher session and track → the presence id it was received for, so an ended track finds its owner even after
  // the owner's locator has gone.
  private readonly owners = new Map<string, string>();
  private readonly unsubscribeTracks: () => void;
  private readonly unsubscribeMode: () => void;
  private readonly unsubscribeMaximised: () => void;
  private readonly unsubscribeLevels: () => void;
  private readonly unsubscribeHands: () => void;
  private readonly unsubscribeLetSpeak: () => void;
  private readonly onVisibility = () => this.hear();
  // Your raised hand (meeting-rooms-and-stage.md "Raise hand"), and Do Not Disturb (the same spec's).
  private readonly hand: RaisedHand;
  private dnd = false;

  constructor(input: ProximityCallInput) {
    this.input = input;
    this.graph = new AudioGraph(input.context);
    this.unsubscribeTracks = onCallTracks(() => this.hear());
    this.unsubscribeMode = onCallsMode(() => this.applyMode());
    this.unsubscribeMaximised = onCallMaximised(() => this.hear());
    // A peer's level changing may let them speak from the stage they stand on, or stop them.
    this.unsubscribeLevels = onCallLevels(() => this.update(this.scene));
    this.hand = new RaisedHand((signal) => this.send(signal));
    // A hand going up, down or let speak changes who speaks and the count a speaker sees.
    this.unsubscribeHands = onCallHands(() => this.update(this.scene));
    this.unsubscribeLetSpeak = onLetSpeak((from, on) => this.onLetSpeak(from, on));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  /** Your level: an Editor may share a screen, a Participant may speak, a Viewer listens. */
  private get level(): AccessLevel {
    if (this.input.canShare) return 'edit';
    return this.input.canSpeak ? 'participate' : 'view';
  }

  /** Whether this call has stopped (left, failed or paused); a stopped call never starts again. */
  get ended(): boolean {
    return this.stopped;
  }

  /** Mint the session, open the microphone (a speaker's), publish it and start hearing. */
  async start(): Promise<void> {
    setCallSelf({ phase: 'joining', muted: false, level: 0 });
    void this.input.context.resume().catch(() => {});
    try {
      const session = await apiCallSession(this.input.caller);
      if (this.stopped) return;
      // The session says what the switch allows (an older api says nothing: on).
      setCallsMode(session.mode === 'audio-only' ? 'audio-only' : 'on');
      this.trackToken = session.trackToken ?? null;
      this.sfu = new SfuSession(this.input.caller, session, {
        onTrack: (publisher, trackName, stream) => this.onTrack(publisher, trackName, stream),
        onTrackEnded: (publisher, trackName) => this.onTrackEnded(publisher, trackName),
        onFailed: () => this.fail('connection'),
        onPaused: () => this.pause(),
        onAudioOnly: () => setCallsMode('audio-only'),
      });
      if (this.input.canSpeak && session.canSpeak) await this.openMic();
      if (this.stopped) return;
      setCallSelf({ phase: 'live' });
      this.hear();
    } catch (error) {
      if (error instanceof CallsApiError && error.paused) {
        this.pause();
        return;
      }
      this.fail(error instanceof CallsApiError ? (error.code ?? String(error.status)) : 'start');
    }
  }

  // The switch changed: off ends the call; audio only stops the camera and the share, and every bubble goes.
  private applyMode(): void {
    const mode = callSelf().mode;
    if (!callsModeAllows(mode, 'session')) {
      this.pause();
      return;
    }
    if (!callsModeAllows(mode, 'video')) this.stopCamera();
    if (!callsModeAllows(mode, 'screen')) this.stopScreen();
    this.hear();
  }

  /** The kill switch paused calls: end as Leave Audio does, into Calls Paused. Never an error. */
  private pause(): void {
    if (this.stopped) return;
    debugLog('[calls] paused');
    this.stop();
    setCallsMode('off');
  }

  private fail(why: string): void {
    debugLog('[calls] failed', why);
    if (this.stopped) return;
    this.teardown();
    setCallSelf({
      phase: 'error',
      mic: this.micBlocked ? 'blocked' : 'closed',
      level: 0,
      camera: 'off',
      screen: 'off',
      ...LEFT_STAGE,
    });
  }

  private async openMic(): Promise<void> {
    if (this.mic || this.micBlocked || !this.sfu || !this.trackToken) return;
    const getUserMedia =
      this.input.getUserMedia ??
      ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c));
    let stream: MediaStream;
    try {
      stream = await getUserMedia(MIC_CONSTRAINTS);
    } catch {
      this.micBlocked = true;
      setCallSelf({ mic: 'blocked' });
      return;
    }
    if (this.stopped) {
      for (const t of stream.getTracks()) t.stop();
      return;
    }
    this.mic = stream;
    const track = stream.getAudioTracks()[0]!;
    track.enabled = !this.muted;
    this.graph.listenTo(stream);
    setCallSelf({ mic: 'open' });
    this.startSampling();
    if (this.published) {
      await this.sfu.replaceMic(track);
    } else {
      this.published = true;
      await this.sfu.publish(track);
      this.sendLocator(true);
    }
  }

  private closeMic(): void {
    if (!this.mic) return;
    for (const t of this.mic.getTracks()) t.stop();
    this.mic = null;
    this.graph.listenTo(null);
    void this.sfu?.replaceMic(null);
    this.stopSampling();
    setCallSelf({ mic: 'closed' });
  }

  // --- The camera and the screen (video-and-screen-bubbles.md "The camera", "The screen share") -----------------

  /** Turn the camera on or off. A Viewer has none; audio only pauses it. */
  async toggleCamera(): Promise<void> {
    if (this.camera) {
      this.stopCamera();
      return;
    }
    const sfu = this.sfu;
    if (!sfu || !this.trackToken || !this.input.canSpeak || this.stopped) return;
    if (!callsModeAllows(callSelf().mode, 'video') || callSelf().camera === 'starting') return;
    setCallSelf({ camera: 'starting' });
    const getUserMedia =
      this.input.getUserMedia ??
      ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c));
    let stream: MediaStream;
    try {
      stream = await getUserMedia(CAMERA_CONSTRAINTS);
    } catch {
      if (!this.stopped) setCallSelf({ camera: 'blocked' });
      return;
    }
    if (this.stopped || !callsModeAllows(callSelf().mode, 'video')) {
      for (const t of stream.getTracks()) t.stop();
      if (!this.stopped) setCallSelf({ camera: 'off' });
      return;
    }
    this.camera = stream;
    setCallMedia(SELF_MEDIA_ID, 'video', stream);
    setCallSelf({ camera: 'on' });
    this.cameraAnnounced = true;
    await sfu.publish(stream.getVideoTracks()[0]!, CALL_VIDEO_TRACK_NAME, CAMERA_ENCODINGS);
    this.sendLocator(true);
  }

  private stopCamera(): void {
    if (!this.camera) {
      if (callSelf().camera === 'blocked') setCallSelf({ camera: 'off' });
      return;
    }
    for (const t of this.camera.getTracks()) t.stop();
    this.camera = null;
    void this.sfu?.replaceTrack(CALL_VIDEO_TRACK_NAME, null);
    setCallMedia(SELF_MEDIA_ID, 'video', null);
    setCallSelf({ camera: 'off' });
    this.sendLocator(true);
  }

  /** Share a screen, or stop sharing. An Editor's alone; audio only pauses it. */
  async toggleScreen(): Promise<void> {
    if (this.screen) {
      this.stopScreen();
      return;
    }
    const sfu = this.sfu;
    if (!sfu || !this.trackToken || !this.input.canShare || this.stopped) return;
    if (!callsModeAllows(callSelf().mode, 'screen') || callSelf().screen === 'starting') return;
    setCallSelf({ screen: 'starting' });
    const getDisplayMedia =
      this.input.getDisplayMedia ??
      ((o: DisplayMediaStreamOptions) => navigator.mediaDevices.getDisplayMedia(o));
    let stream: MediaStream;
    try {
      stream = await getDisplayMedia(SCREEN_CONSTRAINTS);
    } catch {
      // Cancelled in the browser's picker, or refused: back to off, never an error.
      if (!this.stopped) setCallSelf({ screen: 'off' });
      return;
    }
    if (this.stopped || !callsModeAllows(callSelf().mode, 'screen')) {
      for (const t of stream.getTracks()) t.stop();
      if (!this.stopped) setCallSelf({ screen: 'off' });
      return;
    }
    const track = stream.getVideoTracks()[0]!;
    // Text stays sharp: the encoder keeps detail and drops frames rather than resolution.
    track.contentHint = 'detail';
    // The browser's own Stop Sharing control ends the track.
    track.addEventListener('ended', () => {
      if (this.screen === stream) this.stopScreen();
    });
    this.screen = stream;
    setCallMedia(SELF_MEDIA_ID, 'screen', stream);
    setCallSelf({ screen: 'on' });
    this.screenAnnounced = true;
    await sfu.publish(track, CALL_SCREEN_TRACK_NAME, SCREEN_ENCODINGS);
    this.sendLocator(true);
  }

  private stopScreen(): void {
    if (!this.screen) return;
    for (const t of this.screen.getTracks()) t.stop();
    this.screen = null;
    void this.sfu?.replaceTrack(CALL_SCREEN_TRACK_NAME, null);
    setCallMedia(SELF_MEDIA_ID, 'screen', null);
    setCallSelf({ screen: 'off' });
    this.sendLocator(true);
  }

  private startSampling(): void {
    if (this.sampler) return;
    this.sampler = setInterval(() => this.sample(), VOICE_SAMPLE_MS);
  }

  private stopSampling(): void {
    if (this.sampler) clearInterval(this.sampler);
    this.sampler = null;
    this.applyVoice(silenceVoice(this.voice, performance.now()));
  }

  private sample(): void {
    if (this.muted) return;
    this.applyVoice(stepVoice(this.voice, this.graph.micLevel(), performance.now()));
  }

  private applyVoice(step: { state: VoiceState; send?: VoiceLevel }): void {
    this.voice = step.state;
    if (step.send === undefined) return;
    this.send({ kind: 'avatar-voice', level: step.send });
    setCallSelf({ level: step.send });
  }

  /** Mute or unmute: muted sends nothing, no audio and no equaliser. */
  toggleMute(): void {
    this.muted = !this.muted;
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = !this.muted;
    if (this.muted) this.applyVoice(silenceVoice(this.voice, performance.now()));
    setCallSelf({ muted: this.muted });
  }

  // Where this browser's media is: the microphone's locator once published, the camera's and the screen's while on.
  private trackSignal(): CallSignal | null {
    const sfu = this.sfu;
    const token = this.trackToken;
    if (!sfu || !token) return null;
    if (!this.published && !this.cameraAnnounced && !this.screenAnnounced) return null;
    return {
      kind: 'call-track',
      track: this.published ? sfu.locator(token) : null,
      ...(this.cameraAnnounced
        ? { video: this.camera ? sfu.locator(token, CALL_VIDEO_TRACK_NAME) : null }
        : {}),
      ...(this.screenAnnounced
        ? { screen: this.screen ? sfu.locator(token, CALL_SCREEN_TRACK_NAME) : null }
        : {}),
    };
  }

  private sendLocator(force = false): void {
    const signal = this.trackSignal();
    if (!signal) return;
    const wait = LOCATOR_RESEND_MS - (performance.now() - this.locatorSentAt);
    if (!force && wait > 0) {
      this.locatorDue ??= setTimeout(() => {
        this.locatorDue = null;
        this.sendLocator(true);
      }, wait);
      return;
    }
    this.locatorSentAt = performance.now();
    this.send(signal);
  }

  // Everything this call tells the room goes through here, so a quiet spell is measured from the last of it.
  private send(signal: CallSignal): void {
    this.input.send(signal);
    if (this.checkDue) clearTimeout(this.checkDue);
    this.checkDue = setTimeout(() => this.check(), CALLS_CHECK_MS);
  }

  // A publishing call that has said nothing for CALLS_CHECK_MS asks the room to read the kill switch, so a silent
  // room still hears of a flip within about that long (calls-kill-switch.md "The room tells its clients"). The room
  // reads at most once per CALLS_CHECK_MS whoever asks; a listener asks nothing, as nothing it hears costs without a
  // publisher.
  private check(): void {
    this.checkDue = null;
    if (this.stopped || (!this.published && !this.camera && !this.screen)) return;
    this.send({ kind: 'calls-check' });
  }

  // --- Raise hand and Do Not Disturb (meeting-rooms-and-stage.md "Raise hand", "Do Not Disturb") ------------------

  /** Raise your hand: a speaking level only, and only as a live stage's audience. */
  raiseHand(): void {
    if (this.stopped || !this.input.canSpeak || callSelf().stage !== 'audience') return;
    if (this.hand.raise(this.zoning.self)) track('Canvas', 'Used', 'RaiseHand');
    this.update(this.scene);
  }

  /** Lower your hand (it also ends being let speak). */
  lowerHand(): void {
    this.hand.lower();
    this.update(this.scene);
  }

  // Someone let your hand speak, or pressed Done: honoured only from an Editor or someone speaking from a stage.
  private onLetSpeak(from: string, on: boolean): void {
    if (this.stopped) return;
    const { walkers, stages = [] } = this.scene;
    this.hand.letSpeak(from, on, mayLetSpeak(from, walkers, callLevels(), stages));
    this.update(this.scene);
  }

  /** Do Not Disturb: nobody's voice or bubbles reach you; you are still heard. */
  setDoNotDisturb(on: boolean): void {
    if (this.dnd === on) return;
    this.dnd = on;
    this.hear();
  }

  /** The canvas moved: re-decide who is heard, how loudly, and whether the microphone stays open. */
  update(scene: CallScene): void {
    if (this.stopped) return;
    this.scene = scene;
    const zoned = zoning(scene.self, scene.walkers, scene.zones ?? []);
    const levels = callLevels();
    const stages = scene.stages ?? [];
    // Walking out of the room you raised it in lowers your hand.
    this.hand.keepIn(zoned.self);
    const selfMay = mayLetSpeakSelf(scene.self, this.level, stages);
    const letter = this.hand.letSpeakBy;
    const hands = {
      let: letSpeakers(callHands(), scene.walkers, levels, stages, callLetByMe(), selfMay),
      self: letter !== null && mayLetSpeak(letter, scene.walkers, levels, stages),
    };
    const stage = staging(scene.self, this.level, scene.walkers, levels, stages, hands);
    this.zoning = stage ? { ...zoned, stage } : zoned;
    const onStage = stage?.self === true;
    if (onStage && !this.onStage) track('Canvas', 'Used', 'StageSpeak');
    this.onStage = onStage;
    // A walker new to the tab learns where this microphone is.
    let arrived = false;
    for (const id of scene.walkers.keys()) if (!this.knownWalkers.has(id)) arrived = true;
    this.knownWalkers = new Set(scene.walkers.keys());
    if (arrived) {
      this.sendLocator();
      this.hand.resend();
    }
    this.keepMicFor(scene.walkers.size > 0);
    const barredBy = hands.self ? null : barringStage(scene.self, this.level, stages);
    let handsUp = 0;
    for (const id of callHands().keys()) if (scene.walkers.has(id) && !hands.let.has(id)) handsUp++;
    setCallSelf({
      someoneNear: someoneHears(scene.self, scene.walkers, this.zoning),
      stage: stagePlace(stage ?? undefined, barredBy !== null),
      barredBy,
      hand: this.hand.state(hands.self),
      handsUp,
    });
    this.hear();
  }

  // Open while somebody else walks the tab; closed after MIC_IDLE_CLOSE_MS alone.
  private keepMicFor(company: boolean): void {
    if (!this.input.canSpeak || !this.published) return;
    if (company) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = null;
      if (!this.mic) void this.openMic();
      return;
    }
    if (!this.mic || this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.closeMic();
    }, MIC_IDLE_CLOSE_MS);
  }

  private hear(): void {
    if (!this.sfu || this.stopped) return;
    const peers = callPeers();
    const candidates = new Map<string, Point>();
    for (const [id, at] of this.scene.walkers) {
      const peer = peers.get(id);
      if (peer && (peer.track || peer.video || peer.screen) && peer.tabId === this.scene.tabId) {
        candidates.set(id, at);
      }
    }
    // Do Not Disturb hears nobody: every subscription closes, bubbles too.
    if (this.dnd) {
      this.heard = NOBODY;
      setCallSelf({ heard: this.heard });
      this.sfu.want([]);
      return;
    }
    this.heard = nextHeard(this.heard, this.scene.self, candidates, this.zoning);
    setCallSelf({ heard: this.heard });
    const wants: SfuWant[] = [];
    for (const id of this.heard) {
      const track = peers.get(id)?.track;
      if (track) wants.push(track);
    }
    const mode = callSelf().mode;
    const maximised = callMaximised();
    const seen = pickSeen({
      self: this.scene.self,
      heard: this.seeable(),
      walkers: this.scene.walkers,
      peers,
      view: this.scene.view ?? null,
      visible: (this.input.pageVisible ?? documentVisible)(),
      allowVideo: callsModeAllows(mode, 'video'),
      allowScreen: callsModeAllows(mode, 'screen'),
      maximised,
    });
    for (const id of seen.video) {
      const video = peers.get(id)?.video;
      const large = maximised?.id === id && maximised.media === 'video';
      if (video) wants.push(large ? { ...video, layer: 'f' } : video);
    }
    for (const id of seen.screen) {
      const screen = peers.get(id)?.screen;
      if (screen) wants.push(screen);
    }
    this.sfu.want(wants);
    this.place();
  }

  // Whose bubbles may be received: everyone heard but a speaker on a stage that does not show its cameras, unless you
  // speak from a stage too (speakers see each other as one room).
  private seeable(): ReadonlySet<string> {
    const stage = this.zoning.stage;
    if (!stage || stage.self || stage.unseen.size === 0) return this.heard;
    return new Set([...this.heard].filter((id) => !stage.unseen.has(id)));
  }

  private place(): void {
    const self = this.scene.self;
    if (!self) return;
    for (const id of this.heard) {
      const at = this.scene.walkers.get(id);
      if (!at) continue;
      const { gain, pan } = placeFor(self, at, togetherWith(id, this.zoning));
      this.graph.place(id, gain, pan);
    }
  }

  private presenceOf(publisherSessionId: string, trackName: string): string | null {
    for (const [id, peer] of callPeers()) {
      const locator =
        trackName === CALL_VIDEO_TRACK_NAME
          ? peer.video
          : trackName === CALL_SCREEN_TRACK_NAME
            ? peer.screen
            : peer.track;
      if (locator?.sessionId === publisherSessionId) return id;
    }
    return null;
  }

  private onTrack(publisherSessionId: string, trackName: string, stream: MediaStream): void {
    const id = this.presenceOf(publisherSessionId, trackName);
    if (!id) return;
    this.owners.set(`${publisherSessionId}|${trackName}`, id);
    const media = MEDIA_OF[trackName];
    if (media) {
      setCallMedia(id, media, stream);
      return;
    }
    this.graph.attach(id, stream);
    this.place();
  }

  private onTrackEnded(publisherSessionId: string, trackName: string): void {
    const key = `${publisherSessionId}|${trackName}`;
    const id = this.owners.get(key) ?? this.presenceOf(publisherSessionId, trackName);
    this.owners.delete(key);
    if (!id) return;
    const media = MEDIA_OF[trackName];
    if (media) setCallMedia(id, media, null);
    else this.graph.detach(id);
  }

  private teardown(): void {
    // Leaving the call lowers your hand, said while the room still listens.
    this.hand.lower();
    this.stopped = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.locatorDue) clearTimeout(this.locatorDue);
    if (this.checkDue) clearTimeout(this.checkDue);
    this.checkDue = null;
    this.unsubscribeTracks();
    this.unsubscribeMode();
    this.unsubscribeMaximised();
    this.unsubscribeLevels();
    this.unsubscribeHands();
    this.unsubscribeLetSpeak();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.stopSampling();
    const announced = this.published || this.cameraAnnounced || this.screenAnnounced;
    if (announced) {
      this.input.send({
        kind: 'call-track',
        track: null,
        ...(this.cameraAnnounced ? { video: null } : {}),
        ...(this.screenAnnounced ? { screen: null } : {}),
      });
    }
    for (const stream of [this.mic, this.camera, this.screen]) {
      for (const t of stream?.getTracks() ?? []) t.stop();
    }
    this.mic = null;
    this.camera = null;
    this.screen = null;
    this.sfu?.close();
    this.sfu = null;
    this.owners.clear();
    resetCallMedia();
    this.graph.close();
  }

  /** Leave Audio: the microphone is released, every subscription closes, the session ends. */
  stop(): void {
    if (this.stopped) return;
    this.teardown();
    setCallSelf({
      phase: 'off',
      mic: 'closed',
      muted: false,
      level: 0,
      heard: new Set(),
      someoneNear: false,
      camera: 'off',
      screen: 'off',
      ...LEFT_STAGE,
    });
  }
}
