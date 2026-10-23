// The Explorer's lists (`GET /items`, `GET /trash`): one query per page, keyset-paged, each driven by an
// index that starts with the person (their scopes, their opens, favourites or shared rows) or with one
// folder, so a page costs what the person holds, never the table. The plans are pinned by a test
// (lists.test.ts "query plans").

import type { App, ItemView } from '@liveworkspace/index-client';
import { scopesOf, type Person } from './auth';
import { containsPattern, encodeCursor, type Cursor } from './codec';
import type { Env } from './env';
import { decorate, ITEM_COLUMNS, LIVE_LINK, type ItemRow } from './rows';

export type ListSpec = {
  view: ItemView;
  app?: App;
  // A folder the person can reach (checked by the route).
  folder?: string;
  // Only these scopes (the `team` filter), or every scope the person has.
  scopes?: string[];
  // One of the person's own tags (checked by the route).
  tag?: string;
  q?: string;
  limit: number;
  cursor?: Cursor;
};

export type BuiltQuery = { sql: string; args: unknown[] };

const IN_JSON = 'IN (SELECT value FROM json_each(?))';

export function buildListQuery(person: Person, spec: ListSpec, now = Date.now()): BuiltQuery {
  const allScopes = JSON.stringify(scopesOf(person));
  const scopes = spec.scopes ? JSON.stringify(spec.scopes) : allScopes;
  const where: string[] = [];
  const args: unknown[] = [];
  let from = 'items i';
  let sortCol = 'i.updated_at';
  let idCol = 'i.id';

  // Reached as owner, through the person's own scopes, or through a live link they opened.
  const reachable = () => {
    where.push(
      `(i.owner_id = ? OR i.scope ${IN_JSON} OR EXISTS (SELECT 1 FROM shared_with sw2 JOIN share_links sl2
        ON sl2.code = sw2.share_code AND sl2.item_id = sw2.item_id
        WHERE sw2.person_id = ? AND sw2.item_id = i.id AND ${LIVE_LINK('sl2')}))`,
    );
    args.push(person.id, allScopes, person.id, now);
    if (spec.scopes) {
      where.push(`i.scope ${IN_JSON}`);
      args.push(scopes);
    }
  };

  switch (spec.view) {
    case 'all':
    case 'unsorted':
    case 'trash':
      if (spec.folder && spec.view === 'all') {
        where.push('i.folder_id = ?');
        args.push(spec.folder);
      } else {
        where.push(`i.scope ${IN_JSON}`);
        args.push(scopes);
      }
      where.push(spec.view === 'trash' ? 'i.trashed_at IS NOT NULL' : 'i.trashed_at IS NULL');
      if (spec.view === 'unsorted') where.push('i.folder_id IS NULL');
      break;
    case 'recent':
      from = 'opens o JOIN items i ON i.id = o.item_id';
      sortCol = 'o.last_opened_at';
      idCol = 'o.item_id';
      where.push('o.person_id = ?', 'i.trashed_at IS NULL');
      args.push(person.id);
      reachable();
      break;
    case 'favourites':
      from = 'favourites f JOIN items i ON i.id = f.item_id';
      where.push('f.person_id = ?', 'i.trashed_at IS NULL');
      args.push(person.id);
      reachable();
      break;
    case 'shared':
      from = `shared_with sw JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
        JOIN items i ON i.id = sw.item_id`;
      where.push('sw.person_id = ?', LIVE_LINK('sl'), 'i.trashed_at IS NULL');
      args.push(person.id, now);
      // What the person reaches as owner or team member is theirs, not shared with them.
      where.push(`i.scope NOT ${IN_JSON}`);
      args.push(allScopes);
      if (spec.scopes) {
        where.push(`i.scope ${IN_JSON}`);
        args.push(scopes);
      }
      break;
  }

  if (spec.folder && spec.view !== 'all') {
    where.push('i.folder_id = ?');
    args.push(spec.folder);
  }
  if (spec.app) {
    where.push('i.app = ?');
    args.push(spec.app);
  }
  if (spec.tag) {
    where.push('i.id IN (SELECT item_id FROM item_tags WHERE tag_id = ?)');
    args.push(spec.tag);
  }
  if (spec.q) {
    // Title, tag-name and folder-name search, the person's text taken literally.
    const pattern = containsPattern(spec.q);
    where.push(
      `(i.title LIKE ? ESCAPE '\\'
        OR i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id
                    WHERE t.owner_id = ? AND t.name LIKE ? ESCAPE '\\')
        OR i.folder_id IN (SELECT f.id FROM folders f WHERE f.scope ${IN_JSON} AND f.name LIKE ? ESCAPE '\\'))`,
    );
    args.push(pattern, person.id, pattern, allScopes, pattern);
  }
  if (spec.cursor) {
    where.push(`(${sortCol}, ${idCol}) < (?, ?)`);
    args.push(spec.cursor.at, spec.cursor.id);
  }

  const sql = `SELECT ${ITEM_COLUMNS}, ${sortCol} AS sort_at FROM ${from}
    WHERE ${where.join(' AND ')}
    ORDER BY ${sortCol} DESC, ${idCol} DESC LIMIT ?`;
  args.push(spec.limit + 1);
  return { sql, args };
}

export async function listItems(env: Env, person: Person, spec: ListSpec) {
  const { sql, args } = buildListQuery(person, spec);
  const { results } = await env.INDEX_DB.prepare(sql)
    .bind(...args)
    .all<ItemRow & { sort_at: number }>();
  const more = results.length > spec.limit;
  const page = more ? results.slice(0, spec.limit) : results;
  const last = page[page.length - 1];
  const items = await decorate(env, person, page);
  return {
    items,
    nextCursor: more && last ? encodeCursor({ at: last.sort_at, id: last.id }) : null,
  };
}
