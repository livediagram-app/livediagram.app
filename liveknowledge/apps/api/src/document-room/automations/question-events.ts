// Unanswered Question (docs/specs/013-workspace/automations.md "Triggers of its own"): a question nobody's pages
// answer, logged for the first time (its group of like questions is new). The log's three doors (Ask, an agent's
// search that found nothing, report_gap) call `newQuestions` before their write and `queueUnanswered` after it. No
// read at all unless a rule that is on hears the kind.
import { QUESTION_UNANSWERED_EVENT } from '@liveknowledge/document/automations';
import { rowsOf, sqlOf } from '../../knowledge/knowledge-db';
import type { DocumentRouteContext } from '../../routes/context';
import { hearsKnowledge, queueUnanswered } from './knowledge-events';
import { routeWho } from './knowledge-who';

export type LoggedQuestion = { key: string; question: string };

/** Which of these questions no group holds yet: their first asking. Empty when no rule hears it. */
export async function newQuestions(
  ctx: DocumentRouteContext,
  asked: readonly LoggedQuestion[],
): Promise<LoggedQuestion[]> {
  if (asked.length === 0 || !hearsKnowledge(ctx.env, QUESTION_UNANSWERED_EVENT)) return [];
  const keys = [...new Set(asked.map((q) => q.key))];
  const held = new Set(
    (
      await rowsOf<{ key: string }>(
        ctx.env,
        sqlOf(
          `SELECT key FROM questions WHERE key IN (${keys.map(() => '?').join(', ')})`,
          ...keys,
        ),
      )
    ).map((row) => row.key),
  );
  const fresh = new Map<string, LoggedQuestion>();
  for (const q of asked) if (!held.has(q.key) && !fresh.has(q.key)) fresh.set(q.key, q);
  return [...fresh.values()];
}

/** Queue Unanswered Question for each first asking, as the caller's. */
export async function queueNewQuestions(
  ctx: DocumentRouteContext,
  fresh: readonly LoggedQuestion[],
): Promise<void> {
  if (fresh.length === 0) return;
  queueUnanswered(ctx.env, fresh, await routeWho(ctx));
}
