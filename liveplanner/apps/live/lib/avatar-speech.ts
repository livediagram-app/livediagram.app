// Speech bubbles in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Speech bubbles", blueprint
// docs/specs/008-canvas/blueprints/avatar-speech.md): the pure half. How long a message flies, where a bubble is
// at a moment of its flight, which bubbles stay on screen, and where above a character one starts. No React, no
// DOM, so every rule here is unit-tested.

import { clampSayText, countWords, sayOneLine, withinSayLimits } from '@liveplanner/api-schema';
import { AVATAR_HEIGHT, type AvatarPoint } from '@/lib/avatar-walk';

// Flight time: 4 s up to two words, 0.15 s more for each further word, at most 10 s.
const SPEECH_BASE_MS = 4000;
const SPEECH_PER_WORD_MS = 150;
const SPEECH_FREE_WORDS = 2;
export const SPEECH_MAX_MS = 10_000;
// The bubble rises at a steady pace, in screen px (it is drawn at reading size whatever the zoom).
export const SPEECH_RISE_PX_PER_S = 18;
// "Swaying gently" (blueprint D108).
export const SPEECH_SWAY_PX = 6;
export const SPEECH_SWAY_PERIOD_MS = 2400;
// It fades over the last third of its flight.
export const SPEECH_FADE_FRACTION = 1 / 3;
// The pop on sending and the tail letting go (D109).
export const SPEECH_POP_MS = 220;
const SPEECH_TAIL_FADE_MS = 400;
const SPEECH_POP_FROM = 0.6;
// Between one message and the next.
export const SPEECH_COOLDOWN_MS = 1500;
// At most this many of one person's bubbles on screen; a further one hurries the oldest away (D110).
const SPEECH_MAX_PER_PERSON = 3;
export const SPEECH_OVERFLOW_FADE_MS = 300;
const SPEECH_SEEN_IDS_CAP = 200;
// Canvas px between the top of the head and the bubble's tail, at size scale 1 (D111).
const SPEECH_HEAD_GAP = 8;
// The word count past which the composer shows its counter.
export const SPEECH_COUNTER_FROM_WORDS = 40;

export type SpeechBubble = {
  id: string;
  // Presence id of the speaker; 'self' for your own.
  from: string;
  own: boolean;
  text: string;
  tabId: string;
  // The canvas point the bubble rises from.
  x: number;
  y: number;
  bornAt: number;
  flightMs: number;
  // Set when a newer bubble from the same person pushed this one off screen early.
  leavingAt?: number;
};

/**
 * A draft after an edit (docs/specs/008-canvas/avatar-mode.md "Typing a message"): newlines become spaces; typing
 * past either limit is refused (the previous draft stands, so nothing written vanishes); text put in at once (a
 * paste, a drop, an autocorrection, composed text) is clamped.
 */
export function nextDraft(prev: string, value: string, atOnce: boolean): string {
  const cleaned = sayOneLine(value);
  if (withinSayLimits(cleaned)) return cleaned;
  return atOnce ? clampSayText(cleaned) : prev;
}

/** How long a message stays up, from its length. */
export function flightMs(text: string): number {
  const extra = Math.max(0, countWords(text) - SPEECH_FREE_WORDS);
  return Math.min(SPEECH_MAX_MS, SPEECH_BASE_MS + extra * SPEECH_PER_WORD_MS);
}

/** When a bubble is gone: its flight's end, or sooner if it was hurried off. */
export function bubbleEndsAt(b: SpeechBubble): number {
  const natural = b.bornAt + b.flightMs;
  return b.leavingAt === undefined
    ? natural
    : Math.min(natural, b.leavingAt + SPEECH_OVERFLOW_FADE_MS);
}

type BubbleMotion = {
  // Screen px up from the start point.
  rise: number;
  // Screen px either side.
  sway: number;
  opacity: number;
  // The pop: from SPEECH_POP_FROM to 1.
  scale: number;
  // The tail's opacity: it lets go of the head.
  tail: number;
};

// Ease-out-back: overshoots a little, which is what makes it read as a pop.
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Where a bubble is, `elapsed` ms into a flight of `flight` ms. Under reduced motion it holds still and fades. */
export function bubbleMotion(
  elapsed: number,
  flight: number,
  reduced: boolean,
  leavingFor?: number,
): BubbleMotion {
  const t = Math.max(0, elapsed);
  const fadeFrom = flight * (1 - SPEECH_FADE_FRACTION);
  let opacity = t <= fadeFrom ? 1 : clamp01(1 - (t - fadeFrom) / (flight - fadeFrom));
  if (leavingFor !== undefined)
    opacity = Math.min(opacity, clamp01(1 - leavingFor / SPEECH_OVERFLOW_FADE_MS));
  return {
    rise: reduced ? 0 : (t / 1000) * SPEECH_RISE_PX_PER_S,
    sway: reduced ? 0 : SPEECH_SWAY_PX * Math.sin((2 * Math.PI * t) / SPEECH_SWAY_PERIOD_MS),
    opacity,
    scale: reduced
      ? 1
      : SPEECH_POP_FROM + (1 - SPEECH_POP_FROM) * easeOutBack(clamp01(t / SPEECH_POP_MS)),
    tail: clamp01(1 - t / SPEECH_TAIL_FADE_MS),
  };
}

/**
 * The bubbles with `bubble` added. When its speaker already has SPEECH_MAX_PER_PERSON still flying, the oldest
 * of theirs not already leaving is hurried off from `now`.
 */
export function admitBubble(
  list: readonly SpeechBubble[],
  bubble: SpeechBubble,
  now: number,
): SpeechBubble[] {
  const theirs = list.filter((b) => b.from === bubble.from && b.leavingAt === undefined);
  const hurry = theirs.length >= SPEECH_MAX_PER_PERSON ? theirs[0]!.id : null;
  const next = list.map((b) => (b.id === hurry ? { ...b, leavingAt: now } : b));
  next.push(bubble);
  return next;
}

/** The bubbles still flying at `now`. */
export function liveBubbles(list: readonly SpeechBubble[], now: number): SpeechBubble[] {
  return list.filter((b) => bubbleEndsAt(b) > now);
}

/** The canvas point a character's bubble starts from: just above its head, given its feet and size scale. */
export function headPoint(feet: AvatarPoint, scale: number): AvatarPoint {
  return { x: feet.x, y: feet.y - (AVATAR_HEIGHT + SPEECH_HEAD_GAP) * scale };
}

/** Bubble ids already drawn, so a repeated op is dropped; remembers the last SPEECH_SEEN_IDS_CAP. */
export class SeenIds {
  private readonly ids = new Set<string>();
  private readonly cap: number;
  constructor(cap = SPEECH_SEEN_IDS_CAP) {
    this.cap = cap;
  }
  /** Records `id`, answering whether it was new. */
  add(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.cap) this.ids.delete(this.ids.values().next().value!);
    return true;
  }
}
