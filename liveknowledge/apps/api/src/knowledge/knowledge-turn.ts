// The work a knowledgebase's alarm does on a turn (knowledge-work.ts): the conflict checks that are due, and the
// emails. A few a turn, each outside any transaction; what is left is due again at once.
import type { ItemSql } from '@liveworkspace/index-app';
import type { DocumentEnv } from '../types';
import { runConflictCheck } from './conflict-check';
import { deferWork, doneWork, dueWork, knowledgeWorkDueAt } from './knowledge-work';
import { runKnowledgeEmail } from './knowledge-emails';
import { runWatchWork } from './watch-work';

/** Pieces of work one turn does: each may be a model call of some seconds. */
export const WORK_PER_TURN = 3;

/** Do what is due; answer when the next piece is. */
export async function runKnowledgeWork(
  env: DocumentEnv,
  sql: ItemSql,
  documentId: string,
  now: number,
): Promise<number | null> {
  for (const work of dueWork(sql, now, WORK_PER_TURN)) {
    let again: number | null = null;
    try {
      again =
        work.kind === 'conflict'
          ? await runConflictCheck(env, documentId, work, now)
          : work.kind === 'watch'
            ? await runWatchWork(env, documentId, work, now)
            : await runKnowledgeEmail(env, documentId, work, now);
    } catch (error) {
      console.warn('[knowledge] work failed', {
        documentId,
        kind: work.kind,
        error: String(error),
      });
    }
    if (again === null) doneWork(sql, work.kind, work.key);
    else deferWork(sql, work.kind, work.key, again);
  }
  return knowledgeWorkDueAt(sql);
}
