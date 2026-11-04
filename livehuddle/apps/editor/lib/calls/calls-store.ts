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
  parseAvatarLetSpeak,
  parseAvatarVoice,
  parseCallsModeOp,
  parseCallTrack,
  parseStoredLevel,
  ROOM_MAX_CONNECTIONS,
  type AccessLevel,
  type CallsMode,
  type CallTrackLocator,
  type VoiceLevel,
} from '@livehuddle/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

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

/** What a bubble shows. */
export type CallMedia = 'video' | 'screen';
export type CameraState = 'off' | 'starting' | 'on' | 'blocked';
export type ScreenState = 'off' | 'starting' | 'on';
/** Your own bubbles are keyed by this in the media store; everyone else's by presence id. */
export const SELF_MEDIA_ID = 'self';
/** The one bubble this viewer has opened large. */
export type CallMaximised = { id: string; media: CallMedia };
export type CallMediaStreams = { readonly video?: MediaStream; readonly screen?: MediaStream };

/** A peer's raised hand: the tab it went up on, who let it speak (a presence id, or null), and when it went up. */
export type CallHand = { tabId: string; letSpeak: string | null; at: number };
/** One hand a connection: the room holds at most this many, so the store never holds more. */
export const HANDS_MAX = ROOM_MAX_CONNECTIONS;
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
  // Raise hand (meeting-rooms-and-stage.md "Raise hand"): where you stand towards a live stage, the Who Can Speak of
  // a stage you stand on that bars you (for the stage line), your hand, and the hands up on the tab.
  stage: StagePlace;
  barredBy: 'edit' | 'take-part' | null;
  hand: HandState;
  handsUp: number;
};

/** What the control's buttons do; set by the running call, absent while there is none to drive. */
export type CallActions = {
  join: () => void;
  leave: () => void;
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
const mediaListeners = createListeners();
const maximisedListeners = createListeners();
let media: ReadonlyMap<string, CallMediaStreams> = new Map();
let maximised: CallMaximised | null = null;
let peerNotifyDue: ReturnType<typeof setTimeout> | null = null;
let levels: ReadonlyMap<string, AccessLevel> = new Map();
const levelListeners = createListeners();
let hands: ReadonlyMap<string, CallHand> = new Map();
const handListeners = createListeners();
let letByMe: ReadonlySet<string> = new Set();
/** What the canvas draws hands from: every raised hand, and the ones this browser let speak. */
export type CallHandsView = {
  readonly hands: ReadonlyMap<string, CallHand>;
  readonly letByMe: ReadonlySet<string>;
};
let handsView: CallHandsView = { hands, letByMe };
type LetSpeakListener = (from: string, on: boolean) => void;
const letSpeakListeners = new Set<LetSpeakListener>();

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
    setHand(from, hand.raised ? { tabId: hand.tabId, letSpeak: hand.letSpeak ?? null } : null);
    return;
  }
  const voice = parseAvatarVoice(op);
  if (voice) {
    peers.set(from, { ...peerOf(from), tabId: voice.tabId, level: voice.level, levelAt: now() });
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

export function useCallSelf(): CallSelf {
  return useSyncExternalStore(selfListeners.subscribe, callSelf, callSelf);
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
  pruneHands(new Set());
  letByMe = new Set();
}

// --- Raised hands (meeting-rooms-and-stage.md "Raise hand") --------------------------------------------------------

// React reads one snapshot of both, taken when either changes.
function publishHands(): void {
  handsView = { hands, letByMe };
  handListeners.notify();
}

// A hand keeps the time it first went up, so the order is the order hands were raised; a full store takes no more.
function setHand(id: string, next: Omit<CallHand, 'at'> | null): void {
  const prev = hands.get(id);
  if (!next) {
    if (!prev) return;
    const copy = new Map(hands);
    copy.delete(id);
    hands = copy;
    letByMe = withoutId(letByMe, id);
    publishHands();
    return;
  }
  if (prev && prev.tabId === next.tabId && prev.letSpeak === next.letSpeak) return;
  if (!prev && hands.size >= HANDS_MAX) return;
  const copy = new Map(hands);
  copy.set(id, { ...next, at: prev?.at ?? now() });
  hands = copy;
  publishHands();
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const copy = new Set(set);
  copy.delete(id);
  return copy;
}

function pruneHands(present: ReadonlySet<string>): void {
  const gone = [...hands.keys()].filter((id) => !present.has(id));
  if (gone.length === 0) return;
  const copy = new Map(hands);
  for (const id of gone) {
    copy.delete(id);
    letByMe = withoutId(letByMe, id);
  }
  hands = copy;
  publishHands();
}

/** Every peer's raised hand, by presence id (the call reads this). */
export function callHands(): ReadonlyMap<string, CallHand> {
  return hands;
}

const handsForRender = () => handsView;

export function useCallHands(): CallHandsView {
  return useSyncExternalStore(handListeners.subscribe, handsForRender, handsForRender);
}

/** Subscribe to a hand going up, down or being let speak (the running call recounts). */
export function onCallHands(listener: () => void): () => void {
  return handListeners.subscribe(listener);
}

/**
 * An addressed `avatar-let-speak` reached this browser: someone let your hand speak, or pressed Done. Handed to the
 * running call, which checks the sender may; malformed, it is ignored.
 */
export function receiveLetSpeak(from: string, op: unknown): void {
  const parsed = parseAvatarLetSpeak(op);
  if (!parsed) return;
  for (const listener of letSpeakListeners) listener(from, parsed.on);
}

/** Subscribe to let-speaks addressed to you (the running call). */
export function onLetSpeak(listener: LetSpeakListener): () => void {
  letSpeakListeners.add(listener);
  return () => letSpeakListeners.delete(listener);
}

/**
 * You let `id` speak, or pressed Done: kept because a browser never learns its own presence id, so it cannot see
 * itself in their hand's `letSpeak`. Their hand going down forgets it.
 */
export function noteLetSpeak(id: string, on: boolean): void {
  if (on === letByMe.has(id)) return;
  if (on) letByMe = new Set([...letByMe, id]);
  else letByMe = withoutId(letByMe, id);
  publishHands();
}

/** The hands this browser let speak. */
export function callLetByMe(): ReadonlySet<string> {
  return letByMe;
}

// --- Levels, for the stage (meeting-rooms-and-stage.md "Share roles") ---------------------------------------------

/**
 * Every peer's level from the room's presence list: the `role` the room stamps from each grant, never one a browser
 * claims. A missing or unknown one is a Viewer's. Listeners hear only when a level changed.
 */
export function setCallLevels(participants: readonly { id: string; role?: unknown }[]): void {
  const next = new Map<string, AccessLevel>();
  for (const p of participants) next.set(p.id, parseStoredLevel(p.role));
  if (next.size === levels.size && [...next].every(([id, level]) => levels.get(id) === level))
    return;
  levels = next;
  levelListeners.notify();
}

/** Each peer's level by presence id (the call reads this when it works out the stage). */
export function callLevels(): ReadonlyMap<string, AccessLevel> {
  return levels;
}

/** Subscribe to a peer's level changing (the running call re-stages). */
export function onCallLevels(listener: () => void): () => void {
  return levelListeners.subscribe(listener);
}

// --- The bubbles' streams and the maximised one (docs/specs/012-collaboration/video-and-screen-bubbles.md) ---------

/** Show (or with null, stop showing) a stream in someone's bubble; `SELF_MEDIA_ID` for your own. */
export function setCallMedia(id: string, kind: CallMedia, stream: MediaStream | null): void {
  const prev = media.get(id) ?? {};
  if ((prev[kind] ?? null) === stream) return;
  const next = new Map(media);
  const streams: CallMediaStreams = { ...prev, [kind]: stream ?? undefined };
  if (!streams.video && !streams.screen) next.delete(id);
  else next.set(id, streams);
  media = next;
  mediaListeners.notify();
  // A bubble that is no longer received cannot stay maximised.
  if (!stream && maximised?.id === id && maximised.media === kind) setCallMaximised(null);
}

/** Every bubble's streams, by presence id. */
export function callMedia(): ReadonlyMap<string, CallMediaStreams> {
  return media;
}

export function useCallMedia(): ReadonlyMap<string, CallMediaStreams> {
  return useSyncExternalStore(mediaListeners.subscribe, callMedia, callMedia);
}

/** Open a bubble large, or with null restore it. Only one at a time. */
export function setCallMaximised(next: CallMaximised | null): void {
  if (maximised?.id === next?.id && maximised?.media === next?.media) return;
  maximised = next;
  maximisedListeners.notify();
}

export function callMaximised(): CallMaximised | null {
  return maximised;
}

export function useCallMaximised(): CallMaximised | null {
  return useSyncExternalStore(maximisedListeners.subscribe, callMaximised, callMaximised);
}

/** Subscribe to a maximise or a restore (the running call switches that camera's layer). */
export function onCallMaximised(listener: () => void): () => void {
  return maximisedListeners.subscribe(listener);
}

/** Every bubble goes: the call ended. */
export function resetCallMedia(): void {
  maximised = null;
  maximisedListeners.notify();
  if (media.size === 0) return;
  media = new Map();
  mediaListeners.notify();
}

/** Back to no call at all (the hook unmounting). */
export function resetCallSelf(): void {
  self = OFF;
  actions = null;
  selfListeners.notify();
}
