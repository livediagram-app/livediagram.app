// Participant identity helpers. The prototype has no auth, so the user
// types (or accepts) a name on the welcome screen and is assigned a
// random colour from a curated palette. This module is the single source
// for that name/colour generation plus presence-status semantics.

export type ParticipantStatus = 'online' | 'away' | 'offline';

// Idle thresholds driving the presence ring colour. Aligned with the
// product's "you should know when a collaborator wandered off" goal:
// 5 minutes is the warning point (away, orange); 60 minutes is the
// "they're probably done" point (offline, red). Both work on the
// presence connection alone — the WS link can still be open while a
// peer's tab is in the background.
export const AWAY_AFTER_MS = 5 * 60 * 1000;
export const OFFLINE_AFTER_MS = 60 * 60 * 1000;

export type Participant = {
  id: string;
  name: string;
  color: string; // hex
  // Derived presence — never stored on the server. Computed locally
  // from `lastActiveAt` against the AWAY / OFFLINE thresholds.
  status: ParticipantStatus;
  // Wall-clock timestamp of this participant's most recent
  // interaction (cursor / selection / op / local input). Drives the
  // status derivation + the "Active X ago" tooltip. Optional so
  // legacy callers that don't track it can still construct a
  // Participant; treated as "now" when omitted.
  lastActiveAt?: number;
  // Server-verified share-code role inside this diagram. Set by the
  // api worker at WS upgrade time; clients can't forge it. Optional
  // because guest / private-diagram sessions don't have a role. The
  // tooltip uses it to tag a peer as 'Editor' / 'Viewer' alongside
  // their name.
  role?: 'edit' | 'view';
};

// Status from idle duration. Used at render time so the ring + label
// stay in sync with the actual time elapsed without having to PUT
// anything per minute.
export function statusFromIdleMs(idleMs: number): ParticipantStatus {
  if (idleMs >= OFFLINE_AFTER_MS) return 'offline';
  if (idleMs >= AWAY_AFTER_MS) return 'away';
  return 'online';
}

const ADJECTIVES = [
  'Curious',
  'Bright',
  'Witty',
  'Calm',
  'Eager',
  'Brave',
  'Clever',
  'Daring',
  'Gentle',
  'Lively',
  'Merry',
  'Nimble',
  'Quick',
  'Quiet',
  'Sunny',
  'Swift',
];

const ANIMALS = [
  'Falcon',
  'Walrus',
  'Otter',
  'Lynx',
  'Heron',
  'Badger',
  'Marlin',
  'Fox',
  'Hawk',
  'Newt',
  'Robin',
  'Seal',
  'Tiger',
  'Toad',
  'Whale',
  'Wolf',
];

// Curated palette of distinguishable, accessible colours. All have enough
// contrast against white text for the avatar initials to stay legible.
const COLORS = [
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

export function randomColor(): string {
  return pick(COLORS);
}

// Pick a colour from the palette that isn't in `taken`. When the
// caller has a `preferred` colour (e.g. the participant's existing
// persisted choice) and it's still free, return that — otherwise
// walk the palette in order and pick the first un-taken slot. When
// every palette colour is taken (room has more participants than
// the palette has colours), fall back to the preferred (accepting
// the collision as the lesser visual evil — a duplicate palette
// colour reads better than an off-palette one).
//
// Used by the editor's room-presence reconciliation to keep every
// live participant on a distinct colour while persistent identity
// records can stay random.
export function nextFreeColor(taken: Set<string>, preferred?: string): string {
  if (preferred && !taken.has(preferred)) return preferred;
  for (const c of COLORS) {
    if (!taken.has(c)) return c;
  }
  return preferred ?? COLORS[0]!;
}

// Up to two characters for the avatar. Single-word names use the first
// two letters; multi-word names use the first letter of the first and
// last word ("Curious Falcon" → "CF").
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Status ring colour for the header avatar. Greens / oranges / reds are
// the conventional presence vocabulary.
export function statusRingColor(status: ParticipantStatus): string {
  switch (status) {
    case 'online':
      return '#22c55e'; // green-500
    case 'away':
      return '#f97316'; // orange-500
    case 'offline':
      return '#ef4444'; // red-500
  }
}

export function statusLabel(status: ParticipantStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'away':
      return 'Away';
    case 'offline':
      return 'Offline';
  }
}
