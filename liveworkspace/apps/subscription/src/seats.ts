// A team's seats (subscription.md "Tiers and limits"): its joined members, as accounts keeps them. This Worker asks
// accounts with an OAuth client's credentials, as an app's Worker does (`POST /api/account/internal/teams/members`,
// and `teams/member-counts` for several teams at once), and remembers each answer briefly in the isolate. Without
// credentials, or when accounts can't answer, the count is unknown and the caller falls back to what the
// subscription last held.

import {
  MAX_MEMBER_COUNT_TEAMS,
  readProfiles,
  readTeamMemberCounts,
  readTeamPeople,
} from '@liveworkspace/auth-client';
import { accountCredentials } from '@liveworkspace/auth-client/api-tokens';
import { MEMBERS_CACHE_MAX, MEMBERS_FRESH_MS, SERVICE_CALL_TIMEOUT_MS } from './config';
import { accountsUrl, type Env } from './env';

const remembered = new Map<string, { members: number; at: number }>();

function remember(key: string, members: number, now: number): void {
  remembered.delete(key);
  remembered.set(key, { members, at: now });
  while (remembered.size > MEMBERS_CACHE_MAX) {
    const oldest = remembered.keys().next();
    if (oldest.done) break;
    remembered.delete(oldest.value);
  }
}

/** Whether this Worker can ask accounts for a team's members at all. */
export function canCountMembers(env: Env): boolean {
  return Boolean(env.ACCOUNTS_CLIENT_ID && env.ACCOUNTS_CLIENT_SECRET);
}

/** The answer already in hand for a team, or undefined when it must be asked for. */
export function membersRemembered(env: Env, teamId: string, now: number): number | undefined {
  const held = remembered.get(`${accountsUrl(env)} ${teamId}`);
  return held && now - held.at < MEMBERS_FRESH_MS ? held.members : undefined;
}

/** A team's joined members, or null when that can't be known (no credentials, no such team, accounts out of reach).
 *  Never throws. */
export async function teamMembers(
  env: Env,
  teamId: string,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<number | null> {
  const known = membersRemembered(env, teamId, now);
  if (known !== undefined) return known;
  const credentials = accountCredentials({ ...env, ACCOUNTS_URL: accountsUrl(env) });
  if (!credentials) return null;
  try {
    const people = await readTeamPeople(credentials, teamId, fetcher);
    if (!people) return null;
    const members = people.members.filter((person) => person.status === 'joined').length;
    remember(`${accountsUrl(env)} ${teamId}`, members, now);
    return members;
  } catch (error) {
    console.warn('[subscription] team members failed', { error: String(error) });
    return null;
  }
}

/**
 * Several teams' joined members, for `/me`: what is remembered, and ONE call to accounts for all the rest however
 * many they are (`teams/member-counts`), each answer remembered briefly. A team accounts did not answer for (no
 * credentials, out of reach, deleted) is absent, for the caller to fall back. Never throws.
 */
export async function teamsMembers(
  env: Env,
  teamIds: readonly string[],
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<Map<string, number>> {
  const members = new Map<string, number>();
  const unknown: string[] = [];
  for (const id of new Set(teamIds)) {
    const known = membersRemembered(env, id, now);
    if (known !== undefined) members.set(id, known);
    else unknown.push(id);
  }
  const asked = unknown.slice(0, MAX_MEMBER_COUNT_TEAMS);
  const credentials = accountCredentials({ ...env, ACCOUNTS_URL: accountsUrl(env) });
  if (asked.length === 0 || !credentials) return members;
  try {
    const counts = await readTeamMemberCounts(credentials, asked, withTimeout(fetcher));
    for (const id of asked) {
      const count = counts[id];
      if (count === undefined) continue;
      remember(`${accountsUrl(env)} ${id}`, count, now);
      members.set(id, count);
    }
  } catch (error) {
    console.warn('[subscription] team member counts failed', { error: String(error) });
  }
  return members;
}

/** What an account is to a team at this moment, as accounts has it: a joined member (with the role and the name
 *  accounts shows for them), not one, or that accounts could not say. */
export type MemberNow =
  { role: 'admin' | 'member'; name: string | null } | 'not_member' | 'unknown';

/**
 * Whether `userId` is a joined member of the team NOW. A token's `teams` claim is up to fifteen minutes old, so
 * what acts for a team asks accounts each time and never remembers the answer. `unknown` (no credentials, accounts
 * out of reach) is for the caller to refuse and ask again, never to read as yes. Never throws.
 */
export async function teamMemberNow(
  env: Env,
  teamId: string,
  userId: string,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<MemberNow> {
  const credentials = accountCredentials({ ...env, ACCOUNTS_URL: accountsUrl(env) });
  if (!credentials) return 'unknown';
  try {
    const people = await readTeamPeople(credentials, teamId, withTimeout(fetcher));
    if (!people) return 'not_member';
    const joined = people.members.filter((person) => person.status === 'joined');
    remember(`${accountsUrl(env)} ${teamId}`, joined.length, now);
    const found = joined.find((person) => person.userId === userId);
    return found ? { role: found.role, name: found.name?.trim() || null } : 'not_member';
  } catch (error) {
    console.warn('[subscription] team member check failed', { error: String(error) });
    return 'unknown';
  }
}

/** Whether an account runs a team's billing at this moment, as accounts has it, or that accounts could not say. */
export type AdminNow = 'admin' | 'not_admin' | 'unknown';

/** Whether `userId` is a joined admin of the team NOW (`teamMemberNow`): what spends a team's money asks each time. */
export async function teamAdminNow(
  env: Env,
  teamId: string,
  userId: string,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<AdminNow> {
  const standing = await teamMemberNow(env, teamId, userId, now, fetcher);
  if (standing === 'unknown') return 'unknown';
  return standing !== 'not_member' && standing.role === 'admin' ? 'admin' : 'not_admin';
}

/**
 * The name accounts shows for an account (its profile's, else the account's own), or null when it has none or
 * accounts cannot say. For a checkout or the portal to name its owner. Never throws.
 */
export async function accountName(
  env: Env,
  userId: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const credentials = accountCredentials({ ...env, ACCOUNTS_URL: accountsUrl(env) });
  if (!credentials) return null;
  try {
    const [profile] = await readProfiles(credentials, [userId], withTimeout(fetcher));
    return profile?.name?.trim() || null;
  } catch (error) {
    console.warn('[subscription] account name failed', { error: String(error) });
    return null;
  }
}

/** A fetch that gives up after a moment, so a billing request never hangs on accounts. */
function withTimeout(fetcher: typeof fetch): typeof fetch {
  return (input, init) =>
    fetcher(input, { ...init, signal: AbortSignal.timeout(SERVICE_CALL_TIMEOUT_MS) });
}

/** Forgets every remembered count. For tests. */
export function forgetMembers(): void {
  remembered.clear();
}
