// A page's comment threads in the knowledgebase's own SQLite (docs/specs/030-knowledgebase/page-comments.md "What a
// thread is"): one row a thread in `page_threads`, its comments as JSON, never in the page's body. A comment is no
// edit of the page, so the writes go through the database that notes nothing (knowledgeDb): no revision, no History,
// no outbox. Each write is guarded on the thread's own revision, so two changes to one thread never lose either;
// a deleted page takes its threads with it.
import { PAGE_THREADS_MAX } from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { knowledgeDb } from './knowledge-db';
import type { StoredComment, StoredThread } from './page-thread-changes';

type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts). Additive, IF NOT EXISTS. */
export function pageThreadsSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_threads (
    tab TEXT NOT NULL, id TEXT NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, resolved_by TEXT NULL,
    resolved_at INTEGER NULL, comments TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (tab, id)
  )`);
  exec(`CREATE TRIGGER IF NOT EXISTS page_threads_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_threads WHERE tab = OLD.id; END`);
}

type Row = {
  tab: string;
  id: string;
  created_at: number;
  created_by: string;
  updated_at: number;
  resolved: number;
  resolved_by: string | null;
  resolved_at: number | null;
  comments: string;
  rev: number;
};

const COLUMNS =
  'tab, id, created_at, created_by, updated_at, resolved, resolved_by, resolved_at, comments, rev';

function threadOf(row: Row): StoredThread | null {
  let comments: unknown;
  try {
    comments = JSON.parse(row.comments);
  } catch {
    return null;
  }
  if (!Array.isArray(comments) || comments.length === 0) return null;
  return {
    id: row.id,
    tab: row.tab,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    resolved: row.resolved === 1,
    ...(row.resolved === 1 && row.resolved_by ? { resolvedBy: row.resolved_by } : {}),
    ...(row.resolved === 1 && row.resolved_at !== null ? { resolvedAt: row.resolved_at } : {}),
    rev: row.rev,
    comments: comments as StoredComment[],
  };
}

/** Every thread on the page, oldest first; a row whose comments do not read is left out. */
export async function readPageThreads(env: DocumentEnv, tab: string): Promise<StoredThread[]> {
  const rows = await knowledgeDb(env)
    .prepare(`SELECT ${COLUMNS} FROM page_threads WHERE tab = ? ORDER BY created_at, id`)
    .bind(tab)
    .all<Row>();
  return (rows.results ?? []).flatMap((row) => threadOf(row) ?? []);
}

/** Every thread of the knowledgebase (one room is one knowledgebase), by page then oldest first: the data export's. */
export async function readAllPageThreads(env: DocumentEnv): Promise<StoredThread[]> {
  const rows = await knowledgeDb(env)
    .prepare(`SELECT ${COLUMNS} FROM page_threads ORDER BY tab, created_at, id`)
    .all<Row>();
  return (rows.results ?? []).flatMap((row) => threadOf(row) ?? []);
}

export async function readPageThread(
  env: DocumentEnv,
  tab: string,
  id: string,
): Promise<StoredThread | null> {
  const row = await knowledgeDb(env)
    .prepare(`SELECT ${COLUMNS} FROM page_threads WHERE tab = ? AND id = ?`)
    .bind(tab, id)
    .first<Row>();
  return row ? threadOf(row) : null;
}

/** Whether the page has room for another thread. */
export async function hasRoomForThread(env: DocumentEnv, tab: string): Promise<boolean> {
  const row = await knowledgeDb(env)
    .prepare('SELECT COUNT(*) AS n FROM page_threads WHERE tab = ?')
    .bind(tab)
    .first<{ n: number }>();
  return (row?.n ?? 0) < PAGE_THREADS_MAX;
}

/**
 * Write the thread at the revision it was read at (0 for a new one). Answers false when someone else changed it
 * first (the caller reads again), or when the page is gone.
 */
export async function writePageThread(env: DocumentEnv, thread: StoredThread): Promise<boolean> {
  const db = knowledgeDb(env);
  const comments = JSON.stringify(thread.comments);
  const resolvedBy = thread.resolved ? (thread.resolvedBy ?? null) : null;
  const resolvedAt = thread.resolved ? (thread.resolvedAt ?? null) : null;
  const result =
    thread.rev === 0
      ? await db
          .prepare(
            `INSERT INTO page_threads (${COLUMNS})
               SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1 WHERE EXISTS (SELECT 1 FROM tabs WHERE id = ?1)
             ON CONFLICT (tab, id) DO NOTHING`,
          )
          .bind(
            thread.tab,
            thread.id,
            thread.createdAt,
            thread.createdBy,
            thread.updatedAt,
            thread.resolved ? 1 : 0,
            resolvedBy,
            resolvedAt,
            comments,
          )
          .run()
      : await db
          .prepare(
            `UPDATE page_threads SET updated_at = ?, resolved = ?, resolved_by = ?, resolved_at = ?, comments = ?,
                    rev = rev + 1
              WHERE tab = ? AND id = ? AND rev = ?`,
          )
          .bind(
            thread.updatedAt,
            thread.resolved ? 1 : 0,
            resolvedBy,
            resolvedAt,
            comments,
            thread.tab,
            thread.id,
            thread.rev,
          )
          .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** Remove the thread at the revision it was read at; false when it changed first. */
export async function deletePageThread(env: DocumentEnv, thread: StoredThread): Promise<boolean> {
  const result = await knowledgeDb(env)
    .prepare('DELETE FROM page_threads WHERE tab = ? AND id = ? AND rev = ?')
    .bind(thread.tab, thread.id, thread.rev)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
