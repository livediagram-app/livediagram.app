// The Explorer's lists (`GET /items`, `GET /trash`): one query per page, keyset-paged, each driven by an
// index that starts with the person (their scopes, their opens, favourites or shared rows) or with one
// folder, so a page costs what the person holds, never the table. The plans are pinned by a test
// (lists.test.ts "query plans").

import { USE_WINDOW_DAYS, type App, type Item, type ItemView } from '@liveworkspace/index-client';
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
  // Recent's first page only: also this many Most Used items, from the same request (Home's Jump Back In).
  used?: number;
};

export type BuiltQuery = { sql: string; args: unknown[] };

const IN_JSON = 'IN (SELECT value FROM json_each(?))';
const DAY_MS = 86_400_000;

/**
 * Most Used: the items the person opened on the most distinct UTC days in the last USE_WINDOW_DAYS, ties to the
 * one opened last, then by id. Live, reachable items only, in the app and scopes asked. The person's window of
 * use_days is grouped first (read through use_days_person_day), so the cost is the rows they made in the window,
 * however many items or people the index holds; then at most `limit` items are joined.
 */
export function buildMostUsedQuery(
  person: Person,
  spec: Pick<ListSpec, 'app' | 'scopes'> & { limit: number },
  now = Date.now(),
): BuiltQuery {
  const allScopes = JSON.stringify(scopesOf(person));
  const from = Math.floor(now / DAY_MS) - USE_WINDOW_DAYS + 1;
  const where = [
    'i.trashed_at IS NULL',
    `(i.owner_id = ? OR i.scope ${IN_JSON} OR EXISTS (SELECT 1 FROM shared_with sw2 JOIN share_links sl2
      ON sl2.code = sw2.share_code AND sl2.item_id = sw2.item_id
      WHERE sw2.person_id = ? AND sw2.item_id = i.id AND ${LIVE_LINK('sl2')}))`,
  ];
  // In the order the SQL reads them: the window, the opens join, then the WHERE.
  const args: unknown[] = [person.id, from, person.id, person.id, allScopes, person.id, now];
  if (spec.scopes) {
    where.push(`i.scope ${IN_JSON}`);
    args.push(JSON.stringify(spec.scopes));
  }
  if (spec.app) {
    where.push('i.app = ?');
    args.push(spec.app);
  }
  args.push(spec.limit);
  const sql = `SELECT ${ITEM_COLUMNS}, u.use_days, COALESCE(o.last_opened_at, 0) AS sort_at
    FROM (SELECT item_id, COUNT(*) AS use_days FROM use_days WHERE person_id = ? AND day >= ? GROUP BY item_id) u
    JOIN items i ON i.id = u.item_id
    LEFT JOIN opens o ON o.person_id = ? AND o.item_id = u.item_id
    WHERE ${where.join(' AND ')}
    ORDER BY u.use_days DESC, sort_at DESC, i.id DESC LIMIT ?`;
  return { sql, args };
}

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
    // Title and folder-name search, the person's text taken literally. Tags are no part of it: the Explorer
    // shows none.
    const pattern = containsPattern(spec.q);
    where.push(
      `(i.title LIKE ? ESCAPE '\\'
        OR i.folder_id IN (SELECT f.id FROM folders f WHERE f.scope ${IN_JSON} AND f.name LIKE ? ESCAPE '\\'))`,
    );
    args.push(pattern, allScopes, pattern);
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

export async function listItems(
  env: Env,
  person: Person,
  spec: ListSpec,
): Promise<{ items: Item[]; nextCursor: string | null; mostUsed?: Item[] }> {
  const now = Date.now();
  const { sql, args } = buildListQuery(person, spec, now);
  const db = env.INDEX_DB;
  const withUsed = spec.view === 'recent' && !spec.cursor && (spec.used ?? 0) > 0;
  // Recent and Most Used in one round trip, decorated together.
  const statements = [db.prepare(sql).bind(...args)];
  if (withUsed) {
    const used = buildMostUsedQuery(person, { ...spec, limit: spec.used! }, now);
    statements.push(db.prepare(used.sql).bind(...used.args));
  }
  const [listed, usedRows] = (await db.batch(statements)) as [
    D1Result<ItemRow & { sort_at: number }>,
    D1Result<ItemRow & { use_days: number }> | undefined,
  ];
  const results = listed.results;
  const more = results.length > spec.limit;
  const page = more ? results.slice(0, spec.limit) : results;
  const last = page[page.length - 1];
  const usedList = usedRows?.results ?? [];
  const seen = new Set(page.map((r) => r.id));
  const all = [...page, ...usedList.filter((r) => !seen.has(r.id))];
  const decorated = await decorate(env, person, all);
  const byId = new Map(decorated.map((item) => [item.id, item]));
  const items = page.flatMap((r) => byId.get(r.id) ?? []);
  const out: { items: Item[]; nextCursor: string | null; mostUsed?: Item[] } = {
    items,
    nextCursor: more && last ? encodeCursor({ at: last.sort_at, id: last.id }) : null,
  };
  if (withUsed) {
    out.mostUsed = usedList.flatMap((r) => {
      const item = byId.get(r.id);
      return item ? [{ ...item, useDays: r.use_days }] : [];
    });
  }
  return out;
}
