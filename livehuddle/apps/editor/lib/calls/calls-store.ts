// Proximity audio's state outside React (docs/specs/012-collaboration/proximity-audio.md; blueprint "Behaviour and
// state"): every peer's talking level and microphone locator, as the room connection hands them over, and this
// browser's own call, which the bottom-right control reads and drives. A module store, like the speech bubbles', so
// the room connection, the canvas and the chrome share it without threading it through the editor's state. Memory
// only: nothing here is written anywhere. Video and screen bubbles (docs/specs/012-collaboration/
// video-and-screen-bubbles.md) add each peer's camera and screen locators, the streams the bubbles draw, and the one
// bubble this viewer has maximised. The stage (meeting-rooms-and-stage.md "The stage") adds each peer's level, as the
// room stamped it on their presence, for who may speak from one; raise hand (the same spec's "Raise hand") adds every
// peer's raised hand and the hands this browser let speak.
import { useSyncExternalStore } from 'react';
import {
  parseAvatarHand,
  parseAvatarVoice,
  parseCallsModeOp,
  parseCallTrack,
  type CallsMode,
  type CallTrackLocator,
  type VoiceLevel,
} from '@livehuddle/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { pruneHands, resetHands, setCallLevels, setHand } from './calls-hands-store';

export {
  callHands,
  callKeys,
  callLetByMe,
  callLevels,
  HANDS_MAX,
  noteLetSpeak,
  noteRoomDropped,
  onCallHands,
  onCallLevels,
  onLetSpeak,
  onRoomDropped,
  receiveLetSpeak,
  setCallLevels,
  useCallHands,
  type CallHand,
  type CallHandsView,
} from './calls-hands-store';
export {
  callMaximised,
  callMedia,
  onCallMaximised,
  onStopShare,
  receiveStopShare,
  resetCallMedia,
  SELF_MEDIA_ID,
  setCallMaximised,
  setCallMedia,
  shareStoppedNotice,
  useCallMaximised,
  useCallMedia,
  type CallMaximised,
  type CallMedia,
  type CallMediaStreams,
} from './calls-media-store';

/** A level not refreshed for this long reads as stopped: a lost stop clears itself. */
export const VOICE_STALE_MS = 8000;
// Peers' levels arrive up to four times a second each; the bars move locally, so the canvas hears of them at most
// this often.
const PEER_NOTIFY_MS = 100;

export type CallPeer = {
  tabId: string | null;
  level: VoiceLevel;
  levelAt: number;
  // The microphone's locator; null while it is not published.
  track: CallTrackLocator | null;
  // The camera's and the shared screen's, null while off.
  video: CallTrackLocator | null;
  screen: CallTrackLocator | null;
};

export type CameraState = 'off' | 'starting' | 'on' | 'blocked';
export type ScreenState = 'off' | 'starting' | 'on';

/** Where you stand towards a live stage (meeting-rooms-and-stage.md): the call strip reads it. */
export type StagePlace = 'none' | 'audience' | 'speaker' | 'barred';
/** Your own hand: down, raised, or let speak. */
export type HandState = 'down' | 'raised' | 'speaking';

export type CallPhase = 'off' | 'joining' | 'live' | 'error';
export type MicState = 'closed' | 'open' | 'blocked';

export type CallSelf = {
  // Calls are on for this Space (capabilities, a shared room, Avatar mode).
  available: boolean;
  // This session may publish (an Editor or a Participant).
  canSpeak: boolean;
  phase: CallPhase;
  mic: MicState;
  muted: boolean;
  // The level you are showing others (0: silent).
  level: VoiceLevel;
  // The presence ids you hear now.
  heard: ReadonlySet<string>;
  // Somebody walks within the hearing radius of you, so they can hear you (the indicator's Live).
  someoneNear: boolean;
  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md): `off` shows Calls Paused.
  mode: CallsMode;
  // This session may share a screen (an Editor).
  canShare: boolean;
  camera: CameraState;
  screen: ScreenState;
  // A local preview (video-and-screen-bubbles.md "Local preview"): whether the browser can capture each kind here (in
  // Avatar mode, for someone who may take part), and the preview's own camera and screen, beside the call's above.
  canPreviewCamera: boolean;
  canPreviewScreen: boolean;
  previewCamera: CameraState;
  previewScreen: ScreenState;
  // The microphone with no call to send it on (proximity-audio.md "Local preview"): whether the browser can capture it
  // here, and the preview's own state, sampled for your own equaliser and sent to nobody.
  canPreviewMic: boolean;
  previewMic: CameraState;
  // Raise hand (meeting-rooms-and-stage.md "Raise hand"): where you stand towards a live stage, the Who Can Speak of
  // a stage you stand on that bars you (for the stage line), your hand, and the hands up on the tab.
  stage: StagePlace;
  barredBy: 'edit' | 'take-part' | null;
  hand: HandState;
  handsUp: number;
};

/** What the control's buttons do; set by the running call, absent while there is none to drive. */
export type CallActions = {
  // Join again after a failure or a pause (walking in joins by itself).
  join: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreen: () => void;
  raiseHand: () => void;
  lowerHand: () => void;
};

const EMPTY_HEARD: ReadonlySet<string> = new Set();
const OFF: CallSelf = {
  available: false,
  canSpeak: false,
  phase: 'off',
  mic: 'closed',
  muted: false,
  level: 0,
  heard: EMPTY_HEARD,
  someoneNear: false,
  mode: 'on',
  canShare: false,
  camera: 'off',
  screen: 'off',
  canPreviewCamera: false,
  canPreviewScreen: false,
  previewCamera: 'off',
  previewScreen: 'off',
  canPreviewMic: false,
  previewMic: 'off',
  stage: 'none',
  barredBy: null,
  hand: 'down',
  handsUp: 0,
};

let peers = new Map<string, CallPeer>();
let peersSnapshot: ReadonlyMap<string, CallPeer> = peers;
let self: CallSelf = OFF;
let actions: CallActions | null = null;
const peerListeners = createListeners();
const selfListeners = createListeners();
const trackListeners = createListeners();
const modeListeners = createListeners();
let peerNotifyDue: ReturnType<typeof setTimeout> | null = null;

const now = () => performance.now();

// React reads a copy taken when it is told, so a render between notifications sees what it was told about.
function publishPeers() {
  peersSnapshot = new Map(peers);
  peerListeners.notify();
}

function notifyPeers(soon = true) {
  if (!soon) {
    if (peerNotifyDue) clearTimeout(peerNotifyDue);
    peerNotifyDue = null;
    publishPeers();
    return;
  }
  peerNotifyDue ??= setTimeout(() => {
    peerNotifyDue = null;
    publishPeers();
  }, PEER_NOTIFY_MS);
}

function peerOf(id: string): CallPeer {
  return (
    peers.get(id) ?? { tabId: null, level: 0, levelAt: 0, track: null, video: null, screen: null }
  );
}

/** A peer's `avatar-voice` or `call-track`, as the room relayed it. Anything malformed is ignored. */
export function receiveCallOp(from: string, op: unknown): void {
  const hand = parseAvatarHand(op);
  if (hand) {
    setHand(
      from,
      hand.raised
        ? {
            tabId: hand.tabId,
            letSpeak: hand.letSpeak ?? null,
            letSpeakKey: hand.letSpeakKey ?? null,
          }
        : null,
    );
    return;
  }
  const voice = parseAvatarVoice(op);
  if (voice) {
    const prev = peerOf(from);
    const at = now();
    peers.set(from, { ...prev, tabId: voice.tabId, level: voice.level, levelAt: at });
    notifyPeers();
    return;
  }
  const track = parseCallTrack(op);
  if (!track) return;
  // An op from before video and screens carries neither: both read as off.
  peers.set(from, {
    ...peerOf(from),
    tabId: track.tabId,
    track: track.track,
    video: track.video ?? null,
    screen: track.screen ?? null,
  });
  notifyPeers(false);
  trackListeners.notify();
}

/**
 * The calls kill switch's mode, from the room's `calls-mode` push (only the room's own, `from: 'system'`), the
 * capabilities or a refusal. A running call hears of it through `onCallsMode` and ends if it no longer may run.
 */
export function setCallsMode(mode: CallsMode): void {
  if (self.mode === mode) return;
  setCallSelf({ mode });
  modeListeners.notify();
}

/** The room's `calls-mode` op; anything else, or from anyone but the room, is ignored. */
export function receiveCallsMode(from: string, op: unknown): void {
  const parsed = from === 'system' ? parseCallsModeOp(op) : null;
  if (parsed) setCallsMode(parsed.mode);
}

/** Subscribe to the switch's mode changing (the running call). */
export function onCallsMode(listener: () => void): () => void {
  return modeListeners.subscribe(listener);
}

/** A peer left the mode: their level, microphone and hand go with their character. */
export function forgetCallPeer(id: string): void {
  setHand(id, null);
  if (!peers.delete(id)) return;
  notifyPeers(false);
  trackListeners.notify();
}

/** Keep only the peers still in the room (the presence list's prune). */
export function pruneCallPeers(present: ReadonlySet<string>): void {
  pruneHands(present);
  let changed = false;
  for (const id of [...peers.keys()]) {
    if (!present.has(id)) {
      peers.delete(id);
      changed = true;
    }
  }
  if (!changed) return;
  notifyPeers(false);
  trackListeners.notify();
}

/** A peer's level as it reads now: 0 once stale. */
export function levelNow(peer: CallPeer | undefined, at = now()): VoiceLevel {
  if (!peer || peer.level === 0) return 0;
  return at - peer.levelAt > VOICE_STALE_MS ? 0 : peer.level;
}

/** Every peer as it stands now (the call reads this; the canvas reads the hook). */
export function callPeers(): ReadonlyMap<string, CallPeer> {
  return peers;
}

const peersForRender = () => peersSnapshot;

export function useCallPeers(): ReadonlyMap<string, CallPeer> {
  return useSyncExternalStore(peerListeners.subscribe, peersForRender, peersForRender);
}

/** Subscribe to locator changes alone (a speaker publishing or stopping), for the subscription manager. */
export function onCallTracks(listener: () => void): () => void {
  return trackListeners.subscribe(listener);
}

export function callSelf(): CallSelf {
  return self;
}

/** Subscribe to this browser's call changing (a hook that selects one small part of it). */
export function onCallSelf(listener: () => void): () => void {
  return selfListeners.subscribe(listener);
}

export function useCallSelf(): CallSelf {
  return useSyncExternalStore(selfListeners.subscribe, callSelf, callSelf);
}

/**
 * Whether your microphone is on, unmuted: open in a live call, or the local preview's on with no call (the strip's
 * Mic and Mic: Only You).
 */
export function micOn(self: CallSelf): boolean {
  if (self.phase === 'live') return self.mic === 'open' && !self.muted;
  return self.previewMic === 'on';
}

const micOnNow = () => micOn(callSelf());

/** `micOn`, re-rendering only when it flips, never on a level change. */
export function useMicOn(): boolean {
  return useSyncExternalStore(selfListeners.subscribe, micOnNow, micOnNow);
}

/** Update this browser's call; a no-op when nothing changed, so a hook may call it every render. */
export function setCallSelf(patch: Partial<CallSelf>): void {
  const next = { ...self, ...patch };
  const same = (Object.keys(next) as (keyof CallSelf)[]).every((k) => next[k] === self[k]);
  if (same) return;
  self = next;
  selfListeners.notify();
}

export function setCallActions(next: CallActions | null): void {
  if (actions === next) return;
  actions = next;
  selfListeners.notify();
}

export function callActions(): CallActions | null {
  return actions;
}

export function useCallActions(): CallActions | null {
  return useSyncExternalStore(selfListeners.subscribe, callActions, callActions);
}

/** The room closed: every peer's level and microphone go. This browser's call is its hook's to end. */
export function resetCallPeers(): void {
  if (peerNotifyDue) clearTimeout(peerNotifyDue);
  peerNotifyDue = null;
  peers = new Map();
  publishPeers();
  trackListeners.notify();
  setCallLevels([]);
  resetHands();
}

/** Back to no call at all (the hook unmounting). */
export function resetCallSelf(): void {
  self = OFF;
  actions = null;
  selfListeners.notify();
}
