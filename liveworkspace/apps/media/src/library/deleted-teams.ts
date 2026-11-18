// A deleted team's Library and gallery go (liveworkspace/docs/specs/006-media/libraries.md "Account and guest
// lifecycle"). Once a day the service lists the teams it holds items or pictures for and asks accounts which are
// deleted (`POST /api/account/media/teams-deleted`, ACCOUNTS_KEY_MEDIA, through the ACCOUNTS binding). Only a team
// accounts names as deleted is touched; anything else (a live team, an unknown id, no answer) keeps everything, and
// the next run asks again. Deleting a team's Library twice finds nothing the second time.

import { teamMediaOwner } from '@liveworkspace/media';
import type { Env } from '../env';
import { deleteOwnerRows } from '../images';
import { deleteRows } from './store';

// Ids per call, the accounts door's own limit (MAX_DELETED_TEAM_IDS).
export const DELETED_TEAMS_CHUNK = 100;
// Teams asked about per run, at most: fifty calls.
export const DELETED_TEAMS_ASK_MAX = 5_000;
const ASK_TIMEOUT_MS = 10_000;
// Reached through the binding: the host is never looked up.
const DOOR_URL = 'https://accounts/api/account/media/teams-deleted';
// R2 deletes take at most this many keys a call.
const R2_DELETE_MAX = 1_000;

export type DeletedTeamsOutcome =
  | { skipped: true }
  | { skipped: false; asked: number; teams: number; items: number; pictures: number };

// Every team this service holds a Library item or a gallery picture for, sorted. The gallery owners are read as a
// range ('team:' up to 'team;', the next character) so the owner index serves it.
export async function heldTeams(env: Env): Promise<string[]> {
  const { results } = await env.MEDIA_DB.prepare(
    `SELECT scope_id AS id FROM library_items WHERE scope = 'team'
     UNION
     SELECT substr(owner, 6) AS id FROM images WHERE owner >= 'team:' AND owner < 'team;'
     ORDER BY id LIMIT ?`,
  )
    .bind(DELETED_TEAMS_ASK_MAX)
    .all<{ id: string }>();
  return results.map((r) => r.id).filter((id) => id.length > 0);
}

// Those of `ids` accounts says are deleted, or null when it didn't answer.
async function askAccounts(
  accounts: Fetcher,
  key: string,
  ids: string[],
): Promise<string[] | null> {
  try {
    const response = await accounts.fetch(DOOR_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.warn('[library] deleted teams not answered', { status: response.status });
      return null;
    }
    const body = (await response.json().catch(() => null)) as { deleted?: unknown } | null;
    if (!Array.isArray(body?.deleted)) {
      console.warn('[library] deleted teams not answered', { status: 'invalid_body' });
      return null;
    }
    // Only an id that was asked about counts.
    const asked = new Set(ids);
    return body.deleted.filter((id): id is string => typeof id === 'string' && asked.has(id));
  } catch (error) {
    console.warn('[library] deleted teams not answered', {
      status: error instanceof Error ? error.name : 'fetch_failed',
    });
    return null;
  }
}

// One deleted team's Library items (with their picture references) and its gallery, rows and bytes.
export async function deleteTeamLibrary(
  env: Env,
  bucket: R2Bucket | undefined,
  teamId: string,
): Promise<{ items: number; pictures: number }> {
  const { results } = await env.MEDIA_DB.prepare(
    `SELECT id FROM library_items WHERE scope = 'team' AND scope_id = ?`,
  )
    .bind(teamId)
    .all<{ id: string }>();
  const items = results.map((r) => r.id);
  await deleteRows(env, items);
  const pictures = await deleteOwnerRows(env, teamMediaOwner(teamId));
  for (let i = 0; bucket && i < pictures.length; i += R2_DELETE_MAX) {
    try {
      await bucket.delete(pictures.slice(i, i + R2_DELETE_MAX));
    } catch (error) {
      console.error('[library] R2 delete failed for a deleted team', error);
    }
  }
  return { items: items.length, pictures: pictures.length };
}

// The daily run's step. Never throws.
export async function sweepDeletedTeams(env: Env): Promise<DeletedTeamsOutcome> {
  const key = env.ACCOUNTS_KEY_MEDIA?.trim();
  if (!env.ACCOUNTS || !key) {
    console.info('[library] deleted teams skipped: no ACCOUNTS binding or ACCOUNTS_KEY_MEDIA');
    return { skipped: true };
  }
  const outcome = { skipped: false as const, asked: 0, teams: 0, items: 0, pictures: 0 };
  try {
    const held = await heldTeams(env);
    for (let i = 0; i < held.length; i += DELETED_TEAMS_CHUNK) {
      const ids = held.slice(i, i + DELETED_TEAMS_CHUNK);
      const deleted = await askAccounts(env.ACCOUNTS, key, ids);
      if (!deleted) break;
      outcome.asked += ids.length;
      for (const teamId of deleted) {
        const gone = await deleteTeamLibrary(env, env.MEDIA, teamId);
        outcome.teams += 1;
        outcome.items += gone.items;
        outcome.pictures += gone.pictures;
      }
    }
  } catch (error) {
    console.error('[library] deleted teams failed', error);
  }
  if (outcome.teams > 0) console.info("[library] deleted a team's library", outcome);
  return outcome;
}
