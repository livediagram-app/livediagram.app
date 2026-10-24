// The Explorer's lists (`GET /items`, `GET /trash`): one query per page, keyset-paged, each driven by an
// index that starts with the person (their scopes, their opens, favourites or shared rows) or with one
// folder, so a page costs what the person holds, never the table. The plans are pinned by a test
// (lists.test.ts "query plans").

import {
  USE_WINDOW_DAYS,
  type App,
  type Item,
  type ItemOwner,
  type ItemSource,
  type ItemView,
  type MineCount,
} from '@liveworkspace/index-client';
import { personalScope, scopesOf, teamScope, type Person } from './auth';
import { containsPattern, encodeCursor, type Cursor } from './codec';
import type { Env } from './env';
import { decorate, ITEM_COLUMNS, LIVE_LINK, type ItemRow } from './rows';

// The Explorer's filters (its lens), checked by the route. Values of one combine with or.
export type ListFilters = {
  // The apps the items open in (the lens's Opens in).
  apps?: App[];
  // Search words: each in the title or the folder's name.
  words?: string[];
  source?: ItemSource[];
  since?: number;
  owner?: ItemOwner;
  // Last words of the creation intent.
  intent?: string[];
  // Where it lives: the person's own scope, reached through a link, or these joined teams.
  space?: { mine: boolean; shared: boolean; teams: string[] };
};

export type ListSpec = ListFilters & {
  view: ItemView;
  app?: App;
  // A folder the person can reach (checked by the route).
  folder?: string;
  // With `folder`: its subfolders' items too, at any depth.
  deep?: boolean;
  // Only these scopes (the `team` filter), or every scope the person has.
  scopes?: string[];
  limit: number;
  cursor?: Cursor;
  // Recent's first page only: also this many Most Used items, from the same request (Home's Jump Back In).
  used?: number;
  // A first page only: also how many live items are the person's own (My Work, in the app asked), counted up to
  // this many (Home's hero pill), and whether they can open anything at all there (Home's first run). Home's
  // three reads in one request.
  mine?: number;
  any?: boolean;
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
    // Jump Back In leaves out what the person hid from Recent, as Recent does.
    'COALESCE(o.hidden, 0) = 0',
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

// A folder and every folder under it, at any depth (the folders_parent index, a step per level).
const SUBTREE = `IN (WITH RECURSIVE sub(id) AS (SELECT ? UNION SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id)
  SELECT id FROM sub)`;

/**
 * The filters' clauses over `items i`, for every list and Shared With Me: each word in the title or the
 * folder's name (the person's own folders, so another's names find nothing), the source, the last change,
 * whose it is, the intent's last word, and where it lives.
 */
export function filterClauses(
  person: Person,
  filters: ListFilters,
): { where: string[]; args: unknown[] } {
  const where: string[] = [];
  const args: unknown[] = [];
  const allScopes = JSON.stringify(scopesOf(person));
  for (const word of filters.words ?? []) {
    const pattern = containsPattern(word);
    where.push(
      `(i.title LIKE ? ESCAPE '\\'
        OR i.folder_id IN (SELECT f.id FROM folders f WHERE f.scope ${IN_JSON} AND f.name LIKE ? ESCAPE '\\'))`,
    );
    args.push(pattern, allScopes, pattern);
  }
  if (filters.apps?.length) {
    where.push(`i.app ${IN_JSON}`);
    args.push(JSON.stringify(filters.apps));
  }
  if (filters.source?.length) {
    where.push(`i.source ${IN_JSON}`);
    args.push(JSON.stringify(filters.source));
  }
  if (filters.since !== undefined) {
    where.push('i.updated_at >= ?');
    args.push(filters.since);
  }
  if (filters.owner) {
    where.push(filters.owner === 'me' ? 'i.owner_id = ?' : 'i.owner_id <> ?');
    args.push(person.id);
  }
  if (filters.intent?.length) {
    // "plan:board:kanban" ends in "kanban"; a one-word intent is its own last word.
    where.push(
      `(${filters.intent.map(() => "(i.intent = ? OR i.intent LIKE '%:' || ?)").join(' OR ')})`,
    );
    for (const word of filters.intent) args.push(word, word);
  }
  if (filters.space) {
    const { mine, shared, teams } = filters.space;
    const scopes = [...(mine ? [personalScope(person.id)] : []), ...teams.map(teamScope)];
    const parts: string[] = [];
    if (scopes.length > 0) {
      parts.push(`i.scope ${IN_JSON}`);
      args.push(JSON.stringify(scopes));
    }
    if (shared) {
      parts.push(`i.scope NOT ${IN_JSON}`);
      args.push(allScopes);
    }
    where.push(parts.length > 0 ? `(${parts.join(' OR ')})` : '0');
  }
  return { where, args };
}

export function buildListQuery(person: Person, spec: ListSpec, now = Date.now()): BuiltQuery {
  const allScopes = JSON.stringify(scopesOf(person));
  const scopes = spec.scopes ? JSON.stringify(spec.scopes) : allScopes;
  const where: string[] = [];
  const args: unknown[] = [];
  // Bound before the WHERE's: the search view's gathering.
  const fromArgs: unknown[] = [];
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
        where.push(spec.deep ? `i.folder_id ${SUBTREE}` : 'i.folder_id = ?');
        args.push(spec.folder);
      } else {
        where.push(`i.scope ${IN_JSON}`);
        args.push(scopes);
      }
      where.push(spec.view === 'trash' ? 'i.trashed_at IS NOT NULL' : 'i.trashed_at IS NULL');
      if (spec.view === 'unsorted') where.push('i.folder_id IS NULL');
      break;
    case 'search':
      // Every live item the person can open: their scopes' (each scope's index), and those reached through a
      // live link (theirs), gathered first so neither side walks the other's rows; sorted after, so a page
      // costs what the person can reach.
      from = `(SELECT li.id FROM items li WHERE li.scope ${IN_JSON} AND li.trashed_at IS NULL
          UNION SELECT sw.item_id FROM shared_with sw JOIN share_links sl
            ON sl.code = sw.share_code AND sl.item_id = sw.item_id
            WHERE sw.person_id = ? AND ${LIVE_LINK('sl')}) reach
        JOIN items i ON i.id = reach.id`;
      where.push('i.trashed_at IS NULL');
      fromArgs.push(scopes, person.id, now);
      // One team, or only the person's own: what links reach lives elsewhere.
      if (spec.scopes) {
        where.push(`i.scope ${IN_JSON}`);
        args.push(scopes);
      }
      break;
    case 'recent':
      from = 'opens o JOIN items i ON i.id = o.item_id';
      sortCol = 'o.last_opened_at';
      idCol = 'o.item_id';
      // Hidden from Recent: the partial opens_recent index holds only the rest.
      where.push('o.person_id = ?', 'o.hidden = 0', 'i.trashed_at IS NULL');
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
    where.push(spec.deep ? `i.folder_id ${SUBTREE}` : 'i.folder_id = ?');
    args.push(spec.folder);
  }
  if (spec.app) {
    where.push('i.app = ?');
    args.push(spec.app);
  }
  const filters = filterClauses(person, spec);
  where.push(...filters.where);
  args.push(...filters.args);
  if (spec.cursor) {
    where.push(`(${sortCol}, ${idCol}) < (?, ?)`);
    args.push(spec.cursor.at, spec.cursor.id);
  }

  const sql = `SELECT ${ITEM_COLUMNS}, ${sortCol} AS sort_at FROM ${from}
    WHERE ${where.join(' AND ')}
    ORDER BY ${sortCol} DESC, ${idCol} DESC LIMIT ?`;
  args.push(spec.limit + 1);
  return { sql, args: [...fromArgs, ...args] };
}

export async function listItems(env: Env, person: Person, spec: ListSpec): Promise<ListAnswer> {
  const now = Date.now();
  const { sql, args } = buildListQuery(person, spec, now);
  const db = env.INDEX_DB;
  const first = !spec.cursor;
  const withUsed = spec.view === 'recent' && first && (spec.used ?? 0) > 0;
  const withMine = first && (spec.mine ?? 0) > 0;
  const withAny = first && spec.any === true;
  // The page, and what Home asks beside it, in one round trip; the items decorated together.
  const statements = [db.prepare(sql).bind(...args)];
  if (withUsed) {
    const used = buildMostUsedQuery(person, { ...spec, limit: spec.used! }, now);
    statements.push(db.prepare(used.sql).bind(...used.args));
  }
  const mineAt = statements.length;
  if (withMine) {
    const mine = buildMineCountQuery(person, spec.app, spec.mine!, now);
    statements.push(db.prepare(mine.sql).bind(...mine.args));
  }
  const anyAt = statements.length;
  if (withAny) {
    const any = buildAnyQuery(person, spec.app, now);
    statements.push(db.prepare(any.sql).bind(...any.args));
  }
  const answers = await db.batch(statements);
  const [listed, usedRows] = [answers[0], withUsed ? answers[1] : undefined] as [
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
  const out: ListAnswer = {
    items,
    nextCursor: more && last ? encodeCursor({ at: last.sort_at, id: last.id }) : null,
  };
  if (withUsed) {
    out.mostUsed = usedList.flatMap((r) => {
      const item = byId.get(r.id);
      return item ? [{ ...item, useDays: r.use_days }] : [];
    });
  }
  if (withMine) {
    const n = (answers[mineAt] as D1Result<{ n: number }>).results[0]?.n ?? 0;
    out.mine = { count: Math.min(n, spec.mine!), more: n > spec.mine! };
  }
  if (withAny) out.any = Boolean((answers[anyAt] as D1Result<{ found: number }>).results[0]?.found);
  return out;
}

export type ListAnswer = {
  items: Item[];
  nextCursor: string | null;
  mostUsed?: Item[];
  mine?: MineCount;
  any?: boolean;
};

/**
 * My Work's count: the person's own live items (their personal scope, in the app asked), the same rows My Work's
 * first page of `limit` would list, counted in SQL rather than sent. One more than the cap says there are more.
 */
export function buildMineCountQuery(
  person: Person,
  app: App | undefined,
  limit: number,
  now = Date.now(),
): BuiltQuery {
  const page = buildListQuery(
    person,
    { view: 'all', scopes: [personalScope(person.id)], limit, ...(app ? { app } : {}) },
    now,
  );
  return { sql: `SELECT COUNT(*) AS n FROM (${page.sql})`, args: page.args };
}

/** Whether the person can open anything at all (Search's reach, in the app asked): Home's first-run question. */
export function buildAnyQuery(person: Person, app: App | undefined, now = Date.now()): BuiltQuery {
  const page = buildListQuery(person, { view: 'search', limit: 1, ...(app ? { app } : {}) }, now);
  return { sql: `SELECT EXISTS (${page.sql}) AS found`, args: page.args };
}
