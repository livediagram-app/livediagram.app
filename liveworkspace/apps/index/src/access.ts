// The access rule (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): the owner, and
// every joined member of the item's team, edit everything; anyone else needs a live share link, at its
// level and on its tab, and the item's share password when it has one. Team membership comes from the
// token's `teams` claim, and from accounts for a team the claim does not hold yet (fresh-teams.ts).

import { levelAtLeast, type Level } from '@liveworkspace/index-client';
import type { Caller, Person } from './auth';
import type { Env } from './env';
import { inTeamNow } from './fresh-teams';
import { fail, json, notFound, unauthorized } from './http';
import { isRememberedSharePassword, verifySharePassword } from './password-hash';
import { guessRefusal, wrongGuessRefusal } from './share-guesses';
import {
  ruleIsOn,
  signInRefusal,
  SIGN_IN_COLUMNS,
  SIGN_IN_JOIN,
  type SignInColumns,
} from './share-sign-in';
import { directAccess, getItemRow, LIVE_LINK, type Access, type ItemRow } from './rows';

type LinkRow = {
  code: string;
  level: Level;
  tab_id: string | null;
  hash: string | null;
  public: number;
} & Partial<SignInColumns>;

// The live link a caller holds for an item: the code they sent, or else the one they opened it through
// before (Shared with me). With the item's password hash, when it has one.
async function linkFor(env: Env, itemId: string, caller: Caller): Promise<LinkRow | null> {
  const now = Date.now();
  if (caller.share) {
    return env.INDEX_DB.prepare(
      `SELECT sl.code, sl.level, sl.tab_id, sl.public, sp.hash, ${SIGN_IN_COLUMNS} FROM share_links sl
       LEFT JOIN share_passwords sp ON sp.item_id = sl.item_id
       ${SIGN_IN_JOIN('sl')}
       WHERE sl.code = ? AND sl.item_id = ? AND ${LIVE_LINK('sl')}`,
    )
      .bind(caller.share.code, itemId, now)
      .first<LinkRow>();
  }
  if (!caller.person) return null;
  return env.INDEX_DB.prepare(
    `SELECT sl.code, sl.level, sl.tab_id, sl.public, sp.hash, ${SIGN_IN_COLUMNS} FROM shared_with sw
     JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
     LEFT JOIN share_passwords sp ON sp.item_id = sl.item_id
     ${SIGN_IN_JOIN('sl')}
     WHERE sw.person_id = ? AND sw.item_id = ? AND ${LIVE_LINK('sl')}`,
  )
    .bind(caller.person.id, itemId, now)
    .first<LinkRow>();
}

// A link's access, after its password. A refusal is the response to send. A public link (a Community post's) never
// asks for one: behind a password it is closed, and answers as missing. A password this isolate hasn't already found
// right is a guess (share-guesses.ts): counted against the visitor's network before it is checked, and, when wrong,
// against the item. The right one opens the item even while others' wrong guesses hold the item over its limit.
// `nameLink`: the caller sent no code and reached the link through their own Shared with me row, so a password asked
// of them names the link's code (and nothing else), for their editor to ask for it ("Reopened without the code").
// The item's sign-in rule comes first (share-sign-in.ts): a guest, nobody or an account at another domain is refused
// before any password is read, so the rule spends no guesses. Behind a rule a public link is closed, as behind a password.
export async function linkAccess(
  env: Env,
  itemId: string,
  link: LinkRow,
  password: string | null,
  visitor: string | null,
  nameLink = false,
  person: Person | null = null,
): Promise<Access | Response> {
  if ((link.hash || ruleIsOn(link)) && link.public) return notFound();
  const outside = signInRefusal(link, person);
  if (outside) return outside;
  if (link.hash) {
    if (!password) {
      return nameLink
        ? json({ error: 'password_required', link: link.code }, { status: 401 })
        : fail(401, 'password_required');
    }
    if (!(await isRememberedSharePassword(link.hash, password))) {
      const refused = await guessRefusal(env, itemId, visitor);
      if (refused) return refused;
      if (!(await verifySharePassword(link.hash, password))) {
        return wrongGuessRefusal(env, itemId, visitor);
      }
    }
  }
  return {
    level: link.level,
    tabId: link.tab_id,
    via: 'link',
    code: link.code,
    ...(link.public ? { public: true as const } : {}),
  };
}

// What the caller may do with a row. A trashed item is reached only by its owner and team.
export async function accessTo(env: Env, row: ItemRow, caller: Caller): Promise<Access | Response> {
  const own = await ownAccess(env, row, caller);
  // The owner's and a member's own access, unless the request comes in through a public link (a Community post's):
  // that is a viewing surface for everyone, its author and their team included, so it opens at the link's level as
  // any visitor's does (one-explorer-contracts.md "Sharing and access"). Only a request that names a code asks.
  if (own && !caller.share) return own;
  if (!caller.person && !caller.share) return unauthorized();
  const link = await linkFor(env, row.id, caller);
  if (own && !link?.public) return own;
  if (row.trashed_at !== null) return notFound();
  // An item the caller can't reach answers as missing, revealing nothing.
  if (!link) return notFound();
  return linkAccess(
    env,
    row.id,
    link,
    caller.share?.password ?? null,
    caller.share?.visitor ?? null,
    // No code sent: the link is the person's own Shared with me row (linkFor), so they opened it before.
    !caller.share,
    caller.person,
  );
}

// The owner's or a joined member's access, or null for anyone else.
async function ownAccess(env: Env, row: ItemRow, caller: Caller): Promise<Access | null> {
  const direct = directAccess(row, caller.person);
  if (direct) return direct;
  // A team made or joined since their token was minted (fresh-teams.ts).
  if (row.team_id && caller.person && (await inTeamNow(env, caller.person, row.team_id))) {
    return { level: 'edit', tabId: null, via: 'team', code: null };
  }
  return null;
}

export type Loaded = { row: ItemRow; access: Access };

// An item and the caller's access to it, at least `need`. `manage` asks for its owner or team.
export async function loadItem(
  env: Env,
  id: string,
  caller: Caller,
  need: Level,
  options: { manage?: boolean } = {},
): Promise<Loaded | Response> {
  if (!caller.person && !caller.share) return unauthorized();
  const row = await getItemRow(env, id);
  if (!row) return notFound();
  // An app acting for a person reaches its own items only; another app's answers as missing.
  if (caller.person?.app && caller.person.app !== row.app) return notFound();
  // The Drive mirror reaches the person's personal items only; a team's, or anyone else's, answers as missing.
  if (caller.person?.drive && (row.team_id !== null || row.owner_id !== caller.person.id)) {
    return notFound();
  }
  const access = await accessTo(env, row, caller);
  if (access instanceof Response) return access;
  if (options.manage && access.via === 'link') return fail(403, 'forbidden');
  if (!levelAtLeast(access.level, need)) return fail(403, 'forbidden');
  return { row, access };
}
