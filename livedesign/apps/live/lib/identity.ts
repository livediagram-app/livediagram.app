// Participant identity helpers. The prototype has no auth, so the user
// types (or accepts) a name on the welcome screen and is assigned a
// random colour from a curated palette. This module is the single source
// for that name/colour generation plus presence-status semantics.

import { fnv1aString } from '@livedesign/design';
import { PRESENCE_COLOUR_VALUES } from '@liveworkspace/settings';
import { randomPick } from '@liveworkspace/workbench/lib/random';
import type { AccessLevel } from '@livedesign/api-schema';

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
  // This browser's key (lib/local-identity.ts `ensureCollabKey`): stable across reconnects and shared by every tab in
  // the browser, unlike `id`, which is our owner id for ourselves and a per-socket presence id for a peer. Optional so
  // a peer whose hello carried none still renders. Read through `participantKey`.
  key?: string;
  name: string;
  color: string; // hex
  // Derived presence — never stored on the server. Computed locally
  // from `lastActiveAt` against the AWAY / OFFLINE thresholds.
  status: ParticipantStatus;
  // Wall-clock timestamp of this participant's most recent
  // interaction (cursor / selection / op / local input). Drives the
  // status derivation + the "Active X ago" hover card. Optional so
  // legacy callers that don't track it can still construct a
  // Participant; treated as "now" when omitted.
  lastActiveAt?: number;
  // Server-verified share-code role inside this design. Set by the
  // api worker at WS upgrade time; clients can't forge it. Optional
  // because guest / private-design sessions don't have a role. The
  // hover card uses it to tag a peer as 'Editor' / 'Viewer' alongside
  // their name.
  role?: AccessLevel;
  // Their Google picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"), as the room relayed it: absent for
  // guests, for anyone who turned Show My Google Picture off, and on a guest's or link visitor's screen. Our own
  // entry carries our picture whatever the switch says: it is our screen.
  picture?: string;
  // What their agent is doing on this tab (docs/specs/024-agents/agent-presence.md "In the editor"): the status
  // line an agent set, on its own row, shown in the hover card, the Collaborators row and the accessible name.
  statusLine?: string;
  // A row standing for an agent, "{owner}'s Agent", on the last tab it read or changed: never counted as a person,
  // never followed.
  agent?: true;
};

// This participant's browser key, falling back to `id` for a peer whose client published none. Every tab in a browser
// shares the key, so presence collapses on it (lib/presence-rows.ts, docs/specs/012-collaboration/
// collaborator-enhancements.md "One person, one avatar").
export function participantKey(participant: Participant): string {
  return participant.key ?? participant.id;
}

// What a screen reader hears for an avatar: "Webber (Online)", and their agent's status line after it
// (docs/specs/024-agents/blueprints/agent-presence.md "Accessibility").
export function participantAccessibleName(participant: Participant): string {
  const base = `${participant.name} (${statusLabel(participant.status)})`;
  return participant.statusLine ? `${base}, ${participant.statusLine}` : base;
}

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

// The presence palette every liveworkspace app offers (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"), so
// a colour picked in one app is a named swatch in all of them. White initials fall below AA on every
// one of them; dark mode paints their deeper shade (identity-fill.ts) instead.
export const PARTICIPANT_COLORS = PRESENCE_COLOUR_VALUES;

function pick<T>(arr: readonly T[]): T {
  // Non-empty by construction (the catalogues above), so the bang is safe.
  return randomPick(arr)!;
}

export function randomName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

export function randomColor(): string {
  return pick(PARTICIPANT_COLORS);
}

// Deterministic palette pick for identities that have no persisted
// colour of their own (e.g. team member rows, docs/specs/013-workspace/teams.md, which are
// keyed by email rather than a participant record). Same key, same
// colour, every render and every device — FNV-1a over the key, mapped
// onto the curated palette above.
export function colorForKey(key: string): string {
  // `| 0` reads the hash as signed, the way colours have always been picked, so no key changes colour.
  return PARTICIPANT_COLORS[Math.abs(fnv1aString(key) | 0) % PARTICIPANT_COLORS.length]!;
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
  for (const c of PARTICIPANT_COLORS) {
    if (!taken.has(c)) return c;
  }
  return preferred ?? PARTICIPANT_COLORS[0]!;
}

// Up to two characters for the avatar: shared with the headless export, so
// it lives in @livedesign/design (names.ts).
export { initialsOf } from '@livedesign/design';

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
