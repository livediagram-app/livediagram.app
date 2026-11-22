// Everyone who has made or changed a page (docs/specs/030-knowledgebase/page-surface.md "Who made the page"; owner,
// 2026-11-21: "the avatars of everybody who has created or edited that page, creator first, then all the editors"):
// one row a page and writer in the knowledgebase's own SQLite, `page_editors`, beside page_authors' creator and last
// change. A person is one row whatever they change; each agent is its own row. Written with every page write that
// page_authors notes, in the same batch; read with Page Health, the first writer first, at most PAGE_EDITORS_MAX.
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { stampOf, type PageWriter } from './page-writer';

type Exec = (query: string) => unknown;

/** How many writers Page Health names, the earliest first (the header shows them as a stack of discs). */
export const PAGE_EDITORS_MAX = 12;

/** The schema step (document-schema.ts V33). Additive, IF NOT EXISTS; a deleted page takes its rows with it. */
export function pageEditorsSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_editors (
    tab TEXT NOT NULL, who TEXT NOT NULL, by TEXT NOT NULL, kind TEXT NOT NULL, agent TEXT,
    first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY (tab, who)
  )`);
  exec(`CREATE TRIGGER IF NOT EXISTS page_editors_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_editors WHERE tab = OLD.id; END`);
}

/** A writer's row key: a person by their id, an agent by its name (two agents through one account are two rows). */
export const editorKey = (w: PageWriter): string =>
  w.kind === 'ai' ? `ai:${w.agent ?? ''}` : w.by;

export function pageEditorStatement(
  env: DocumentEnv,
  tab: string,
  w: PageWriter,
  at: number,
): D1PreparedStatement {
  return env.DOCUMENT_DB.prepare(
    `INSERT INTO page_editors (tab, who, by, kind, agent, first_at, last_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
     ON CONFLICT (tab, who) DO UPDATE SET by = excluded.by, last_at = excluded.last_at`,
  ).bind(tab, editorKey(w), w.by, w.kind, w.agent ?? null, at);
}

type EditorRow = { by: string; kind: string; agent: string | null; first_at: number };

/** The page's writers, the first first; none for a page not written since the table began. */
export async function readPageEditors(env: DocumentEnv, tab: string): Promise<PageAuthorStamp[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT by, kind, agent, first_at FROM page_editors WHERE tab = ? ORDER BY first_at, who LIMIT ?`,
  )
    .bind(tab, PAGE_EDITORS_MAX)
    .all<EditorRow>();
  return results.map((r) => stampOf(r.by, r.first_at, r.kind, r.agent, null));
}
