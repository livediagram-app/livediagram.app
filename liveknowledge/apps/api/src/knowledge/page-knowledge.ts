// A page's knowledge fields in storage (docs/specs/030-knowledgebase/verification.md "The fields"): read from the
// tab's body (`Tab.knowledge`), written back into it with the tab's revision advanced, as a rename or a move is
// (document-room/page-tree-store.ts). The write marks the page for the index (knowledge-schema.ts), which settles
// its trust row in the same transaction. The print "Changed since verified" compares against is kept beside it.
import {
  changedSincePrint,
  tokensOfChars,
  openWritingPrint,
  parseKnowledgeFields,
  sealWritingPrint,
  trustState,
  writingPrint,
  writingText,
  type KnowledgeFields,
  type ReviewEvery,
} from '@liveknowledge/knowledge';
import type { PageKnowledge } from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { pageSourceOf } from './knowledge-index';

export type StoredPageKnowledge = {
  tab: string;
  title: string;
  rev: number;
  fields: KnowledgeFields;
  /** The page's writing as words, no Markdown syntax. */
  text: string;
  /** The characters of the page's passages, as the index counted them: its size against the context budget. */
  chars: number;
  /** The writing's print when the page was last verified, as stored; null for none. */
  print: string | null;
};

/** A page's fields, writing and stored print; null for no such page, or one whose body cannot be read. */
export async function readPageKnowledge(
  env: DocumentEnv,
  documentId: string,
  tab: string,
): Promise<StoredPageKnowledge | null> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT t.name AS name, t.data AS data, t.rev AS rev,
            (SELECT verified_print FROM knowledge_pages k WHERE k.tab = t.id) AS print,
            (SELECT chars FROM knowledge_pages k WHERE k.tab = t.id) AS chars
       FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.document_id = ? AND t.id = ?`,
  )
    .bind(documentId, tab)
    .first<{
      name: string;
      data: string;
      rev: number;
      print: string | null;
      chars: number | null;
    }>();
  if (!row) return null;
  try {
    const source = pageSourceOf(tab, row.name, row.data);
    return {
      tab,
      title: row.name,
      rev: row.rev,
      fields: source.fields,
      text: writingText({ blocks: source.blocks }),
      print: row.print,
      chars: row.chars ?? 0,
    };
  } catch {
    return null;
  }
}

/** The fields as a client reads them, with the state the knowledgebase's Review Period and the clock give them. */
export function pageKnowledgeOf(
  page: StoredPageKnowledge,
  every: ReviewEvery,
  now: number,
): PageKnowledge {
  const state = trustState(page.fields, every, now);
  const print = page.fields.verifiedAt === undefined ? undefined : openWritingPrint(page.print);
  return {
    tab: page.tab,
    ...page.fields,
    state: state.state,
    ...('reviewAt' in state && state.reviewAt !== undefined ? { reviewAt: state.reviewAt } : {}),
    changedSinceVerified: print ? changedSincePrint(print, page.text) : false,
    tokens: tokensOfChars(page.chars),
  };
}

/**
 * Write a page's fields at the revision they were read at. `verified`: the page was just verified, so the
 * writing's print is kept for "Changed since verified" (at most 104 KB, changed-since.ts). Answers the new
 * revision, or null when the tab moved since the read (the caller reads again).
 */
export async function writePageKnowledge(
  env: DocumentEnv,
  page: StoredPageKnowledge,
  next: KnowledgeFields,
  opts: { verified?: boolean; now?: number } = {},
): Promise<number | null> {
  const fields = parseKnowledgeFields(next);
  const now = opts.now ?? Date.now();
  const db = env.DOCUMENT_DB;
  const empty = Object.keys(fields).length === 0;
  const write = empty
    ? db
        .prepare(
          `UPDATE tabs SET data = json_remove(data, '$.knowledge'), rev = rev + 1, updated_at = ?
            WHERE id = ? AND rev = ? AND json_valid(data) RETURNING rev`,
        )
        .bind(now, page.tab, page.rev)
    : db
        .prepare(
          `UPDATE tabs SET data = json_set(data, '$.knowledge', json(?)), rev = rev + 1, updated_at = ?
            WHERE id = ? AND rev = ? AND json_valid(data) RETURNING rev`,
        )
        .bind(JSON.stringify(fields), now, page.tab, page.rev);
  const statements = [write];
  if (opts.verified)
    statements.push(
      // An empty index hash, so a page never indexed is indexed by this write's settle.
      db
        .prepare(
          `INSERT INTO knowledge_pages (tab, index_hash, trust_hash, chars, verified_print)
             SELECT ?, '', '', 0, ? WHERE EXISTS (SELECT 1 FROM tabs WHERE id = ? AND rev = ?)
             ON CONFLICT (tab) DO UPDATE SET verified_print = excluded.verified_print`,
        )
        .bind(page.tab, sealWritingPrint(writingPrint(page.text)), page.tab, page.rev + 1),
    );
  const results = await db.batch(statements);
  const rev = (results[0]?.results?.[0] as { rev?: number } | undefined)?.rev;
  return typeof rev === 'number' ? rev : null;
}

/** A whole-tab save never changes the page's knowledge fields: what is stored stays, and a save of a tab that has
 *  none (a new page, too) carries none in. Verify and the Page Health card write them (routes/knowledge-page-routes). */
export function keepStoredKnowledge(
  body: { knowledge?: unknown },
  stored: { knowledge?: unknown } | null,
): void {
  if (stored && stored.knowledge !== undefined) body.knowledge = stored.knowledge;
  else delete body.knowledge;
}
