// Who made a page and who last changed it (docs/specs/030-knowledgebase/verification.md "Created and Updated"): one
// row a page in the knowledgebase's own SQLite, `page_authors`. The first person whose write makes the page is its
// creator for good; every later write by a person moves "updated". A page that predates the table has no row until
// its next write, and then that writer counts as both (the rail shows what it knows, nothing it guesses). Each stamp
// also says whether a person or an agent made it (page-writer.ts, schema step V18).
import { holdsDraft, sameArticleValue, savedArticlesOf } from '@liveknowledge/document';
import type { DocumentEnv } from '../types';
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { personWriter, stampOf, type PageWriter } from './page-writer';

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

/** The upsert for one write of a page, by a person (a bare id) or a writer: made by them when it is new to the
 *  table, updated by them always. */
export function pageAuthorStatement(
  env: DocumentEnv,
  tab: string,
  by: string | PageWriter,
  at: number,
): D1PreparedStatement {
  const w = typeof by === 'string' ? personWriter(by) : by;
  return env.DOCUMENT_DB.prepare(
    `INSERT INTO page_authors (tab, created_by, created_at, created_kind, created_agent, created_via,
                               updated_by, updated_at, updated_kind, updated_agent, updated_via)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (tab) DO UPDATE SET updated_by = excluded.updated_by, updated_at = excluded.updated_at,
       updated_kind = excluded.updated_kind, updated_agent = excluded.updated_agent,
       updated_via = excluded.updated_via`,
  ).bind(tab, w.by, at, w.kind, w.agent ?? null, w.via ?? null);
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
  by: string | PageWriter,
  at = Date.now(),
): Promise<void> {
  try {
    await pageAuthorStatement(env, tab, by, at).run();
  } catch (err) {
    console.warn('[knowledge] page author not noted', { tabId: tab, err: String(err) });
  }
}

/** Note one writer's making of many pages at once (a create that seeds them), in one batch. */
export async function notePageWrites(
  env: DocumentEnv,
  tabs: readonly string[],
  by: string | PageWriter,
  at: number,
): Promise<void> {
  try {
    await env.DOCUMENT_DB.batch(tabs.map((tab) => pageAuthorStatement(env, tab, by, at)));
  } catch (err) {
    console.warn('[knowledge] page authors not noted', { pages: tabs.length, err: String(err) });
  }
}

export type PageAuthors = { created: PageAuthorStamp; updated: PageAuthorStamp };

type AuthorsRow = Record<
  'created_by' | 'updated_by' | `${'created' | 'updated'}_${'kind' | 'agent' | 'via'}`,
  string | null
> & { created_at: number; updated_at: number };

export async function readPageAuthors(env: DocumentEnv, tab: string): Promise<PageAuthors | null> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT created_by, created_at, created_kind, created_agent, created_via,
            updated_by, updated_at, updated_kind, updated_agent, updated_via
       FROM page_authors WHERE tab = ?`,
  )
    .bind(tab)
    .first<AuthorsRow>();
  if (!row) return null;
  return {
    created: stampOf(
      String(row.created_by),
      row.created_at,
      row.created_kind,
      row.created_agent,
      row.created_via,
    ),
    updated: stampOf(
      String(row.updated_by),
      row.updated_at,
      row.updated_kind,
      row.updated_agent,
      row.updated_via,
    ),
  };
}
