// A person's display name and presence colour (docs/specs/014-identity/auth-and-guest-access.md "Identity
// display name"), kept by the liveworkspace accounts Worker as their profile, one for every app
// (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"). liveplanner keeps no copy: every read asks the accounts Worker, a list of people in one
// call (`readProfiles` takes up to 100 ids a request and splits a longer list itself).
//
// Reads are remembered per isolate for PROFILE_CACHE_MS, so a run of autosaves, each needing the writer's
// name for any comment it adds, costs one request a minute rather than one a save. Writing your own
// profile replaces the remembered copy at once; anyone else's change shows within that minute.
//
// Without the accounts Worker (a deployment with sign-in off) nothing is stored: a read finds no one and
// a write is answered but kept nowhere, so each browser shows the name and colour it keeps itself. A
// guest who signs in has their name and colour moved to the account by the accounts Worker itself.

import {
  readProfiles,
  writeProfile,
  type ClientCredentials,
  type Profile,
} from '@liveworkspace/auth-client';
import { PRESENCE_COLOUR_VALUES } from '@liveworkspace/settings';
import { accountCredentials } from '../auth/accounts';
import type { Env, ParticipantDTO } from '../types';
import { accountsOwnerOf } from './owner';
import { profilePictureOf } from '@liveworkspace/sites/picture';

// The colour shown for someone whose profile has a name but no colour of its own: the shared
// presence palette's first (sky).
export const DEFAULT_PARTICIPANT_COLOR = PRESENCE_COLOUR_VALUES[0]!;

// How long a profile read is trusted in one isolate. Safe range 0..300_000.
export const PROFILE_CACHE_MS = 60_000;
// Profiles remembered per isolate; the oldest go first. Safe range 100..10_000.
const PROFILE_CACHE_MAX = 2_000;

type Remembered = { profile: Profile | null; until: number };
const remembered = new Map<string, Remembered>();

function remember(owner: string, profile: Profile | null, now: number): void {
  if (remembered.size >= PROFILE_CACHE_MAX && !remembered.has(owner)) {
    const oldest = remembered.keys().next().value;
    if (oldest !== undefined) remembered.delete(oldest);
  }
  remembered.set(owner, { profile, until: now + PROFILE_CACHE_MS });
}

// Test seam: forget every remembered profile.
export function __forgetProfiles(): void {
  remembered.clear();
}

// A profile as the participant the api has always answered: a person with no name has no participant
// yet, and one with no colour of their own takes the default. With `pictures`, the person's published Google
// picture too (docs/specs/014-identity/profile-and-email-notifications.md "Profile pictures"): only for a reader
// who is a signed-in account, and never written into a plan, so it is off unless a route asks.
function toParticipant(
  ownerId: string,
  profile: Profile | null,
  pictures = false,
): ParticipantDTO | null {
  if (!profile?.name) return null;
  const picture = pictures ? profilePictureOf(profile.picture) : null;
  return {
    id: ownerId,
    name: profile.name,
    color: profile.color ?? DEFAULT_PARTICIPANT_COLOR,
    createdAt: profile.createdAt ?? profile.updatedAt ?? 0,
    ...(picture ? { picture } : {}),
  };
}

// The raw profiles of these owners: the remembered ones, and the rest in one batched read. An owner
// with no profile (or no place at the accounts Worker) maps to null.
async function profilesOf(
  credentials: ClientCredentials,
  ownerIds: readonly string[],
): Promise<Map<string, Profile | null>> {
  const now = Date.now();
  const out = new Map<string, Profile | null>();
  const ask: string[] = [];
  for (const ownerId of new Set(ownerIds)) {
    if (!accountsOwnerOf(ownerId)) {
      out.set(ownerId, null);
      continue;
    }
    const known = remembered.get(ownerId);
    if (known && known.until > now) out.set(ownerId, known.profile);
    else ask.push(ownerId);
  }
  if (ask.length === 0) return out;
  const found = await readProfiles(credentials, ask);
  const byId = new Map(found.map((p) => [p.id, p]));
  for (const ownerId of ask) {
    const profile = byId.get(ownerId) ?? null;
    remember(ownerId, profile, now);
    out.set(ownerId, profile);
  }
  return out;
}

// Everyone's participant among `ownerIds`, in one call to the accounts Worker at most. Ids with no
// participant are left out. A failed read is logged and answers no one: a list shows its names blank
// rather than failing.
export async function getParticipants(
  env: Env,
  ownerIds: readonly (string | null | undefined)[],
  { pictures = false }: { pictures?: boolean } = {},
): Promise<Map<string, ParticipantDTO>> {
  const credentials = accountCredentials(env);
  const ids = ownerIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  const participants = new Map<string, ParticipantDTO>();
  if (!credentials || ids.length === 0) return participants;
  try {
    for (const [ownerId, profile] of await profilesOf(credentials, ids)) {
      const participant = toParticipant(ownerId, profile, pictures);
      if (participant) participants.set(ownerId, participant);
    }
  } catch (error) {
    console.warn('[profiles] read_failed', { count: ids.length, error: String(error) });
  }
  return participants;
}

export async function getParticipant(
  env: Env,
  ownerId: string,
  options: { pictures?: boolean } = {},
): Promise<ParticipantDTO | null> {
  return (await getParticipants(env, [ownerId], options)).get(ownerId) ?? null;
}

// Sets an owner's own name and colour (the caller has checked the owner is the one asking). Answers the
// participant as it now is. Without the accounts Worker it is kept nowhere and answered as sent.
export async function saveParticipant(
  env: Env,
  ownerId: string,
  patch: { name: string; color: string },
): Promise<ParticipantDTO> {
  const credentials = accountCredentials(env);
  const owner = accountsOwnerOf(ownerId);
  const sent: ParticipantDTO = { id: ownerId, ...patch, createdAt: Date.now() };
  if (!credentials || !owner) return sent;
  const profile = await writeProfile(credentials, { owner, ...patch });
  remember(owner, profile, Date.now());
  return toParticipant(ownerId, profile) ?? sent;
}
