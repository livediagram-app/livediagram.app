// Who made a page and who last changed it (docs/specs/030-knowledgebase/verification.md "Created and Updated"): one
// row a page in the knowledgebase's own SQLite, `page_authors`. The first person whose write makes the page is its
// creator for good; every later write by a person moves "updated". A page that predates the table has no row until
// its next write, and then that writer counts as both (the rail shows what it knows, nothing it guesses).
import { holdsDraft, sameArticleValue, savedArticlesOf } from '@liveknowledge/document';
import type { DocumentEnv } from '../types';

type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts V17). Additive, IF NOT EXISTS; a deleted page takes its row with it. */
export function pageAuthorsSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_authors (
    tab TEXT PRIMARY KEY, created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL
  )`);
  exec(`CREATE TRIGGER IF NOT EXISTS page_authors_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_authors WHERE tab = OLD.id; END`);
}

/** The upsert for one person's write of a page: made by them when it is new to the table, updated by them always. */
export function pageAuthorStatement(
  env: DocumentEnv,
  tab: string,
  by: string,
  at: number,
): D1PreparedStatement {
  return env.DOCUMENT_DB.prepare(
    `INSERT INTO page_authors (tab, created_by, created_at, updated_by, updated_at) VALUES (?1, ?2, ?3, ?2, ?3)
     ON CONFLICT (tab) DO UPDATE SET updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  ).bind(tab, by, at);
}

/**
 * Whether a save changed the page a reader reads (docs/specs/030-knowledgebase/editing.md "Save"): a draft's
 * autosave is nobody's update until Save puts it in the saved writing. With no draft either side, every write
 * counts, as it always did; with one, the name, the saved writing or the objects must have moved.
 */
export function savedPageChanged(
  before: { name: string; elements: unknown; articles?: unknown; draft?: unknown } | null,
  after: { name: string; elements: unknown; articles?: unknown; draft?: unknown },
): boolean {
  if (!before || (!holdsDraft(before) && !holdsDraft(after))) return true;
  if (before.name !== after.name) return true;
  if (!sameArticleValue(savedArticlesOf(before), savedArticlesOf(after))) return true;
  return !sameArticleValue(before.elements, after.elements);
}

/** Note a write; a failure is logged and never fails the write it follows. */
export async function notePageWrite(
  env: DocumentEnv,
  tab: string,
  by: string,
  at = Date.now(),
): Promise<void> {
  try {
    await pageAuthorStatement(env, tab, by, at).run();
  } catch (err) {
    console.warn('[knowledge] page author not noted', { tabId: tab, err: String(err) });
  }
}

/** Note one person's making of many pages at once (a create that seeds them), in one batch. */
export async function notePageWrites(
  env: DocumentEnv,
  tabs: readonly string[],
  by: string,
  at: number,
): Promise<void> {
  try {
    await env.DOCUMENT_DB.batch(tabs.map((tab) => pageAuthorStatement(env, tab, by, at)));
  } catch (err) {
    console.warn('[knowledge] page authors not noted', { pages: tabs.length, err: String(err) });
  }
}

export type PageAuthors = {
  created: { by: string; at: number };
  updated: { by: string; at: number };
};

export async function readPageAuthors(env: DocumentEnv, tab: string): Promise<PageAuthors | null> {
  const row = await env.DOCUMENT_DB.prepare(
    'SELECT created_by, created_at, updated_by, updated_at FROM page_authors WHERE tab = ?',
  )
    .bind(tab)
    .first<{ created_by: string; created_at: number; updated_by: string; updated_at: number }>();
  if (!row) return null;
  return {
    created: { by: row.created_by, at: row.created_at },
    updated: { by: row.updated_by, at: row.updated_at },
  };
}
