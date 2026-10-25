// The access rule (liveworkspace/docs/one-explorer-contracts.md "Sharing and access"): the owner, and
// every joined member of the item's team, edit everything; anyone else needs a live share link, at its
// level and on its tab, and the item's share password when it has one. Team membership comes from the
// token's `teams` claim, and from accounts for a team the claim does not hold yet (fresh-teams.ts).

import { levelAtLeast, type Level } from '@liveworkspace/index-client';
import type { Caller } from './auth';
import type { Env } from './env';
import { inTeamNow } from './fresh-teams';
import { fail, notFound, unauthorized } from './http';
import { verifySharePassword } from './password-hash';
import { directAccess, getItemRow, LIVE_LINK, type Access, type ItemRow } from './rows';

type LinkRow = {
  code: string;
  level: Level;
  tab_id: string | null;
  hash: string | null;
  public: number;
};

// The live link a caller holds for an item: the code they sent, or else the one they opened it through
// before (Shared with me). With the item's password hash, when it has one.
async function linkFor(env: Env, itemId: string, caller: Caller): Promise<LinkRow | null> {
  const now = Date.now();
  if (caller.share) {
    return env.INDEX_DB.prepare(
      `SELECT sl.code, sl.level, sl.tab_id, sl.public, sp.hash FROM share_links sl
       LEFT JOIN share_passwords sp ON sp.item_id = sl.item_id
       WHERE sl.code = ? AND sl.item_id = ? AND ${LIVE_LINK('sl')}`,
    )
      .bind(caller.share.code, itemId, now)
      .first<LinkRow>();
  }
  if (!caller.person) return null;
  return env.INDEX_DB.prepare(
    `SELECT sl.code, sl.level, sl.tab_id, sl.public, sp.hash FROM shared_with sw
     JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
     LEFT JOIN share_passwords sp ON sp.item_id = sl.item_id
     WHERE sw.person_id = ? AND sw.item_id = ? AND ${LIVE_LINK('sl')}`,
  )
    .bind(caller.person.id, itemId, now)
    .first<LinkRow>();
}

// A link's access, after its password. A refusal is the response to send. A public link (a Community post's) never
// asks for one: behind a password it is closed, and answers as missing.
export async function linkAccess(
  link: LinkRow,
  password: string | null,
): Promise<Access | Response> {
  if (link.hash && link.public) return notFound();
  if (link.hash) {
    if (!password) return fail(401, 'password_required');
    if (!(await verifySharePassword(link.hash, password))) return fail(403, 'password_invalid');
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
  const direct = directAccess(row, caller.person);
  if (direct) return direct;
  // A team made or joined since their token was minted (fresh-teams.ts).
  if (row.team_id && caller.person && (await inTeamNow(env, caller.person, row.team_id))) {
    return { level: 'edit', tabId: null, via: 'team', code: null };
  }
  if (!caller.person && !caller.share) return unauthorized();
  if (row.trashed_at !== null) return notFound();
  const link = await linkFor(env, row.id, caller);
  // An item the caller can't reach answers as missing, revealing nothing.
  if (!link) return notFound();
  return linkAccess(link, caller.share?.password ?? null);
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
  const access = await accessTo(env, row, caller);
  if (access instanceof Response) return access;
  if (options.manage && access.via === 'link') return fail(403, 'forbidden');
  if (!levelAtLeast(access.level, need)) return fail(403, 'forbidden');
  return { row, access };
}
