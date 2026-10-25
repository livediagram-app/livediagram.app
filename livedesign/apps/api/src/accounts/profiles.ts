// Display names and presence colours (docs/specs/014-identity/auth-and-guest-access.md "Identity display name"), kept by the liveworkspace
// accounts Worker as each person's profile, one for every app (liveworkspace/docs/accounts.md "Profiles").
//
// Reads are batched: a list that names several people (a page of shared designs, a team's members, Home's
// events) asks once for all of them, and the accounts Worker answers up to 100 ids a request. Each answer
// is remembered per isolate for PROFILE_TTL_MS, so the reads on hot paths (a design fetch, every autosave
// that stamps comment authors) cost one accounts call a minute per person rather than one a request. A
// rename made in another isolate, or on liveworkspace.app, shows here within that minute; live presence
// carries it at once, since the room broadcasts what each editor says.
//
// A name is decoration: when the accounts Worker can't be reached, a read answers what it has and logs,
// never failing the request it serves. Without an accounts Worker (a deployment with no sign-in) nobody has
// a stored profile, and the editor keeps its own in the browser.

import { ProfileError, readProfiles, writeProfile, type Profile } from '@liveworkspace/auth-client';
import { PRESENCE_COLOUR_VALUES } from '@liveworkspace/settings';
import type { Env, ParticipantDTO } from '../types';
import { accountsClient, accountsOwner } from './client';

// The colour of someone who has not picked one: the first of the shared presence palette (sky). A
// profile's colour may be unset (liveworkspace/docs/accounts.md "Profiles"), but a cursor, a comment and
// an owner badge always need one.
const DEFAULT_COLOR = PRESENCE_COLOUR_VALUES[0]!;

// How long one isolate trusts a profile it read. Safe range 10 s..5 min: shorter costs accounts calls on
// every autosave, longer leaves a rename unseen in lists for longer.
export const PROFILE_TTL_MS = 60_000;
// Profiles remembered per isolate; the oldest go first. Safe range 100..10 000.
export const PROFILE_CACHE_MAX = 2000;

// One person's profile as livedesign reads it: the participant (null when they have none, or no name), and
// whether they have set anything themselves. An account that never did still has its account name.
export type StoredProfile = {
  participant: ParticipantDTO | null;
  ownSet: boolean;
  // When the accounts Worker first stored something they set: null when they never have.
  createdAt: number | null;
};

const remembered = new Map<string, { profile: StoredProfile; until: number }>();

const NO_PROFILE: StoredProfile = { participant: null, ownSet: false, createdAt: null };

function remember(id: string, profile: StoredProfile, now: number): void {
  remembered.delete(id);
  if (remembered.size >= PROFILE_CACHE_MAX) {
    const oldest = remembered.keys().next().value;
    if (oldest !== undefined) remembered.delete(oldest);
  }
  remembered.set(id, { profile, until: now + PROFILE_TTL_MS });
}

// A profile as livedesign's participant: no name is no participant, and no colour of their own is the
// default colour.
export function participantOf(id: string, profile: Profile | undefined): StoredProfile {
  if (!profile) return NO_PROFILE;
  const ownSet = profile.createdAt !== null;
  return {
    participant: profile.name
      ? {
          id,
          name: profile.name,
          color: profile.color ?? DEFAULT_COLOR,
          createdAt: profile.createdAt ?? profile.updatedAt ?? Date.now(),
        }
      : null,
    ownSet,
    createdAt: profile.createdAt,
  };
}

// The stored profiles of these owners, in one accounts request per 100 not already remembered.
// `strict` throws when the accounts Worker can't be reached, for a caller that must not mistake that for
// "no profile" (the editor seeds a new one on no profile).
export async function readStoredProfiles(
  env: Env,
  ids: Iterable<string>,
  { strict = false }: { strict?: boolean } = {},
): Promise<Map<string, StoredProfile>> {
  const found = new Map<string, StoredProfile>();
  const client = accountsClient(env);
  if (!client) return found;
  const now = Date.now();
  // The accounts Worker's id for each id still to ask about.
  const ask = new Map<string, string>();
  for (const id of new Set(ids)) {
    const known = remembered.get(id);
    if (known && known.until > now) {
      found.set(id, known.profile);
      continue;
    }
    const owner = accountsOwner(id);
    if (owner) ask.set(owner, id);
    else found.set(id, NO_PROFILE);
  }
  if (ask.size === 0) return found;
  try {
    const profiles = await readProfiles(client, [...ask.keys()]);
    const byOwner = new Map(profiles.map((p) => [p.id, p]));
    for (const [owner, id] of ask) {
      const profile = participantOf(id, byOwner.get(owner));
      remember(id, profile, now);
      found.set(id, profile);
    }
  } catch (err) {
    if (strict) throw err;
    console.warn('[profiles] read_failed', {
      ids: ask.size,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
  return found;
}

// The participants among these owners: those with a name. One batched read (above).
export async function readParticipants(
  env: Env,
  ids: Iterable<string>,
): Promise<Map<string, ParticipantDTO>> {
  const profiles = await readStoredProfiles(env, ids);
  const participants = new Map<string, ParticipantDTO>();
  for (const [id, profile] of profiles) {
    if (profile.participant) participants.set(id, profile.participant);
  }
  return participants;
}

export async function getParticipant(env: Env, id: string): Promise<ParticipantDTO | null> {
  return (await readParticipants(env, [id])).get(id) ?? null;
}

// One person's stored profile. Throws when the accounts Worker can't be reached.
export async function getStoredProfile(env: Env, id: string): Promise<StoredProfile> {
  return (await readStoredProfiles(env, [id], { strict: true })).get(id) ?? NO_PROFILE;
}

// Sets someone's own name and colour, writing only what changed: a signed-in person whose editor sends the
// account's own name leaves it unset, so their account name (and any later rename) keeps showing. Answers
// the participant as it now is, or null when there is no accounts Worker to keep it. Throws a ProfileError
// when the accounts Worker refuses it.
export async function writeParticipant(
  env: Env,
  id: string,
  next: { name: string; color: string },
): Promise<StoredProfile | null> {
  const client = accountsClient(env);
  const owner = accountsOwner(id);
  if (!client || !owner) return null;
  const current = await getStoredProfile(env, id);
  const patch: { name?: string; color?: string } = {};
  if (next.name !== current.participant?.name) patch.name = next.name;
  if (!current.ownSet || next.color !== current.participant?.color) patch.color = next.color;
  if (patch.name === undefined && patch.color === undefined) return current;
  const profile = participantOf(id, await writeProfile(client, { owner, ...patch }));
  remember(id, profile, Date.now());
  return profile;
}

// Forgets what this isolate remembers of these people, after their profile changed elsewhere.
export function forgetProfiles(ids: Iterable<string>): void {
  for (const id of ids) remembered.delete(id);
}

export { ProfileError };

// Test seam: forget every remembered profile.
export function __forgetProfiles(): void {
  remembered.clear();
}
