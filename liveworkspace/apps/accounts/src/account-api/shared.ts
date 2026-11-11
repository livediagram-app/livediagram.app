// What the account API's doors share: the team helpers, the shared settings patch and an account's name (account-api.ts).

import type { Env } from '../env.ts';
import { sendInviteResponseEmails } from '../email.ts';
import { USER_ID, GUEST_ID } from '../ids.ts';
import { rangeOf } from '../rate-limit.ts';
import { MAX_PROFILE_IDS, readProfiles } from '../profiles.ts';
import { type SettingsApp, writeSettings } from '../settings.ts';
import { inviteResponseRecipients, type Actor } from '../teams.ts';
import { answer, error, json, readBody } from './http.ts';

// Per network (an IPv4 /24 or an IPv6 /48), so one machine can't dodge the limit by changing address.
export async function overLinkLimit(
  request: Request,
  env: Env,
  door = 'team-link',
): Promise<boolean> {
  if (!env.TEAM_LINK_LIMITER) return false;
  return !(await env.TEAM_LINK_LIMITER.limit({ key: `${door}:${rangeOf(request, env)}` })).success;
}

// Display names by id: what collaborators see on a cursor or a comment anyway, up to MAX_PROFILE_IDS a read; ids
// not found are left out. With `pictures` (an account asking, never a guest: liveworkspace/docs/specs/003-accounts/accounts.md "Profile
// pictures"), each person's published Google picture too, read in the same query as the name.
export async function peopleNames(
  request: Request,
  db: Env['AUTH_DB'],
  { pictures }: { pictures: boolean },
): Promise<Response> {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .filter((v) => USER_ID.test(v) || GUEST_ID.test(v));
  if (ids.length > MAX_PROFILE_IDS) return error(400, 'too_many_ids');
  const profiles = await readProfiles(db, ids);
  return json({
    people: profiles.map((p) =>
      pictures ? { id: p.id, name: p.name, picture: p.picture } : { id: p.id, name: p.name },
    ),
  });
}

// Someone answered an invitation: the team's admins hear of it, unless they turned it off. A failed
// email never fails the answer.
export async function tellAdmins(
  env: Env,
  teamId: string,
  response: { teamName: string; responder: string; accepted: boolean; app: SettingsApp | null },
  responderId: string | null = null,
): Promise<void> {
  try {
    const recipients = await inviteResponseRecipients(env.AUTH_DB, teamId, responderId);
    if (recipients.length) {
      await sendInviteResponseEmails(env, recipients, { ...response, teamId });
    }
  } catch (cause) {
    console.error('[teams] invite response email failed', cause);
  }
}

export type Reader = Pick<Actor, 'id' | 'email'>;

// A patch of the settings every app shares (`PATCH { all }`), on either door: it answers the scope as it now is.
export async function patchSharedSettings(
  request: Request,
  db: Env['AUTH_DB'],
  actor: Reader,
): Promise<Response> {
  const result = await writeSettings(db, actor.id, null, { all: (await readBody(request)).all });
  return result.ok
    ? json({ all: result.value.all, updatedAt: result.value.updatedAt })
    : answer(result);
}

// The account's display name, for the audit log's "by …" and the invitation email (a token carries none).
export async function accountName(db: Env['AUTH_DB'], userId: string): Promise<string> {
  const row = await db
    .prepare('SELECT name FROM "user" WHERE id = ?')
    .bind(userId)
    .first<{ name: string | null }>();
  return row?.name ?? '';
}
