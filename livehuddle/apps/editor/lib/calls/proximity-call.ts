// One browser's proximity call (docs/specs/012-collaboration/proximity-audio.md): from Join Audio to Leave Audio, it
// mints a Realtime session through the api, publishes the microphone (call-mic.ts), hears the speakers in earshot at
// their distance and side (call-subscriptions.ts), and closes the microphone while nobody is on your tab. Loaded only
// when somebody presses Join Audio; the canvas feeds it positions through `update`. The calls kill switch
// (docs/specs/016-platform/calls-kill-switch.md "Calls Paused") ends it quietly, from the room's push or a refused
// mint. The camera and a shared screen ride the same session (call-video.ts; docs/specs/012-collaboration/
// video-and-screen-bubbles.md). A stage (meeting-rooms-and-stage.md "The stage") reaches the whole tab; its audience
// raises a hand and may be let speak (call-staging.ts), and Do Not Disturb hears nobody. What the call tells the room
// goes through its beacon (call-beacon.ts).
import { callsModeAllows, type AccessLevel } from '@livehuddle/api-schema';
import { apiCallSession, CallsApiError } from '@/lib/api/calls';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { AudioGraph } from './audio-graph';
import { CallBeacon, trackSignalOf } from './call-beacon';
import type { CallScene, ProximityCallInput } from './call-config';
import { CallMic } from './call-mic';
import { stageScene } from './call-staging';
import { CallReceiver } from './call-receiver';
import { chooseSubscriptions } from './call-subscriptions';
import { CallVideo } from './call-video';
import {
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
  setCallSelf,
  setCallsMode,
} from './calls-store';
import { someoneHears } from './hearing';
import { RaisedHand, stagePlace } from './raised-hand';
import { SfuSession } from './sfu-session';
import { mayLetSpeak } from './stage';
import { zoning, type CallZoning } from './zones';

export {
  CALLS_CHECK_MS,
  CAMERA_CONSTRAINTS,
  CAMERA_ENCODINGS,
  LOCATOR_RESEND_MS,
  MIC_IDLE_CLOSE_MS,
  SCREEN_CONSTRAINTS,
  SCREEN_MAX_BITRATE,
  SCREEN_MAX_FPS,
  type CallScene,
  type CallSignal,
  type ProximityCallInput,
} from './call-config';

// Out of the call: off every stage, hand down.
const LEFT_STAGE = { stage: 'none', barredBy: null, hand: 'down', handsUp: 0 } as const;

const documentVisible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

export class ProximityCall {
  private readonly input: ProximityCallInput;
  private readonly graph: AudioGraph;
  private sfu: SfuSession | null = null;
  private trackToken: string | null = null;
  private readonly mic: CallMic;
  private readonly video: CallVideo;
  private readonly beacon: CallBeacon;
  private heard: ReadonlySet<string> = new Set();
  private scene: CallScene = { tabId: '', self: null, walkers: new Map() };
  // Everyone's room, and who speaks from a stage, worked out once per scene and read by hearing, placing and the mic
  // indicator.
  private zoning: CallZoning = { self: null, of: new Map() };
  // Whether you spoke from a stage at the last scene, so stepping on is counted once.
  private onStage = false;
  private knownWalkers = new Set<string>();
  private stopped = false;
  private readonly receiver: CallReceiver;
  private readonly unsubscribe: (() => void)[];
  private readonly onVisibility = () => this.hear();
  // Your raised hand (meeting-rooms-and-stage.md "Raise hand"), and Do Not Disturb (the same spec's).
  private readonly hand: RaisedHand;
  private dnd = false;

  constructor(input: ProximityCallInput) {
    this.input = input;
    this.graph = new AudioGraph(input.context);
    this.receiver = new CallReceiver(this.graph);
    const sfu = () => this.sfu;
    const trackToken = () => this.trackToken;
    const stopped = () => this.stopped;
    const announce = () => this.beacon.sendLocator(true);
    this.beacon = new CallBeacon({
      send: (signal) => this.input.send(signal),
      trackSignal: () =>
        trackSignalOf(this.sfu, this.trackToken, {
          published: this.mic.published,
          cameraAnnounced: this.video.cameraAnnounced,
          camera: !!this.video.camera,
          screenAnnounced: this.video.screenAnnounced,
          screen: !!this.video.screen,
        }),
      publishing: () =>
        !this.stopped && (this.mic.published || !!this.video.camera || !!this.video.screen),
    });
    this.mic = new CallMic({
      input,
      graph: this.graph,
      sfu,
      trackToken,
      stopped,
      send: (signal) => this.beacon.send(signal),
      announce,
    });
    this.video = new CallVideo({ input, sfu, trackToken, stopped, announce });
    this.hand = new RaisedHand((signal) => this.beacon.send(signal));
    this.unsubscribe = [
      onCallTracks(() => this.hear()),
      onCallsMode(() => this.applyMode()),
      onCallMaximised(() => this.hear()),
      // A peer's level changing may let them speak from the stage they stand on, or stop them.
      onCallLevels(() => this.update(this.scene)),
      // A hand going up, down or let speak changes who speaks and the count a speaker sees.
      onCallHands(() => this.update(this.scene)),
      onLetSpeak((from, on) => this.onLetSpeak(from, on)),
    ];
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
        onTrack: (publisher, trackName, stream) => {
          if (this.receiver.onTrack(publisher, trackName, stream)) this.place();
        },
        onTrackEnded: (publisher, trackName) => this.receiver.onTrackEnded(publisher, trackName),
        onFailed: () => this.fail('connection'),
        onPaused: () => this.pause(),
        onAudioOnly: () => setCallsMode('audio-only'),
      });
      if (this.input.canSpeak && session.canSpeak) await this.mic.open();
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
    if (!callsModeAllows(mode, 'video')) this.video.stopCamera();
    if (!callsModeAllows(mode, 'screen')) this.video.stopScreen();
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
      mic: this.mic.blocked ? 'blocked' : 'closed',
      level: 0,
      camera: 'off',
      screen: 'off',
      ...LEFT_STAGE,
    });
  }

  /** Turn the camera on or off. A Viewer has none; audio only pauses it. */
  toggleCamera(): Promise<void> {
    return this.video.toggleCamera();
  }

  /** Share a screen, or stop sharing. An Editor's alone; audio only pauses it. */
  toggleScreen(): Promise<void> {
    return this.video.toggleScreen();
  }

  /** Mute or unmute: muted sends nothing, no audio and no equaliser. */
  toggleMute(): void {
    this.mic.toggleMute();
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
    // Walking out of the room you raised it in lowers your hand.
    this.hand.keepIn(zoned.self);
    const staged = stageScene(scene, zoned, this.level, this.hand.letSpeakBy);
    this.zoning = staged.zoning;
    const onStage = staged.zoning.stage?.self === true;
    if (onStage && !this.onStage) track('Canvas', 'Used', 'StageSpeak');
    this.onStage = onStage;
    // A walker new to the tab learns where this microphone is.
    let arrived = false;
    for (const id of scene.walkers.keys()) if (!this.knownWalkers.has(id)) arrived = true;
    this.knownWalkers = new Set(scene.walkers.keys());
    if (arrived) {
      this.beacon.sendLocator();
      this.hand.resend();
    }
    this.mic.keepFor(scene.walkers.size > 0);
    setCallSelf({
      someoneNear: someoneHears(scene.self, scene.walkers, this.zoning),
      stage: stagePlace(staged.zoning.stage, staged.barredBy !== null),
      barredBy: staged.barredBy,
      hand: this.hand.state(staged.hands.self),
      handsUp: staged.handsUp,
    });
    this.hear();
  }

  private hear(): void {
    if (!this.sfu || this.stopped) return;
    const chosen = chooseSubscriptions({
      prevHeard: this.heard,
      scene: this.scene,
      zoning: this.zoning,
      peers: callPeers(),
      dnd: this.dnd,
      mode: callSelf().mode,
      maximised: callMaximised(),
      visible: (this.input.pageVisible ?? documentVisible)(),
    });
    this.heard = chosen.heard;
    setCallSelf({ heard: this.heard });
    this.sfu.want(chosen.wants);
    if (!this.dnd) this.place();
  }

  private place(): void {
    this.receiver.place(this.heard, this.scene, this.zoning);
  }

  private teardown(): void {
    // Leaving the call lowers your hand, said while the room still listens.
    this.hand.lower();
    this.stopped = true;
    this.mic.clearIdle();
    this.beacon.clear();
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.mic.stopSampling();
    const announced =
      this.mic.published || this.video.cameraAnnounced || this.video.screenAnnounced;
    if (announced) {
      this.input.send({
        kind: 'call-track',
        track: null,
        ...(this.video.cameraAnnounced ? { video: null } : {}),
        ...(this.video.screenAnnounced ? { screen: null } : {}),
      });
    }
    for (const stream of [this.mic.release(), ...this.video.release()]) {
      for (const t of stream?.getTracks() ?? []) t.stop();
    }
    this.sfu?.close();
    this.sfu = null;
    this.receiver.clear();
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
