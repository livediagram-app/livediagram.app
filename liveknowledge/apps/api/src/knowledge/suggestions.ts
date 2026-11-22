// Agents' edits waiting for an Editor (docs/specs/030-knowledgebase/ai-knowledge.md "Edits suggested by agents";
// docs/specs/024-agents/blueprints/knowledgebase-for-agents.md "Suggestions"): the `suggestions` table of the
// knowledgebase's room. A suggestion is a passage of the page's Markdown replaced by another, or Markdown appended.
// It changes nothing until an Editor accepts it, so it is bookkeeping, written through the handle that notes no
// edit (knowledge-db.ts).
import type { SqlStatement } from '@liveknowledge/knowledge';
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { knowledgeDb, rowsOf, runAll, sqlOf } from './knowledge-db';

/** The most a knowledgebase holds waiting: past it an agent is told to wait for an Editor. */
export const SUGGESTIONS_MAX_PENDING = 50;
/** The most one suggestion holds: its reason, the passage it replaces and what it puts there, together. */
export const SUGGESTION_MAX_CHARS = 20_000;
export const SUGGESTION_MAX_REASON_CHARS = 500;
/** A suggestion nobody decided about goes after this long. */
export const SUGGESTION_KEPT_DAYS = 90;

const DAY_MS = 86_400_000;
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

export type StoredSuggestion = Omit<KnowledgeSuggestion, 'title' | 'summary'>;

/** `sg_` and 10 characters of lowercase Crockford base32, as a changeset's id is minted. */
export function mintSuggestionId(): string {
  let id = 'sg_';
  for (const byte of crypto.getRandomValues(new Uint8Array(10))) id += ALPHABET[byte & 31];
  return id;
}

const COLUMNS = 'id, tab, agent, reason, kind, before, after, created_at AS createdAt';
const freshSince = (now: number) => now - SUGGESTION_KEPT_DAYS * DAY_MS;

/** The pending suggestions, newest first: at most the cap, and none past its keep. */
export const listSuggestions = (env: DocumentEnv, now: number): Promise<StoredSuggestion[]> =>
  rowsOf<StoredSuggestion>(
    env,
    sqlOf(
      `SELECT ${COLUMNS} FROM suggestions WHERE created_at > ? ORDER BY created_at DESC, id LIMIT ?`,
      freshSince(now),
      SUGGESTIONS_MAX_PENDING,
    ),
  );

/** One page's pending suggestions, newest first, for its Page Health read (ai-knowledge.md "On the page"): on the
 *  `suggestions_tab` index, at most the knowledgebase's cap. */
export const listPageSuggestions = (
  env: DocumentEnv,
  tab: string,
  now: number,
): Promise<StoredSuggestion[]> =>
  rowsOf<StoredSuggestion>(
    env,
    sqlOf(
      `SELECT ${COLUMNS} FROM suggestions WHERE tab = ? AND created_at > ? ORDER BY created_at DESC, id LIMIT ?`,
      tab,
      freshSince(now),
      SUGGESTIONS_MAX_PENDING,
    ),
  );

/** How many suggestions wait on each page, for the page tree's dots: one grouped read of a table of at most the cap's
 *  rows. Pages with none are not listed. */
export async function countSuggestionsByPage(
  env: DocumentEnv,
  now: number,
): Promise<Map<string, number>> {
  const rows = await rowsOf<{ tab: string; pending: number }>(
    env,
    sqlOf(
      'SELECT tab, COUNT(*) AS pending FROM suggestions WHERE created_at > ? GROUP BY tab',
      freshSince(now),
    ),
  );
  return new Map(rows.map((r) => [r.tab, r.pending]));
}

export async function countSuggestions(env: DocumentEnv, now: number): Promise<number> {
  const [row] = await rowsOf<{ pending: number }>(
    env,
    sqlOf('SELECT COUNT(*) AS pending FROM suggestions WHERE created_at > ?', freshSince(now)),
  );
  return row?.pending ?? 0;
}

export async function readSuggestion(
  env: DocumentEnv,
  id: string,
  now: number,
): Promise<StoredSuggestion | null> {
  const [row] = await rowsOf<StoredSuggestion>(
    env,
    sqlOf(
      `SELECT ${COLUMNS} FROM suggestions WHERE id = ? AND created_at > ?`,
      id,
      freshSince(now),
    ),
  );
  return row ?? null;
}

/** Keep a suggestion unless the knowledgebase is full: the count and the insert are one statement, so two agents
 *  at once never pass the cap. False when it was not kept. */
export async function addSuggestion(env: DocumentEnv, s: StoredSuggestion): Promise<boolean> {
  const done = await knowledgeDb(env)
    .prepare(
      `INSERT INTO suggestions (id, tab, agent, reason, kind, before, after, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT COUNT(*) FROM suggestions WHERE created_at > ?) < ?`,
    )
    .bind(
      s.id,
      s.tab,
      s.agent,
      s.reason,
      s.kind,
      s.before,
      s.after,
      s.createdAt,
      freshSince(s.createdAt),
      SUGGESTIONS_MAX_PENDING,
    )
    .run();
  return (done.meta.changes ?? 0) > 0;
}

export const removeSuggestion = (env: DocumentEnv, id: string): Promise<void> =>
  runAll(env, [sqlOf('DELETE FROM suggestions WHERE id = ?', id)]);

/** The daily prune: suggestions past their keep, and those of pages that are gone. */
export const pruneSuggestions = (now: number): SqlStatement[] => [
  sqlOf('DELETE FROM suggestions WHERE created_at <= ?', freshSince(now)),
  sqlOf('DELETE FROM suggestions WHERE tab NOT IN (SELECT id FROM tabs)'),
];

/** A suggestion as a client reads it; `summary` is the reason's first line. */
export const suggestionOf = (s: StoredSuggestion, title: string): KnowledgeSuggestion => ({
  ...s,
  title,
  summary: s.reason.split('\n')[0]!.slice(0, 120),
});
