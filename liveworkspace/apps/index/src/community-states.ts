// `POST /app/community/states` (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Notices", and
// liveworkspace/docs/specs/007-community/community.md "The sweep"): where each Community post's item stands, for the
// Community's sweep, asked by the item's app with its key. Read only: two statements by primary key, each with one
// `json_each` parameter, whatever the number asked (at most COMMUNITY_STATES_MAX), so it stays inside D1's
// bound-parameter cap and never builds a compound query.

import {
  ANONYMISED_PERSON,
  COMMUNITY_STATES_MAX,
  type App,
  type CommunityStateAnswer,
  type CommunityStateAsk,
  type ItemCommunityState,
} from '@liveworkspace/index-client';
import { isId, isShareCode } from './codec';
import type { Env } from './env';
import { badRequest, json, readObject } from './http';

type StateRow = {
  id: string;
  app: string;
  owner_id: string;
  team_id: string | null;
  trashed_at: number | null;
  archived_at: number | null;
  password: number;
};

// One post's state from its item's row (null: no such item) and whether its link is still the item's.
export function communityStateOf(
  app: App,
  ask: CommunityStateAsk,
  row: StateRow | null,
  linked: boolean,
): ItemCommunityState {
  if (!row || row.app !== app) return 'gone';
  if (row.owner_id === ANONYMISED_PERSON || row.archived_at !== null || !linked) return 'gone';
  if (row.trashed_at !== null) return 'away';
  // A guest's post (only the migration made those) follows its guest into the account it became, which the index
  // re-owns the item to, so only an account's post is away once its item is someone else's.
  if (row.owner_id !== ask.owner && !ask.owner.startsWith('guest_')) return 'away';
  if (row.team_id !== null || row.password === 1) return 'closed';
  return 'public';
}

export async function communityStatesOf(
  env: Env,
  app: App,
  asks: readonly CommunityStateAsk[],
): Promise<CommunityStateAnswer[]> {
  const db = env.INDEX_DB;
  const ids = JSON.stringify([...new Set(asks.map((a) => a.id))]);
  const codes = JSON.stringify([...new Set(asks.map((a) => a.code.toUpperCase()))]);
  const [items, links] = await db.batch([
    db
      .prepare(
        `SELECT i.id, i.app, i.owner_id, i.team_id, i.trashed_at, i.archived_at,
                EXISTS (SELECT 1 FROM share_passwords sp WHERE sp.item_id = i.id) AS password
           FROM items i WHERE i.id IN (SELECT value FROM json_each(?))`,
      )
      .bind(ids),
    db
      .prepare(
        'SELECT code, item_id FROM share_links WHERE code IN (SELECT value FROM json_each(?))',
      )
      .bind(codes),
  ]);
  const rows = new Map(((items?.results ?? []) as StateRow[]).map((r) => [r.id, r]));
  const linkItem = new Map(
    ((links?.results ?? []) as { code: string; item_id: string }[]).map((l) => [l.code, l.item_id]),
  );
  return asks.map((ask) => ({
    id: ask.id,
    state: communityStateOf(
      app,
      ask,
      rows.get(ask.id) ?? null,
      linkItem.get(ask.code.toUpperCase()) === ask.id,
    ),
  }));
}

// The body's posts, or null when it is not 1 to COMMUNITY_STATES_MAX well-formed ones.
function readAsks(body: Record<string, unknown> | null): CommunityStateAsk[] | null {
  const posts = body?.posts;
  if (!Array.isArray(posts) || posts.length === 0 || posts.length > COMMUNITY_STATES_MAX)
    return null;
  const asks: CommunityStateAsk[] = [];
  for (const post of posts as unknown[]) {
    const p = post as Partial<CommunityStateAsk> | null;
    if (!p || !isId(p.id) || !isShareCode(p.code) || !isId(p.owner)) return null;
    asks.push({ id: p.id, code: p.code, owner: p.owner });
  }
  return asks;
}

export async function handleCommunityStates(
  request: Request,
  env: Env,
  app: App,
): Promise<Response> {
  const asks = readAsks(await readObject(request));
  if (!asks) return badRequest();
  return json({ states: await communityStatesOf(env, app, asks) });
}
