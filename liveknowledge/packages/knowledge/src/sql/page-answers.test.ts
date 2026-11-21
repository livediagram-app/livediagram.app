// The questions Ask answered from a page, and the agents that read it (ai-knowledge.md "AI Context on a page"), run
// against a real SQLite.
import { describe, expect, it } from 'vitest';
import { knowledgeDb } from '../__fixtures__/db';
import { questionKey } from '../questions';
import {
  MAX_PAGE_ANSWER_ROWS,
  PAGE_ANSWER_QUESTION_CHARS,
  PAGE_ANSWERS_SCHEMA,
  listPageAnswers,
  pageAnswerWords,
  prunePageAnswers,
  recordPageAnswers,
  type PageAnswerRow,
} from './page-answers';
import { countPageAgentReads, recordRead, type PageAgentReadsRow } from './reads';
import type { SqlStatement } from './statement';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 14);

function db() {
  const d = knowledgeDb();
  for (const sql of PAGE_ANSWERS_SCHEMA) d.run({ sql, params: [] });
  return d;
}
const answer = (question: string, tabs: string[], at = NOW): SqlStatement =>
  recordPageAnswers(questionKey(question), question, tabs, at)!;

describe('recordPageAnswers', () => {
  it('counts one answer once for each distinct page it cited, in one statement', () => {
    const d = db();
    d.run(answer('When do we deploy?', ['deploys', 'rollbacks', 'deploys']));
    d.run(answer('when do   we DEPLOY', ['deploys']));
    expect(d.rows('SELECT tab, key, question, asked FROM page_answers ORDER BY tab')).toEqual([
      { tab: 'deploys', key: 'deploy', question: 'when do we DEPLOY', asked: 2 },
      { tab: 'rollbacks', key: 'deploy', question: 'When do we deploy?', asked: 1 },
    ]);
  });

  it('counts nothing for no page or no words', () => {
    expect(recordPageAnswers('deploy', 'When do we deploy?', [], NOW)).toBeNull();
    expect(recordPageAnswers('', 'When?', ['deploys'], NOW)).toBeNull();
    expect(recordPageAnswers('x', '   ', ['deploys'], NOW)).toBeNull();
  });

  it('keeps the words to their bound, one line', () => {
    expect(pageAnswerWords(`  a\n\nb ${'c'.repeat(400)}`)).toHaveLength(PAGE_ANSWER_QUESTION_CHARS);
    expect(pageAnswerWords('  a\n\n b ')).toBe('a b');
  });

  it('binds the tabs as one value, whatever their number', () => {
    const tabs = Array.from({ length: 200 }, (_, i) => `t${i}`);
    const statement = recordPageAnswers('deploy', 'deploy', tabs, NOW)!;
    expect(statement.params).toHaveLength(4);
    const d = db();
    d.run(statement);
    expect(d.rows<{ n: number }>('SELECT COUNT(*) AS n FROM page_answers')[0]!.n).toBe(200);
  });
});

describe('listPageAnswers', () => {
  it('lists the most asked first, then the most recent, three at most, over 30 days', () => {
    const d = db();
    for (let i = 0; i < 3; i++) d.run(answer('Who approves a deploy?', ['deploys'], NOW - i * DAY));
    d.run(answer('Who approves deploys', ['deploys'], NOW));
    d.run(answer('When do we deploy?', ['deploys'], NOW - 2 * DAY));
    d.run(answer('When do we deploy?', ['deploys'], NOW - 3 * DAY));
    d.run(answer('Where are the logs?', ['deploys'], NOW - DAY));
    d.run(answer('What is a rollback?', ['deploys'], NOW - 2 * DAY));
    // Too old to count, and another page's.
    for (let i = 0; i < 9; i++) d.run(answer('Is it old?', ['deploys'], NOW - 31 * DAY));
    d.run(answer('Is it elsewhere?', ['rollbacks'], NOW));
    expect(d.all<PageAnswerRow>(listPageAnswers('deploys', NOW))).toEqual([
      // The words of the group's latest day.
      { question: 'Who approves deploys', asked: 4 },
      { question: 'When do we deploy?', asked: 2 },
      { question: 'Where are the logs?', asked: 1 },
    ]);
    expect(d.all(listPageAnswers('nothing', NOW))).toEqual([]);
  });
});

describe('prunePageAnswers', () => {
  it('drops days 30 or more back, then keeps the newest rows up to the cap', () => {
    const d = db();
    d.run(answer('Old question', ['deploys'], NOW - 30 * DAY));
    d.run(answer('Recent question', ['deploys'], NOW - 29 * DAY));
    d.run(prunePageAnswers(NOW));
    expect(d.rows('SELECT question FROM page_answers')).toEqual([{ question: 'Recent question' }]);
  });

  it('keeps MAX_PAGE_ANSWER_ROWS, the newest days', () => {
    const d = db();
    const tabs = Array.from({ length: MAX_PAGE_ANSWER_ROWS }, (_, i) => `t${i}`);
    d.run(answer('Yesterday', tabs, NOW - DAY));
    d.run(answer('Today', ['a', 'b'], NOW));
    d.run(prunePageAnswers(NOW));
    const rows = d.rows<{ day: string; n: number }>(
      'SELECT day, COUNT(*) AS n FROM page_answers GROUP BY day ORDER BY day',
    );
    expect(rows.reduce((sum, r) => sum + r.n, 0)).toBe(MAX_PAGE_ANSWER_ROWS);
    expect(rows.at(-1)).toEqual({ day: '2026-11-20', n: 2 });
  });
});

describe('countPageAgentReads', () => {
  it('names the three agents that read the page most this week, then by name', () => {
    const d = db();
    const agent = (name: string) => ({ kind: 'agent', name }) as const;
    const reads = [
      ...Array.from({ length: 3 }, () => recordRead('deploys', agent('Coding Agent'), NOW)),
      ...Array.from({ length: 2 }, () => recordRead('deploys', agent('Support Bot'), NOW - DAY)),
      recordRead('deploys', agent('Claude Desktop'), NOW),
      recordRead('deploys', agent('Another'), NOW),
      // A person's, an old one and another page's are not counted.
      recordRead('deploys', { kind: 'person' }, NOW),
      ...Array.from({ length: 9 }, () => recordRead('deploys', agent('Old'), NOW - 8 * DAY)),
      ...Array.from({ length: 9 }, () => recordRead('rollbacks', agent('Elsewhere'), NOW)),
    ];
    d.run(reads);
    expect(d.all<PageAgentReadsRow>(countPageAgentReads('deploys', NOW))).toEqual([
      { agent: 'Coding Agent', reads: 3 },
      { agent: 'Support Bot', reads: 2 },
      { agent: 'Another', reads: 1 },
    ]);
  });
});
