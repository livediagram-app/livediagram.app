// `POST /items/lookup { ids }` (liveworkspace/docs/specs/004-index/blueprints/items.md "Looking items up"): up to
// ITEM_LOOKUP_IDS_MAX items in one request, each kept by the rule `GET /items/:id` reads it with (access.ts
// `loadItem`), those it would refuse left out. One read of the rows, at most one of the person's links, and one
// decoration batch, whatever the number of ids: the apps' Image Gallery names its documents with it, rather than a
// read per document.

import { ITEM_LOOKUP_IDS_MAX, type Item } from '@liveworkspace/index-client';
import type { Person } from './auth';
import { isId } from './codec';
import type { PersonContext } from './context';
import type { Env } from './env';
import { inTeamNow } from './fresh-teams';
import { badRequest, json, readObject } from './http';
import { decorate, directAccess, ITEM_COLUMNS, LIVE_LINK, type Access, type ItemRow } from './rows';

type LinkRow = {
  item_id: string;
  code: string;
  level: Access['level'];
  tab_id: string | null;
  hash: string | null;
};

export async function lookupItems(env: Env, person: Person, ids: string[]): Promise<Item[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const db = env.INDEX_DB;
  const { results: rows } = await db
    .prepare(`SELECT ${ITEM_COLUMNS} FROM items i WHERE i.id IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(unique))
    .all<ItemRow>();
  const known = new Map<string, Access>();
  const viaLink: ItemRow[] = [];
  for (const row of rows) {
    // An app acting for a person reaches its own items only; the Drive mirror the person's personal items only.
    if (person.app && person.app !== row.app) continue;
    if (person.drive && (row.team_id !== null || row.owner_id !== person.id)) continue;
    const direct = directAccess(row, person);
    if (direct) known.set(row.id, direct);
    // A team made or joined since the token was minted (fresh-teams.ts).
    else if (row.team_id && (await inTeamNow(env, person, row.team_id))) {
      known.set(row.id, { level: 'edit', tabId: null, via: 'team', code: null });
    }
    // Anyone else's through a live link, never in the Trash.
    else if (row.trashed_at === null) viaLink.push(row);
  }
  if (viaLink.length > 0) {
    const { results: links } = await db
      .prepare(
        `SELECT sw.item_id, sl.code, sl.level, sl.tab_id, sp.hash FROM shared_with sw
         JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
         LEFT JOIN share_passwords sp ON sp.item_id = sl.item_id
         WHERE sw.person_id = ? AND sw.item_id IN (SELECT value FROM json_each(?)) AND ${LIVE_LINK('sl')}`,
      )
      .bind(person.id, JSON.stringify(viaLink.map((r) => r.id)), Date.now())
      .all<LinkRow>();
    for (const link of links) {
      // Behind a password the item needs it, which a lookup does not carry: `GET /items/:id` refuses it too.
      if (link.hash) continue;
      known.set(link.item_id, {
        level: link.level,
        tabId: link.tab_id,
        via: 'link',
        code: link.code,
      });
    }
  }
  const reached = rows.filter((row) => known.has(row.id));
  const items = await decorate(env, person, reached, known);
  const byId = new Map(items.map((item) => [item.id, item]));
  return unique.flatMap((id) => byId.get(id) ?? []);
}

export async function handleItemLookup(ctx: PersonContext): Promise<Response> {
  const body = await readObject(ctx.request);
  const ids = body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > ITEM_LOOKUP_IDS_MAX ||
    !ids.every(isId)
  ) {
    return badRequest();
  }
  return json({ items: await lookupItems(ctx.env, ctx.person, ids) });
}
