// Proximity audio's state outside React (docs/specs/012-collaboration/proximity-audio.md; blueprint "Behaviour and
// state"): every peer's talking level and microphone locator, as the room connection hands them over, and this
// browser's own call, which the bottom-right control reads and drives. A module store, like the speech bubbles', so
// the room connection, the canvas and the chrome share it without threading it through the editor's state. Memory
// only: nothing here is written anywhere.
import { useSyncExternalStore } from 'react';
import {
  parseAvatarVoice,
  parseCallTrack,
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
  track: CallTrackLocator | null;
};

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
};

/** What the control's buttons do; set by the running call, absent while there is none to drive. */
export type CallActions = {
  join: () => void;
  leave: () => void;
  toggleMute: () => void;
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
};

let peers = new Map<string, CallPeer>();
let peersSnapshot: ReadonlyMap<string, CallPeer> = peers;
let self: CallSelf = OFF;
let actions: CallActions | null = null;
const peerListeners = createListeners();
const selfListeners = createListeners();
const trackListeners = createListeners();
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
  return peers.get(id) ?? { tabId: null, level: 0, levelAt: 0, track: null };
}

/** A peer's `avatar-voice` or `call-track`, as the room relayed it. Anything malformed is ignored. */
export function receiveCallOp(from: string, op: unknown): void {
  const voice = parseAvatarVoice(op);
  if (voice) {
    peers.set(from, { ...peerOf(from), tabId: voice.tabId, level: voice.level, levelAt: now() });
    notifyPeers();
    return;
  }
  const track = parseCallTrack(op);
  if (!track) return;
  peers.set(from, { ...peerOf(from), tabId: track.tabId, track: track.track });
  notifyPeers(false);
  trackListeners.notify();
}

/** A peer left the mode: their level and microphone go with their character. */
export function forgetCallPeer(id: string): void {
  if (!peers.delete(id)) return;
  notifyPeers(false);
  trackListeners.notify();
}

/** Keep only the peers still in the room (the presence list's prune). */
export function pruneCallPeers(present: ReadonlySet<string>): void {
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
}

/** Back to no call at all (the hook unmounting). */
export function resetCallSelf(): void {
  self = OFF;
  actions = null;
  selfListeners.notify();
}
