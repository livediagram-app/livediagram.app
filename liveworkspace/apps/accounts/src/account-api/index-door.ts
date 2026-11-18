// The account API's door for the index (account-api.ts).

import {
  ACCOUNTS_BINDING_ORIGIN,
  GUEST_SEEN_BACKFILL_PAGE,
} from '@liveworkspace/auth-client/guest-seen-backfill';
import type { Env } from '../env.ts';
import { backfillGuestSeen } from '../guest-sweep.ts';
import { USER_ID } from '../ids.ts';
import { sameSecret } from '../secrets.ts';
import { MAX_PROFILE_IDS, readProfiles } from '../profiles.ts';
import { teamsClaim } from '../teams.ts';
import { error, json, readBody } from './http.ts';

// --- The index, with the key it shares with accounts (INDEX_MERGE_KEY) ---

// POST /api/account/index/teams {userId}: the teams an account is in now, for the index when a request names a
// team its access token does not claim yet (a team made or joined since the token was minted).
export async function handleIndexTeams(request: Request, env: Env): Promise<Response> {
  const refused = await refuseIndexCall(request, env);
  if (refused) return refused;
  const { userId } = await readBody(request);
  if (typeof userId !== 'string' || !USER_ID.test(userId)) return error(400, 'invalid_user');
  return json({ teams: await teamsClaim(env.AUTH_DB, userId) });
}

// POST /api/account/index/people {ids}: accounts' display names now, for the team audit log's read
// (liveworkspace/docs/specs/004-index/team-audit-log.md "Who reads it"), up to MAX_PROFILE_IDS a call. A member who
// has left still has an account, so is still named; an id not found (a closed account's `deleted`) is left out.
export async function handleIndexPeople(request: Request, env: Env): Promise<Response> {
  const refused = await refuseIndexCall(request, env);
  if (refused) return refused;
  const { ids } = await readBody(request);
  if (!Array.isArray(ids) || ids.length > MAX_PROFILE_IDS) return error(400, 'too_many_ids');
  const accounts = ids.filter((v): v is string => typeof v === 'string' && USER_ID.test(v));
  const profiles = await readProfiles(env.AUTH_DB, accounts);
  return json({ people: profiles.map((p) => ({ id: p.id, name: p.name })) });
}

// POST /api/account/index/guests-seen {ids}: the index's guest owners, up to GUEST_SEEN_BACKFILL_PAGE a call, each
// dated if accounts has never seen it (guest-sweep.ts backfillGuestSeen; accounts.md "Guests from before the stamp").
// Only over the index's service binding: the request's host is the binding's own, which no public request can
// carry, else it is a plain 404 before anything else is read.
const BINDING_HOST = new URL(ACCOUNTS_BINDING_ORIGIN).host;

export async function handleIndexGuestsSeen(request: Request, env: Env): Promise<Response> {
  if (new URL(request.url).host !== BINDING_HOST) return error(404, 'not_found');
  const refused = await refuseIndexCall(request, env);
  if (refused) return refused;
  const { ids } = await readBody(request);
  if (!Array.isArray(ids) || ids.length > GUEST_SEEN_BACKFILL_PAGE) {
    return error(400, 'too_many_ids');
  }
  const guests = ids.filter((v): v is string => typeof v === 'string');
  return json({ added: await backfillGuestSeen(env.AUTH_DB, guests) });
}

// The index's doors: a POST with the key it shares with accounts, or a refusal.
async function refuseIndexCall(request: Request, env: Env): Promise<Response | null> {
  const key = env.INDEX_MERGE_KEY?.trim();
  const sent = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (request.method !== 'POST') return error(404, 'not_found');
  if (!key || !sent || !(await sameSecret(sent, key))) return error(401, 'unauthorized');
  return null;
}
