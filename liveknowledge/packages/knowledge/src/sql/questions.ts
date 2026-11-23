// Questions nobody could answer (docs/specs/030-knowledgebase/insights.md): one row a group of like questions
// (questions.ts `questionKey`), with how many times it was asked, how many of those by people, and each agent's
// count beside it.
import { ASK_MAX_QUESTION_CHARS } from '../ask-limits';
import type { QuestionGroup } from '../questions';
import { agentName, type Reader } from './reads';
import type { SqlStatement } from './statement';

/** The most groups a knowledgebase keeps; the ones asked longest ago go first. */
export const MAX_QUESTIONS = 500;
/** How many the Insights tab lists. */
export const QUESTIONS_LISTED = 50;

/** Logs one unanswered question under its group's `key`. The first asker's words stay the group's question. Run
 *  in order, in one transaction. */
export function upsertQuestion(
  key: string,
  question: string,
  asker: Reader,
  now: number,
): SqlStatement[] {
  const person = asker.kind === 'person' ? 1 : 0;
  const statements: SqlStatement[] = [
    {
      sql: `INSERT INTO questions (key, question, asked, people, first_at, last_at) VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT (key) DO UPDATE SET asked = asked + 1, people = people + excluded.people,
          last_at = excluded.last_at`,
      params: [key, question.trim().slice(0, ASK_MAX_QUESTION_CHARS), person, now, now],
    },
  ];
  if (asker.kind === 'agent') {
    statements.push({
      sql: `INSERT INTO question_agents (key, agent, asked) VALUES (?, ?, 1)
        ON CONFLICT (key, agent) DO UPDATE SET asked = asked + 1`,
      params: [key, agentName(asker.name)],
    });
  }
  return statements;
}

/** Keeps the MAX_QUESTIONS groups asked most recently. The room runs it at most once a day. */
export const pruneQuestions = (): SqlStatement[] => [
  {
    sql: `DELETE FROM questions WHERE key NOT IN (
      SELECT key FROM questions ORDER BY last_at DESC, key LIMIT ?
    )`,
    params: [MAX_QUESTIONS],
  },
  { sql: 'DELETE FROM question_agents WHERE key NOT IN (SELECT key FROM questions)', params: [] },
];

/** "Dismiss" removes the row. */
export const dismissQuestion = (key: string): SqlStatement[] => [
  { sql: 'DELETE FROM questions WHERE key = ?', params: [key] },
  { sql: 'DELETE FROM question_agents WHERE key = ?', params: [key] },
];

export type QuestionRow = {
  key: string;
  question: string;
  asked: number;
  people: number;
  firstAt: number;
  lastAt: number;
};
export type QuestionAgentRow = { key: string; agent: string; asked: number };

/** The groups asked most, then most recently. */
export const listQuestions = (limit = QUESTIONS_LISTED): SqlStatement => ({
  sql: `SELECT key, question, asked, people, first_at AS firstAt, last_at AS lastAt FROM questions
    ORDER BY asked DESC, last_at DESC, key LIMIT ?`,
  params: [Math.min(MAX_QUESTIONS, Math.max(1, Math.floor(limit)))],
});

/** Every group's agents, for `questionGroups`. */
export const listQuestionAgents = (): SqlStatement => ({
  sql: 'SELECT key, agent, asked FROM question_agents ORDER BY key, asked DESC, agent',
  params: [],
});

/** The rows as groups, with who asked ("3 people and the Coding Agent"), in the questions' order. */
export function questionGroups(
  questions: readonly QuestionRow[],
  agents: readonly QuestionAgentRow[],
): QuestionGroup[] {
  const byKey = new Map<string, Record<string, number>>();
  for (const row of agents) {
    const of = byKey.get(row.key) ?? {};
    of[row.agent] = row.asked;
    byKey.set(row.key, of);
  }
  return questions.map((q) => ({
    key: q.key,
    question: q.question,
    asked: q.asked,
    people: q.people,
    agents: byKey.get(q.key) ?? {},
  }));
}
