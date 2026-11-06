// Raised hands and the levels the stage reads (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand",
// "Share roles"): every peer's hand as the room relayed it, the hands this browser let speak, the let-speaks addressed
// to it, and each peer's level as the room stamped it on their presence. Part of the calls store (calls-store.ts),
// which re-exports it; memory only.
import { useSyncExternalStore } from 'react';
import {
  parseAvatarLetSpeak,
  parseStoredLevel,
  ROOM_MAX_CONNECTIONS,
  type AccessLevel,
} from '@livehuddle/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** A peer's raised hand: the tab it went up on, who let it speak (a presence id, or null), and when it went up. */
export type CallHand = { tabId: string; letSpeak: string | null; at: number };
/** One hand a connection: the room holds at most this many, so the store never holds more. */
export const HANDS_MAX = ROOM_MAX_CONNECTIONS;

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

// --- Raised hands (meeting-rooms-and-stage.md "Raise hand") --------------------------------------------------------

// React reads one snapshot of both, taken when either changes.
function publishHands(): void {
  handsView = { hands, letByMe };
  handListeners.notify();
}

// A hand keeps the time it first went up, so the order is the order hands were raised; a full store takes no more.
export function setHand(id: string, next: Omit<CallHand, 'at'> | null): void {
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
  copy.set(id, { ...next, at: prev?.at ?? performance.now() });
  hands = copy;
  publishHands();
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const copy = new Set(set);
  copy.delete(id);
  return copy;
}

export function pruneHands(present: ReadonlySet<string>): void {
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

/** The room closed: every hand goes, and the ones this browser let speak. */
export function resetHands(): void {
  pruneHands(new Set());
  letByMe = new Set();
}
