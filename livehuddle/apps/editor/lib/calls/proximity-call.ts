// One browser's proximity call (docs/specs/012-collaboration/proximity-audio.md): from Join Audio to Leave Audio, it
// mints a Realtime session through the api, publishes the microphone, hears the speakers in earshot at their
// distance and side, detects your own voice for the equaliser, and closes the microphone while nobody is on your
// tab. Loaded only when somebody presses Join Audio; the canvas feeds it positions through `update`. The calls kill
// switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused") ends it quietly, from the room's push or a
// refused mint.
import { callsModeAllows, type CallTrackLocator, type VoiceLevel } from '@livehuddle/api-schema';
import { apiCallSession, CallsApiError, type CallsCaller } from '@/lib/api/calls';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { AudioGraph } from './audio-graph';
import {
  callPeers,
  callSelf,
  onCallsMode,
  onCallTracks,
  setCallSelf,
  setCallsMode,
} from './calls-store';
import { distance, gainAt, HEARING_RADIUS_PX, nextHeard, panAt, type Point } from './hearing';
import { SfuSession } from './sfu-session';
import {
  silenceVoice,
  SILENT,
  stepVoice,
  VOICE_SAMPLE_MS,
  type VoiceState,
} from './voice-detector';

/** Alone on a tab this long, the microphone closes. */
export const MIC_IDLE_CLOSE_MS = 15_000;
/** A speaker's locator goes out again for a new walker at most this often. */
export const LOCATOR_RESEND_MS = 1000;

/** What a call sends over the room: the editor adds the tab. */
export type CallSignal =
  | { kind: 'avatar-voice'; level: VoiceLevel }
  | { kind: 'call-track'; track: CallTrackLocator | null };

/** Where everyone stands, as the canvas sees it: your feet, and every other walker's on your tab. */
export type CallScene = { tabId: string; self: Point | null; walkers: ReadonlyMap<string, Point> };

export type ProximityCallInput = {
  caller: CallsCaller;
  canSpeak: boolean;
  // Made in the Join press, so the browser lets it play.
  context: AudioContext;
  send: (signal: CallSignal) => void;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
};

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

export class ProximityCall {
  private readonly input: ProximityCallInput;
  private readonly graph: AudioGraph;
  private sfu: SfuSession | null = null;
  private trackToken: string | null = null;
  private mic: MediaStream | null = null;
  private micBlocked = false;
  private muted = false;
  private published = false;
  private voice: VoiceState = SILENT;
  private sampler: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private heard: ReadonlySet<string> = new Set();
  private scene: CallScene = { tabId: '', self: null, walkers: new Map() };
  private knownWalkers = new Set<string>();
  private locatorSentAt = -Infinity;
  private locatorDue: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private readonly unsubscribeTracks: () => void;
  private readonly unsubscribeMode: () => void;

  constructor(input: ProximityCallInput) {
    this.input = input;
    this.graph = new AudioGraph(input.context);
    this.unsubscribeTracks = onCallTracks(() => this.hear());
    this.unsubscribeMode = onCallsMode(() => {
      if (!callsModeAllows(callSelf().mode, 'session')) this.pause();
    });
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
        onTrack: (publisher, stream) => this.onTrack(publisher, stream),
        onTrackEnded: (publisher) => {
          const id = this.presenceOf(publisher);
          if (id) this.graph.detach(id);
        },
        onFailed: () => this.fail('connection'),
        onPaused: () => this.pause(),
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
    setCallSelf({ phase: 'error', mic: this.micBlocked ? 'blocked' : 'closed', level: 0 });
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
    this.input.send({ kind: 'avatar-voice', level: step.send });
    setCallSelf({ level: step.send });
  }

  /** Mute or unmute: muted sends nothing, no audio and no equaliser. */
  toggleMute(): void {
    this.muted = !this.muted;
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = !this.muted;
    if (this.muted) this.applyVoice(silenceVoice(this.voice, performance.now()));
    setCallSelf({ muted: this.muted });
  }

  private sendLocator(force = false): void {
    if (!this.sfu || !this.trackToken || !this.published) return;
    const wait = LOCATOR_RESEND_MS - (performance.now() - this.locatorSentAt);
    if (!force && wait > 0) {
      this.locatorDue ??= setTimeout(() => {
        this.locatorDue = null;
        this.sendLocator(true);
      }, wait);
      return;
    }
    this.locatorSentAt = performance.now();
    this.input.send({ kind: 'call-track', track: this.sfu.locator(this.trackToken) });
  }

  /** The canvas moved: re-decide who is heard, how loudly, and whether the microphone stays open. */
  update(scene: CallScene): void {
    if (this.stopped) return;
    this.scene = scene;
    // A walker new to the tab learns where this microphone is.
    let arrived = false;
    for (const id of scene.walkers.keys()) if (!this.knownWalkers.has(id)) arrived = true;
    this.knownWalkers = new Set(scene.walkers.keys());
    if (arrived) this.sendLocator();
    this.keepMicFor(scene.walkers.size > 0);
    const near = scene.self
      ? [...scene.walkers.values()].some((at) => distance(scene.self!, at) <= HEARING_RADIUS_PX)
      : false;
    setCallSelf({ someoneNear: near });
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
      if (peer?.track && peer.tabId === this.scene.tabId) candidates.set(id, at);
    }
    this.heard = nextHeard(this.heard, this.scene.self, candidates);
    setCallSelf({ heard: this.heard });
    const locators: CallTrackLocator[] = [];
    for (const id of this.heard) {
      const track = peers.get(id)?.track;
      if (track) locators.push(track);
    }
    this.sfu.want(locators);
    this.place();
  }

  private place(): void {
    const self = this.scene.self;
    if (!self) return;
    for (const id of this.heard) {
      const at = this.scene.walkers.get(id);
      if (at) this.graph.place(id, gainAt(distance(self, at)), panAt(at.x - self.x));
    }
  }

  private presenceOf(publisherSessionId: string): string | null {
    for (const [id, peer] of callPeers())
      if (peer.track?.sessionId === publisherSessionId) return id;
    return null;
  }

  private onTrack(publisherSessionId: string, stream: MediaStream): void {
    const id = this.presenceOf(publisherSessionId);
    if (!id) return;
    this.graph.attach(id, stream);
    this.place();
  }

  private teardown(): void {
    this.stopped = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.locatorDue) clearTimeout(this.locatorDue);
    this.unsubscribeTracks();
    this.unsubscribeMode();
    this.stopSampling();
    if (this.published) this.input.send({ kind: 'call-track', track: null });
    if (this.mic) for (const t of this.mic.getTracks()) t.stop();
    this.mic = null;
    this.sfu?.close();
    this.sfu = null;
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
    });
  }
}
