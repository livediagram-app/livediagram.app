// Participant identity helpers. The prototype has no auth, so the user
// types (or accepts) a name on the welcome screen and is assigned a
// random colour from a curated palette. This module is the single source
// for that name/colour generation plus presence-status semantics.

import { colorForKey } from '@livediagram/api-schema';
import { PRESENCE_COLOUR_VALUES } from '@liveworkspace/settings';
import { randomPick } from './random';
import type { AccessLevel } from '@livediagram/api-schema';

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
  // The id this person writes into the DOCUMENT for anything recorded
  // per participant — a done check's mark, an estimate, a temperature
  // (docs/specs/012-collaboration/participant-responses.md). Separate from `id` because `id` cannot do that job: for
  // ourselves it is the owner id, which must never be published, and for
  // a peer it is the room's per-socket presence id, which changes on
  // every reconnect and matches nothing that was saved.
  //
  // Optional so a peer on an older client (whose hello carried no key)
  // still renders in the roster — they simply match no saved answer,
  // which is the behaviour before this existed. Read through
  // `participantKey` rather than directly, so the fallback lives in one
  // place.
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
  // Server-verified share-code role inside this document. Set by the
  // api worker at WS upgrade time; clients can't forge it. Optional
  // because guest / private-document sessions don't have a role. The
  // hover card uses it to tag a peer as 'Editor' / 'Viewer' alongside
  // their name.
  role?: AccessLevel;
  // What their agent is doing on this tab (docs/specs/024-agents/agent-presence.md "In the editor"): the status
  // line an agent set, shown in the hover card, the Collaborators row and the accessible name.
  statusLine?: string;
  // A row standing for an agent whose owner is not on the tab: never counted as a person, never followed.
  agent?: true;
};

// How this participant is recorded in the document (docs/specs/012-collaboration/participant-responses.md). Falls back
// to `id` for a peer whose client is too old to publish a key: they then
// match no saved answer, which is no worse than before the key existed and
// is a great deal better than crashing the join on an undefined.
export function participantKey(participant: Participant): string {
  return participant.key ?? participant.id;
}

// One row per person, by `participantKey`: the same person in two tabs (or
// re-joined on a new socket) shares a key but not an id, so deduping on `id`
// counted them twice (docs/specs/012-collaboration/participant-responses.md).
// The first row for a key wins, so ourselves (listed first) stays ourselves.
export function uniqueParticipants(participants: readonly Participant[]): Participant[] {
  const seen = new Set<string>();
  return participants.filter((p) => {
    const key = participantKey(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Ourselves as a row of the room, carrying our own level as every peer's row carries theirs (the room stamps a
// peer's server-verified role on presence; our own row is local and had none). Without it a Viewer's own screen
// counted the Viewer among those who can answer, so its Done check waited on it forever.
export function selfInRoom(self: Participant, level: AccessLevel): Participant {
  return { ...self, role: level };
}

// The keys of everyone in the room who CAN answer a per-participant card
// (docs/specs/012-collaboration/participant-responses.md "Who counts"): one per
// person, leaving out view-link guests (who can't write) and agent rows (never
// counted as a person). What a Done check waits on and an Estimate counts.
export function answeringKeys(participants: readonly Participant[]): string[] {
  return uniqueParticipants(participants)
    .filter((p) => p.role !== 'view' && !p.agent)
    .map(participantKey);
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

// The palette is liveworkspace's one presence palette (@liveworkspace/settings), the same in every
// app. The deterministic pick lives in @livediagram/api-schema, which the api worker shares: it fills
// in the colour of a profile that never set one.
export { colorForKey };

function pick<T>(arr: readonly T[]): T {
  // Non-empty by construction (the catalogues above), so the bang is safe.
  return randomPick(arr)!;
}

export function randomName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

export function randomColor(): string {
  return pick(PRESENCE_COLOUR_VALUES);
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
  for (const c of PRESENCE_COLOUR_VALUES) {
    if (!taken.has(c)) return c;
  }
  return preferred ?? PRESENCE_COLOUR_VALUES[0]!;
}

// Up to two characters for the avatar: shared with the headless export, so
// it lives in @livediagram/document (names.ts).
export { initialsOf } from '@livediagram/document';

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
