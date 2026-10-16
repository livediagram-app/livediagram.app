// The speech bubbles on screen (docs/specs/008-canvas/avatar-mode.md "Speech bubbles", blueprint
// docs/specs/008-canvas/blueprints/avatar-speech.md): your own and everyone else's, in one module store so the
// room connection can hand a peer's message straight to the canvas layer that draws it, without threading it
// through the editor's state (the drag preview's pattern, lib/drag-preview.ts). Ephemeral: nothing here is
// written anywhere, and every bubble removes itself when its flight ends.

import { useSyncExternalStore } from 'react';
import { parseAvatarSay } from '@livediagram/api-schema';
import { debugLog } from '@/lib/debug-log';
import {
  admitBubble,
  bubbleEndsAt,
  flightMs,
  liveBubbles,
  SeenIds,
  type SpeechBubble,
} from '@/lib/avatar-speech';
import { createListeners } from '@/lib/listeners';

let bubbles: SpeechBubble[] = [];
const listeners = createListeners();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let seen = new SeenIds();

const now = () => performance.now();

function emit() {
  listeners.notify();
}

function prune() {
  const at = now();
  const next = liveBubbles(bubbles, at);
  if (next.length === bubbles.length) return;
  bubbles = next;
  emit();
}

// One timer per bubble, re-armed when a bubble is hurried off early.
function schedule(b: SpeechBubble) {
  const existing = timers.get(b.id);
  if (existing) clearTimeout(existing);
  timers.set(
    b.id,
    setTimeout(
      () => {
        timers.delete(b.id);
        prune();
      },
      Math.max(0, bubbleEndsAt(b) - now()),
    ),
  );
}

function add(bubble: SpeechBubble) {
  bubbles = admitBubble(bubbles, bubble, bubble.bornAt);
  for (const b of bubbles) if (b.from === bubble.from) schedule(b);
  emit();
}

/** Your own message, already sent: it rises from `x, y` on `tabId`. */
export function addOwnBubble(say: {
  id: string;
  tabId: string;
  text: string;
  x: number;
  y: number;
}) {
  seen.add(say.id);
  add({
    ...say,
    from: 'self',
    own: true,
    bornAt: now(),
    flightMs: flightMs(say.text),
  });
}

/**
 * A peer's `avatar-say` op, as it came off the wire: parsed field by field, dropped when malformed or already
 * seen. The speaker's name and colour are resolved by the layer that draws it.
 */
export function receivePeerSay(from: string, op: unknown): void {
  const say = parseAvatarSay(op);
  if (!say) {
    debugLog('[avatar-say] drop', { reason: 'parse' });
    return;
  }
  if (!seen.add(say.id)) {
    debugLog('[avatar-say] drop', { reason: 'seen' });
    return;
  }
  debugLog('[avatar-say] receive', { from });
  add({ ...say, from, own: false, bornAt: now(), flightMs: flightMs(say.text) });
}

const snapshot = () => bubbles;
const EMPTY: SpeechBubble[] = [];

/** The bubbles on screen, newest last. */
export function useSpeechBubbles(): SpeechBubble[] {
  return useSyncExternalStore(listeners.subscribe, snapshot, () => EMPTY);
}

/** Empties the store (tests, and leaving a document). */
export function resetSpeechBubbles(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  bubbles = [];
  seen = new SeenIds();
  emit();
}
