// Who watches which page, in the knowledgebase's own SQLite (docs/specs/030-knowledgebase/watching.md; blueprint
// watching.md): one row a person a page in `page_watchers`, `page` for the page alone or `section` for it and every
// page under it, never in the page's body. Watching is no edit, so it writes through the database that notes nothing
// (knowledgeDb). A page deleted for good takes its watches with it; a closed account's are removed
// (document-anonymise.ts). What changed on a watched page is `watch_updates` (watch-notes.ts), made here too.
import {
  WATCHES_PER_KNOWLEDGEBASE_MAX,
  type PageWatchResponse,
  type PageWatchScope,
} from '@liveknowledge/api-schema';
import { pageParents, type TreePage } from '@liveknowledge/document';
import type { DocumentEnv } from '../types';
import { knowledgeDb } from './knowledge-db';

type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts V41). Additive, IF NOT EXISTS. */
export function pageWatchSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_watchers (
    tab TEXT NOT NULL, person TEXT NOT NULL, scope TEXT NOT NULL CHECK (scope IN ('page', 'section')),
    at INTEGER NOT NULL, PRIMARY KEY (tab, person)
  )`);
  exec('CREATE INDEX IF NOT EXISTS page_watchers_person ON page_watchers (person)');
  exec(`CREATE TRIGGER IF NOT EXISTS page_watchers_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_watchers WHERE tab = OLD.id; END`);
  exec(`CREATE TABLE IF NOT EXISTS watch_updates (
    id TEXT PRIMARY KEY, tab TEXT NOT NULL, tab_name TEXT NOT NULL, kinds TEXT NOT NULL, actors TEXT NOT NULL,
    actor_ids TEXT NOT NULL, count INTEGER NOT NULL, first_at INTEGER NOT NULL, latest_at INTEGER NOT NULL
  )`);
  exec('CREATE INDEX IF NOT EXISTS watch_updates_tab ON watch_updates (tab, first_at)');
  exec('CREATE INDEX IF NOT EXISTS watch_updates_latest ON watch_updates (latest_at)');
  exec(`CREATE TRIGGER IF NOT EXISTS watch_updates_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM watch_updates WHERE tab = OLD.id; END`);
}

export type WatchRow = { tab: string; person: string; scope: PageWatchScope; at: number };

/** Every watch in the knowledgebase (at most WATCHES_PER_KNOWLEDGEBASE_MAX rows). */
export async function allWatches(env: DocumentEnv): Promise<WatchRow[]> {
  const { results } = await knowledgeDb(env)
    .prepare('SELECT tab, person, scope, at FROM page_watchers ORDER BY at, rowid')
    .all<WatchRow>();
  return results ?? [];
}

/** Whether the knowledgebase has any watch: the one read a change pays when nobody watches. */
export async function anyWatch(env: DocumentEnv): Promise<boolean> {
  const row = await knowledgeDb(env)
    .prepare('SELECT 1 AS one FROM page_watchers LIMIT 1')
    .first<{ one: number }>();
  return row !== null;
}

/** The page and the pages above it, nearest first. */
export function pageAndAncestors(
  parents: ReadonlyMap<string, string | undefined>,
  tab: string,
): string[] {
  const out = [tab];
  for (let at = parents.get(tab); at !== undefined && !out.includes(at); at = parents.get(at))
    out.push(at);
  return out;
}

/** Everyone whose watch covers the page (its own, of any scope, or a section above it), with the time of the
 *  earliest watch that does. */
export function coveringWatchers(
  rows: readonly WatchRow[],
  parents: ReadonlyMap<string, string | undefined>,
  tab: string,
): Map<string, number> {
  const above = new Set(pageAndAncestors(parents, tab).slice(1));
  const out = new Map<string, number>();
  for (const row of rows) {
    if (row.tab !== tab && !(row.scope === 'section' && above.has(row.tab))) continue;
    const had = out.get(row.person);
    if (had === undefined || row.at < had) out.set(row.person, row.at);
  }
  return out;
}

/** A tree's parents, for pages as the document lists them. */
export const parentsOf = (pages: readonly TreePage[]) => pageParents(pages);

/** What a person's watch of the page reads as: its own, else the nearest section above that covers it. */
export function watchOf(
  own: readonly Pick<WatchRow, 'tab' | 'scope'>[],
  parents: ReadonlyMap<string, string | undefined>,
  tab: string,
  nameOf: (tab: string) => string,
): Pick<PageWatchResponse, 'watching' | 'through'> {
  const byTab = new Map(own.map((row) => [row.tab, row.scope]));
  const mine = byTab.get(tab);
  if (mine) return { watching: mine, through: null };
  for (const above of pageAndAncestors(parents, tab).slice(1))
    if (byTab.get(above) === 'section')
      return { watching: null, through: { tab: above, name: nameOf(above) } };
  return { watching: null, through: null };
}

/** A person's own watches, every page. */
export async function watchesOf(env: DocumentEnv, person: string): Promise<WatchRow[]> {
  const { results } = await knowledgeDb(env)
    .prepare('SELECT tab, person, scope, at FROM page_watchers WHERE person = ?')
    .bind(person)
    .all<WatchRow>();
  return results ?? [];
}

/** How many people's watches cover the page, once each: one indexed read. */
export async function watcherCount(
  env: DocumentEnv,
  parents: ReadonlyMap<string, string | undefined>,
  tab: string,
): Promise<number> {
  const above = pageAndAncestors(parents, tab).slice(1);
  const row = await knowledgeDb(env)
    .prepare(
      `SELECT COUNT(DISTINCT person) AS n FROM page_watchers
        WHERE tab = ?1 OR (scope = 'section' AND tab IN (SELECT value FROM json_each(?2)))`,
    )
    .bind(tab, JSON.stringify(above))
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export type WatchOutcome = { refusal: 'watchers_full' } | { changed: boolean };

/** Set the person's watch of the page: `scope`, or none. `changed` is false when it already stood so. */
export async function setPageWatch(
  env: DocumentEnv,
  tab: string,
  person: string,
  scope: PageWatchScope | null,
  now: number,
): Promise<WatchOutcome> {
  const db = knowledgeDb(env);
  if (scope === null) {
    const res = await db
      .prepare('DELETE FROM page_watchers WHERE tab = ? AND person = ?')
      .bind(tab, person)
      .run();
    return { changed: (res.meta.changes ?? 0) > 0 };
  }
  // One statement: a new row only while the knowledgebase holds fewer than the bound; a held row changes its scope.
  const res = await db
    .prepare(
      `INSERT INTO page_watchers (tab, person, scope, at)
         SELECT ?1, ?2, ?3, ?4
          WHERE EXISTS (SELECT 1 FROM page_watchers WHERE tab = ?1 AND person = ?2)
             OR (SELECT COUNT(*) FROM page_watchers) < ?5
       ON CONFLICT (tab, person) DO UPDATE SET scope = excluded.scope WHERE page_watchers.scope != excluded.scope`,
    )
    .bind(tab, person, scope, now, WATCHES_PER_KNOWLEDGEBASE_MAX)
    .run();
  if ((res.meta.changes ?? 0) > 0) return { changed: true };
  const held = await db
    .prepare('SELECT 1 AS one FROM page_watchers WHERE tab = ? AND person = ?')
    .bind(tab, person)
    .first<{ one: number }>();
  return held ? { changed: false } : { refusal: 'watchers_full' };
}

/** Remove every watch of these people (they no longer reach the knowledgebase): how many went. */
export async function dropWatchers(env: DocumentEnv, people: readonly string[]): Promise<number> {
  if (people.length === 0) return 0;
  const res = await knowledgeDb(env)
    .prepare('DELETE FROM page_watchers WHERE person IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(people))
    .run();
  return res.meta.changes ?? 0;
}
