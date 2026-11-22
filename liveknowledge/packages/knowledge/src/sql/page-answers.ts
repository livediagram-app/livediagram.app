// The questions Ask answered from a page (docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page"): a row
// a page, question key (questions.ts `questionKey`) and UTC day, with the asker's words and how many times it was
// asked that day. Kept PAGE_ANSWERS_KEPT_DAYS days and MAX_PAGE_ANSWER_ROWS rows; no asker's identity is kept.
import { dayOf, daysBefore } from '../days';
import type { SqlStatement } from './statement';

/** The days a page's answered questions are counted over, and kept. */
export const PAGE_ANSWERS_KEPT_DAYS = 30;
/** The most rows a knowledgebase keeps; the oldest days go first. */
export const MAX_PAGE_ANSWER_ROWS = 5_000;
/** How many questions a page's AI Context lists. */
export const PAGE_ANSWERS_LISTED = 3;
/** The asker's words are kept to this many characters. */
export const PAGE_ANSWER_QUESTION_CHARS = 280;

/** The table (run by the room's schema step V19, beside the trigger that drops a deleted page's rows). */
export const PAGE_ANSWERS_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS page_answers (
    tab TEXT NOT NULL,
    key TEXT NOT NULL,
    day TEXT NOT NULL,
    question TEXT NOT NULL,
    asked INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tab, key, day)
  )`,
];

/** A question's words as kept: trimmed, each run of space one, at most PAGE_ANSWER_QUESTION_CHARS. */
export const pageAnswerWords = (question: string): string =>
  question.replace(/\s+/g, ' ').trim().slice(0, PAGE_ANSWER_QUESTION_CHARS);

/**
 * Counts one answer for every page it cited, in one statement: a row for each distinct tab (an answer cites at
 * most the passages Ask sent), `asked` raised by one where the row is already there, the newest words kept. Null
 * when there is nothing to count (no tab, or a question with no words).
 */
export function recordPageAnswers(
  key: string,
  question: string,
  tabs: readonly string[],
  now: number,
): SqlStatement | null {
  const distinct = [...new Set(tabs)];
  const words = pageAnswerWords(question);
  if (!key || !words || distinct.length === 0) return null;
  return {
    // `WHERE true`: an upsert's SELECT needs a WHERE, or SQLite reads its ON as a join's (SQLite, "UPSERT").
    sql: `INSERT INTO page_answers (tab, key, day, question, asked)
      SELECT value, ?, ?, ?, 1 FROM json_each(?) WHERE true
      ON CONFLICT (tab, key, day) DO UPDATE SET asked = asked + 1, question = excluded.question`,
    params: [key, dayOf(now), words, JSON.stringify(distinct)],
  };
}

/** The daily upkeep: days PAGE_ANSWERS_KEPT_DAYS or more back, then all but the newest MAX_PAGE_ANSWER_ROWS. */
export const prunePageAnswers = (now: number): SqlStatement[] => [
  {
    sql: 'DELETE FROM page_answers WHERE day <= ?',
    params: [daysBefore(now, PAGE_ANSWERS_KEPT_DAYS)],
  },
  {
    sql: `DELETE FROM page_answers WHERE rowid IN (
      SELECT rowid FROM page_answers ORDER BY day DESC, rowid DESC LIMIT -1 OFFSET ?
    )`,
    params: [MAX_PAGE_ANSWER_ROWS],
  },
];

export type PageAnswerRow = { question: string; asked: number };

/**
 * A page's questions of the last PAGE_ANSWERS_KEPT_DAYS days, like ones together: the most asked first, then the
 * most recently, PAGE_ANSWERS_LISTED at most. The words are the group's latest day's (SQLite gives a bare column
 * from the row MAX picked).
 */
export const listPageAnswers = (tab: string, now: number): SqlStatement => ({
  sql: `SELECT question, times AS asked FROM (
      SELECT key, question, MAX(day) AS last, SUM(asked) AS times FROM page_answers
       WHERE tab = ? AND day > ? GROUP BY key
    ) ORDER BY times DESC, last DESC, key LIMIT ?`,
  params: [tab, daysBefore(now, PAGE_ANSWERS_KEPT_DAYS), PAGE_ANSWERS_LISTED],
});
