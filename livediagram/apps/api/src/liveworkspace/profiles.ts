// Display names and presence colours (docs/specs/015-api/api.md "participants"), kept by the
// liveworkspace accounts Worker as one profile per person across every app
// (liveworkspace/docs/accounts.md "Profiles"). This app keeps no participants table: it reads
// profiles in batches and writes only the caller's own.
//
// Reads are remembered per isolate for PROFILE_CACHE_MS, so the hot paths that name someone (a
// document's owner on every open, a comment author on every autosave) cost one accounts call per
// person per minute per isolate, not one per request. A write updates the remembered copy at once,
// so the writer sees their own change; another isolate sees it within the minute.

import { colorForKey } from '@livediagram/api-schema';
import { readProfiles, writeProfile, type Profile } from '@liveworkspace/auth-client';
import { accountCredentials } from '../auth/accounts';
import type { Env, ParticipantDTO } from '../types';
import { liveworkspaceOwnerOf, liveworkspaceTarget } from './owner';

// How long a profile read is trusted in one isolate: also how long a rename takes to reach another
// isolate. A minute, as liveworkspace's own token checks are remembered. Safe range 10 s .. 5 min.
export const PROFILE_CACHE_MS = 60_000;
// Profiles remembered per isolate; the oldest go first. ~200 bytes each, so ~400 KB at most.
export const PROFILE_CACHE_MAX = 2000;

type Remembered = { participant: ParticipantDTO | null; until: number };
const remembered = new Map<string, Remembered>();

function remember(id: string, participant: ParticipantDTO | null, now: number): void {
  remembered.delete(id);
  if (remembered.size >= PROFILE_CACHE_MAX) {
    const oldest = remembered.keys().next().value;
    if (oldest !== undefined) remembered.delete(oldest);
  }
  remembered.set(id, { participant, until: now + PROFILE_CACHE_MS });
}

// Test seam: forget every remembered profile.
export function __resetProfileCache(): void {
  remembered.clear();
}

// A profile as this app shows it. No name (a guest that never set one, which this app always does
// on first visit) is no participant; no colour takes the palette's pick for the id, so the same
// person is the same colour everywhere.
function toParticipant(id: string, profile: Profile): ParticipantDTO | null {
  if (!profile.name) return null;
  return {
    id,
    name: profile.name,
    color: profile.color ?? colorForKey(id),
    createdAt: profile.createdAt ?? 0,
    // The published Google picture (null when Show My Google Picture is off); readers strip it for a caller that
    // is not signed in (withoutPicture).
    ...(profile.picture ? { picture: profile.picture } : {}),
  };
}

// A participant as a caller who is not signed in reads it: never a picture (liveworkspace/docs/accounts.md
// "Profile pictures": pictures go only to signed-in viewers).
export function withoutPicture(p: ParticipantDTO): ParticipantDTO {
  if (p.picture === undefined) return p;
  const { picture: _hidden, ...rest } = p;
  return rest;
}

// The participants of these owner ids, found ones only, in one accounts call per 100 ids not
// remembered. Never throws: when liveworkspace can't be reached, or sign-in isn't configured (a
// guest-only deployment), the ids are simply not found and callers show their fallback.
export async function getParticipants(
  env: Env,
  ids: readonly string[],
): Promise<Map<string, ParticipantDTO>> {
  const found = new Map<string, ParticipantDTO>();
  const now = Date.now();
  const ask: string[] = [];
  for (const id of new Set(ids)) {
    const known = remembered.get(id);
    if (known && known.until > now) {
      if (known.participant) found.set(id, known.participant);
    } else if (liveworkspaceOwnerOf(id)) {
      ask.push(id);
    }
  }
  const credentials = accountCredentials(env);
  if (ask.length === 0 || !credentials) return found;
  let profiles: Profile[];
  try {
    profiles = await readProfiles(
      credentials,
      ask.map((id) => liveworkspaceOwnerOf(id)!),
    );
  } catch (err) {
    console.warn('[profiles] read_failed', { ids: ask.length, error: String(err) });
    return found;
  }
  const answered = new Map(profiles.map((p) => [p.id, p]));
  for (const id of ask) {
    const profile = answered.get(id);
    const participant = profile ? toParticipant(id, profile) : null;
    remember(id, participant, now);
    if (participant) found.set(id, participant);
  }
  return found;
}

export async function getParticipant(env: Env, id: string): Promise<ParticipantDTO | null> {
  return (await getParticipants(env, [id])).get(id) ?? null;
}

// Sets the caller's own name and colour; `ownerId` is the verified caller. Null when this app can't
// keep a profile for them (sign-in not configured, or an id liveworkspace can't hold). Throws a
// ProfileError when liveworkspace refuses the values.
export async function setParticipant(
  env: Env,
  ownerId: string,
  fields: { name: string; color: string },
): Promise<ParticipantDTO | null> {
  const target = liveworkspaceTarget(env, ownerId);
  if (!target) return null;
  const profile = await writeProfile(target.credentials, { owner: target.owner, ...fields });
  const participant = toParticipant(ownerId, profile);
  remember(ownerId, participant, Date.now());
  return participant;
}
