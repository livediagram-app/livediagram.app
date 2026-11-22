// What the Knowledgebase Reviews emails remember, so their caps hold across alarms and requests (docs/specs/
// 030-knowledgebase/verification.md "Reminders"): `knowledge_email_marks`, a row a kind and key with one time.
//
//   kind `review-page`,  key the page:      the verification (`verifiedAt`) whose review its owner was last told of
//   kind `review-owner`, key the owner:     when that owner was last sent a Review Due email (one a day)
//   kind `remind`,       key `owners`:      when an Editor last reminded the owners (one a week)
//   kind `ask`,          key the conflict:  when both owners were asked (once a conflict)
//   kind `rule-review`,  key the page:      the verification a Review Due rule was last started for (key '': when
//                                           the first check was), document-room/automations/review-events.ts
//
// Ids and times only: no address and no words. The day's total of emails is a `usage_counters` row (the scope
// `emails`), pruned with the other counters. Written through `knowledgeDb`: none of it is an edit.
import { dayOf, insertRows } from '@liveknowledge/knowledge';
import type { DocumentEnv } from '../types';
import { knowledgeDb, runAll } from './knowledge-db';

/** The most Knowledgebase Reviews emails one knowledgebase sends in a UTC day, all three kinds together. Safe
 *  range 10 to 200: under it a team of owners is cut short, over it a scripted Editor can fill inboxes. */
export const KNOWLEDGE_EMAILS_PER_DAY = 50;
const EMAILS_SCOPE = 'emails';

export type MarkKind = 'review-page' | 'review-owner' | 'remind' | 'ask' | 'rule-review';
type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts STEPS). A knowledgebase that already holds verified pages is owed its first
 *  review check, so a page that came due before this step is told of once. */
export function emailMarksSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS knowledge_email_marks (
    kind TEXT NOT NULL, key TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (kind, key)
  )`);
  exec(`INSERT OR IGNORE INTO knowledge_work (kind, key, due_at, payload)
    SELECT 'review-email', 'daily', 0, ''
     WHERE EXISTS (SELECT 1 FROM page_trust WHERE verified_at IS NOT NULL)`);
}

/** Every mark of a kind, by key: at most a row a page, an owner or a conflict. */
export async function marksOf(env: DocumentEnv, kind: MarkKind): Promise<Map<string, number>> {
  const { results } = await knowledgeDb(env)
    .prepare('SELECT key, at FROM knowledge_email_marks WHERE kind = ?')
    .bind(kind)
    .all<{ key: string; at: number }>();
  return new Map((results ?? []).map((row) => [row.key, row.at]));
}

/** Take a mark at `now` unless one newer than `notSince` stands: true when it was taken. One statement, so two
 *  presses at once send one email. `notSince` null takes it only when there is none. */
export async function claimMark(
  env: DocumentEnv,
  kind: MarkKind,
  key: string,
  now: number,
  notSince: number | null,
): Promise<boolean> {
  const done = await knowledgeDb(env)
    .prepare(
      `INSERT INTO knowledge_email_marks (kind, key, at) VALUES (?, ?, ?)
         ON CONFLICT (kind, key) DO UPDATE SET at = excluded.at WHERE ? AND knowledge_email_marks.at <= ?`,
    )
    .bind(kind, key, now, notSince === null ? 0 : 1, notSince ?? 0)
    .run();
  return (done.meta.changes ?? 0) > 0;
}

/** Give a claimed mark back (nothing could be sent after all), so the next try is not refused. */
export async function dropMark(env: DocumentEnv, kind: MarkKind, key: string): Promise<void> {
  await knowledgeDb(env)
    .prepare('DELETE FROM knowledge_email_marks WHERE kind = ? AND key = ?')
    .bind(kind, key)
    .run();
}

/** Set many marks of a kind (the pages an owner was told about): batched under the 100 bound values a statement
 *  takes, so 500 pages are 16 statements in one transaction. */
export async function putMarks(
  env: DocumentEnv,
  kind: MarkKind,
  marks: readonly { key: string; at: number }[],
): Promise<void> {
  await runAll(
    env,
    insertRows(
      'INSERT OR REPLACE INTO',
      'knowledge_email_marks',
      ['kind', 'key', 'at'],
      marks.map((mark) => [kind, mark.key, mark.at]),
    ),
  );
}

/** The daily prune: marks of pages and conflicts the knowledgebase no longer holds. */
export const pruneEmailMarks = () => [
  {
    sql: `DELETE FROM knowledge_email_marks WHERE kind = 'review-page' AND key NOT IN (SELECT id FROM tabs)`,
    params: [],
  },
  {
    sql: `DELETE FROM knowledge_email_marks WHERE kind = 'ask' AND key NOT IN (SELECT id FROM conflicts)`,
    params: [],
  },
];

/** Take up to `wanted` of what is left of today's emails; answers how many may go. Read and write are one
 *  transaction. What is taken is not given back when a recipient turns out to have the switch off: the count is
 *  of emails tried, which keeps the cap a ceiling. */
export async function reserveEmails(
  env: DocumentEnv,
  wanted: number,
  now: number,
): Promise<number> {
  if (wanted <= 0) return 0;
  const db = knowledgeDb(env);
  const day = dayOf(now);
  const [before] = await db.batch<{ used: number }>([
    db
      .prepare('SELECT used FROM usage_counters WHERE scope = ? AND period = ?')
      .bind(EMAILS_SCOPE, day),
    db
      .prepare(
        `INSERT INTO usage_counters (scope, period, used) VALUES (?, ?, MIN(?, ?))
           ON CONFLICT (scope, period) DO UPDATE SET used = MIN(?, used + excluded.used)`,
      )
      .bind(EMAILS_SCOPE, day, wanted, KNOWLEDGE_EMAILS_PER_DAY, KNOWLEDGE_EMAILS_PER_DAY),
  ]);
  const used = before?.results?.[0]?.used ?? 0;
  return Math.max(0, Math.min(wanted, KNOWLEDGE_EMAILS_PER_DAY - used));
}
