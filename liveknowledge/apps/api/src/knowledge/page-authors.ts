// Who made a page and who last changed it (docs/specs/030-knowledgebase/verification.md "Created and Updated"): one
// row a page in the knowledgebase's own SQLite, `page_authors`. The first person whose write makes the page is its
// creator for good; every later write by a person moves "updated". A page that predates the table has no row until
// its next write, and then that writer counts as both (the rail shows what it knows, nothing it guesses).
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
