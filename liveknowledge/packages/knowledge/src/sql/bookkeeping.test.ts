// Reads, questions, conflicts, counters and settings, run against a real SQLite.
import { describe, expect, it } from 'vitest';
import { knowledgeDb } from '../__fixtures__/db';
import { flowOf, para } from '../__fixtures__/writing';
import { conflictId, type Conflict } from '../conflicts';
import { dayOf, hourOf } from '../days';
import { pagePassages } from '../passages';
import { questionKey } from '../questions';
import {
  conflictOfRow,
  dismissConflict,
  insertConflict,
  knownConflictIds,
  lastConflictCheck,
  listConflicts,
  noteConflictCheck,
  type ConflictRow,
} from './conflicts';
import {
  ASK_KNOWLEDGEBASE_SCOPE,
  CONFLICT_CHECK_SCOPE,
  askCounters,
  askPersonScope,
  bumpCounter,
  pruneCounters,
  readCounter,
} from './counters';
import { deletePageIndex, replacePageIndex } from './page-index';
import {
  dismissQuestion,
  listQuestionAgents,
  listQuestions,
  pruneQuestions,
  questionGroups,
  upsertQuestion,
  type QuestionAgentRow,
  type QuestionRow,
} from './questions';
import {
  MOST_READ_PAGES,
  READS_TREND_DAYS,
  agentName,
  agentReads,
  countAgentReads,
  countDailyReads,
  countMostRead,
  countPageDailyReads,
  dailyReads,
  pruneReads,
  recordRead,
  type AgentReadsRow,
  type DailyReadsRow,
  type MostReadRow,
} from './reads';
import { pageInsights } from '../page-insights';
import {
  SETTING_AI_KEY,
  SETTING_AI_KEY_HINT,
  SETTING_AI_MODEL,
  SETTING_AI_PROVIDER,
  putAiKey,
  removeAiModel,
  putSetting,
  readSetting,
  removeAiKey,
} from './settings';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 14);

describe('page reads', () => {
  it('counts by day, reader kind and agent', () => {
    const db = knowledgeDb();
    const agent = { kind: 'agent', name: '  Coding\n Agent ' } as const;
    db.run([
      recordRead('tab-1', { kind: 'person' }, NOW),
      recordRead('tab-1', { kind: 'person' }, NOW),
      recordRead('tab-1', agent, NOW),
      recordRead('tab-1', agent, NOW - DAY),
      recordRead('tab-1', { kind: 'person' }, NOW - 8 * DAY),
      recordRead('tab-2', { kind: 'person' }, NOW),
    ]);
    expect(db.rows('SELECT COUNT(*) AS n FROM page_reads')).toEqual([{ n: 5 }]);
    const use = (tab: string, days?: number) =>
      pageInsights(db.all<DailyReadsRow>(countPageDailyReads(tab, NOW, days)), NOW);
    // The week is the last 7 days of the 30 (Read This Week); the eighth day back is in the 30 only.
    expect(use('tab-1').week).toEqual({ people: 2, agents: 2 });
    const total = (days: { people: number; agents: number }[]) =>
      days.reduce((sum, d) => sum + d.people + d.agents, 0);
    expect(total(use('tab-1').days)).toBe(5);
    expect(total(use('tab-1', 7).days)).toBe(4);
    expect(use('tab-9').week).toEqual({ people: 0, agents: 0 });
  });

  it('names an agent in one short line', () => {
    expect(agentName('  Coding\n Agent ')).toBe('Coding Agent');
    expect(agentName('x'.repeat(200))).toHaveLength(80);
    expect(agentName('  ')).toBe('Agent');
  });

  it('summarises each connected agent: reads this week and the three pages it read most', () => {
    const db = knowledgeDb();
    const read = (tab: string, name: string, times: number, at = NOW) =>
      db.run(Array.from({ length: times }, () => recordRead(tab, { kind: 'agent', name }, at)));
    read('tab-1', 'CLI', 2);
    read('tab-2', 'CLI', 5);
    read('tab-3', 'CLI', 1);
    read('tab-4', 'CLI', 3);
    read('tab-5', 'CLI', 4, NOW - 20 * DAY);
    read('tab-1', 'Coding Agent', 1, NOW - 29 * DAY);
    read('tab-1', 'Gone Agent', 9, NOW - 40 * DAY);
    db.run(recordRead('tab-1', { kind: 'person' }, NOW));
    expect(agentReads(db.all<AgentReadsRow>(countAgentReads(NOW)))).toEqual([
      { agent: 'CLI', readsThisWeek: 11, topPages: ['tab-2', 'tab-4', 'tab-1'] },
      { agent: 'Coding Agent', readsThisWeek: 0, topPages: [] },
    ]);
  });

  it('answers the last 14 days by day, people and agents apart, a quiet day at nought', () => {
    const db = knowledgeDb();
    const agent = { kind: 'agent', name: 'CLI' } as const;
    db.run([
      recordRead('tab-1', { kind: 'person' }, NOW),
      recordRead('tab-2', { kind: 'person' }, NOW),
      recordRead('tab-1', agent, NOW),
      recordRead('tab-1', agent, NOW - 2 * DAY),
      recordRead('tab-1', { kind: 'person' }, NOW - 13 * DAY),
      // Outside the window.
      recordRead('tab-1', { kind: 'person' }, NOW - 14 * DAY),
    ]);
    const days = dailyReads(db.all<DailyReadsRow>(countDailyReads(NOW)), NOW);
    expect(days).toHaveLength(READS_TREND_DAYS);
    expect(days[0]).toEqual({ day: dayOf(NOW - 13 * DAY), people: 1, agents: 0 });
    expect(days[11]).toEqual({ day: dayOf(NOW - 2 * DAY), people: 0, agents: 1 });
    expect(days[12]).toEqual({ day: dayOf(NOW - DAY), people: 0, agents: 0 });
    expect(days[13]).toEqual({ day: dayOf(NOW), people: 2, agents: 1 });
    // A row of a day outside the window, or of a reader kind not known, is left out.
    expect(
      dailyReads(
        [
          { day: '2020-01-01', readerKind: 'person', reads: 4 },
          { day: dayOf(NOW), readerKind: 'robot', reads: 4 },
        ],
        NOW,
      ).every((d) => d.people === 0 && d.agents === 0),
    ).toBe(true);
  });

  it('names the pages read most this week, most first, people and agents apart', () => {
    const db = knowledgeDb();
    const read = (tab: string, times: number, kind: 'person' | 'agent', at = NOW) =>
      db.run(
        Array.from({ length: times }, () =>
          recordRead(tab, kind === 'person' ? { kind } : { kind, name: 'CLI' }, at),
        ),
      );
    read('tab-1', 2, 'person');
    read('tab-1', 3, 'agent');
    read('tab-2', 6, 'person');
    read('tab-3', 1, 'agent');
    read('tab-4', 9, 'person', NOW - 8 * DAY);
    expect(db.all<MostReadRow>(countMostRead(NOW))).toEqual([
      { tab: 'tab-2', people: 6, agents: 0 },
      { tab: 'tab-1', people: 2, agents: 3 },
      { tab: 'tab-3', people: 0, agents: 1 },
    ]);
    for (let at = 0; at < 15; at++) read(`many-${String(at).padStart(2, '0')}`, 1, 'person');
    expect(db.all<MostReadRow>(countMostRead(NOW))).toHaveLength(MOST_READ_PAGES * 2);
  });

  it('reads both as a range of the week, never a scan of every day kept', () => {
    const db = knowledgeDb();
    for (const statement of [countDailyReads(NOW), countMostRead(NOW)]) {
      const plan = db
        .all<{ detail: string }>({ ...statement, sql: `EXPLAIN QUERY PLAN ${statement.sql}` })
        .map((row) => row.detail);
      expect(plan.some((detail) => /^SEARCH page_reads .*\(day>\?\)/.test(detail))).toBe(true);
    }
  });

  it('keeps 90 days', () => {
    const db = knowledgeDb();
    db.run([
      recordRead('tab-1', { kind: 'person' }, NOW - 91 * DAY),
      recordRead('tab-1', { kind: 'person' }, NOW - 90 * DAY),
      recordRead('tab-1', { kind: 'person' }, NOW),
    ]);
    db.run(pruneReads(NOW));
    expect(db.rows('SELECT day FROM page_reads ORDER BY day')).toEqual([
      { day: dayOf(NOW - 90 * DAY) },
      { day: dayOf(NOW) },
    ]);
  });
});

describe('questions nobody could answer', () => {
  const log = (
    db: ReturnType<typeof knowledgeDb>,
    question: string,
    asker: Parameters<typeof upsertQuestion>[2],
    at = NOW,
  ) => db.run(upsertQuestion(questionKey(question), question, asker, at));
  const groups = (db: ReturnType<typeof knowledgeDb>) =>
    questionGroups(
      db.all<QuestionRow>(listQuestions()),
      db.all<QuestionAgentRow>(listQuestionAgents()),
    );

  it('groups like questions, counting people and each agent', () => {
    const db = knowledgeDb();
    log(db, ' How do we deploy the API? ', { kind: 'person' }, NOW - 5);
    log(db, 'how is the api deployed', { kind: 'agent', name: 'Coding Agent' });
    log(db, 'Deploying the API', { kind: 'person' });
    log(db, 'deploy api', { kind: 'agent', name: 'Coding Agent' });
    log(db, 'deploy api?', { kind: 'agent', name: 'CLI' });
    log(db, 'Who owns billing?', { kind: 'person' });
    expect(groups(db)).toEqual([
      {
        key: 'api deploy',
        question: 'How do we deploy the API?',
        asked: 5,
        people: 2,
        agents: { 'Coding Agent': 2, CLI: 1 },
      },
      { key: 'bill own', question: 'Who owns billing?', asked: 1, people: 1, agents: {} },
    ]);
    expect(db.rows('SELECT first_at, last_at FROM questions WHERE asked = 5')).toEqual([
      { first_at: NOW - 5, last_at: NOW },
    ]);
  });

  it('cuts a question at its limit, and lists as many as asked for', () => {
    const db = knowledgeDb();
    log(db, `zebra ${'x'.repeat(3000)}`, { kind: 'person' });
    log(db, 'Who owns billing?', { kind: 'person' });
    expect(
      db.rows<{ n: number }>('SELECT LENGTH(question) AS n FROM questions ORDER BY n DESC')[0]!.n,
    ).toBe(1000);
    expect(db.all(listQuestions(1))).toHaveLength(1);
    expect(db.all(listQuestions(0))).toHaveLength(1);
    expect(db.all(listQuestions(1e9))).toHaveLength(2);
  });

  it('dismisses a group and its agents', () => {
    const db = knowledgeDb();
    log(db, 'deploy api', { kind: 'agent', name: 'CLI' });
    log(db, 'Who owns billing?', { kind: 'agent', name: 'CLI' });
    db.run(dismissQuestion('api deploy'));
    expect(groups(db).map((g) => g.key)).toEqual(['bill own']);
    expect(db.rows('SELECT key FROM question_agents')).toEqual([{ key: 'bill own' }]);
  });

  it('keeps the 500 asked most recently', () => {
    const db = knowledgeDb();
    for (let n = 0; n < 505; n++) {
      db.run(upsertQuestion(`key-${n}`, `Question ${n}`, { kind: 'agent', name: 'CLI' }, NOW + n));
    }
    db.run(pruneQuestions());
    expect(db.rows('SELECT COUNT(*) AS n FROM questions')).toEqual([{ n: 500 }]);
    expect(db.rows('SELECT COUNT(*) AS n FROM question_agents')).toEqual([{ n: 500 }]);
    expect(db.rows(`SELECT key FROM questions WHERE key IN ('key-0', 'key-4', 'key-5')`)).toEqual([
      { key: 'key-5' },
    ]);
  });
});

describe('conflicts', () => {
  const page = (tab: string, text: string) => {
    const passages = pagePassages(tab, flowOf(para(text)));
    return {
      passages,
      index: replacePageIndex({ tab, title: tab, passages, links: [], trust: {} }),
    };
  };
  function seeded() {
    const db = knowledgeDb();
    const a = page('tab-a', 'Deploys happen on Fridays.');
    const b = page('tab-b', 'Deploys never happen on Fridays.');
    db.run([...a.index, ...b.index]);
    const [pa, pb] = [a.passages[0]!, b.passages[0]!];
    const conflict: Conflict = {
      id: conflictId(pa.id, pb.id),
      question: 'When do deploys happen?',
      a: { passage: pa.id, tab: pa.tab, textHash: pa.textHash },
      b: { passage: pb.id, tab: pb.tab, textHash: pb.textHash },
    };
    db.run(insertConflict(conflict, NOW));
    return { db, conflict };
  }
  const open = (db: ReturnType<typeof knowledgeDb>) =>
    db.all<ConflictRow>(listConflicts()).map(conflictOfRow);

  it('stores a conflict once and lists it', () => {
    const { db, conflict } = seeded();
    db.run(insertConflict({ ...conflict, question: 'Asked again' }, NOW + 1));
    expect(open(db)).toEqual([conflict]);
    expect(db.all(listConflicts(0))).toHaveLength(1);
    expect(db.all<{ id: string }>(knownConflictIds('tab-b'))).toEqual([{ id: conflict.id }]);
    expect(db.all(knownConflictIds('tab-c'))).toEqual([]);
  });

  it('dismisses a pair for good', () => {
    const { db, conflict } = seeded();
    db.run(dismissConflict(conflict.id));
    expect(open(db)).toEqual([]);
    db.run(insertConflict(conflict, NOW + 1));
    expect(open(db)).toEqual([]);
    expect(db.all(knownConflictIds('tab-a'))).toHaveLength(1);
  });

  it('stays open when its pages are saved unchanged', () => {
    const { db } = seeded();
    db.run(page('tab-a', 'Deploys happen on Fridays.').index);
    db.run(page('tab-c', 'Another page.').index);
    expect(open(db)).toHaveLength(1);
  });

  it('closes by itself when either passage changes', () => {
    for (const tab of ['tab-a', 'tab-b']) {
      const { db } = seeded();
      db.run(page(tab, 'Deploys happen on Tuesdays now.').index);
      expect(open(db)).toEqual([]);
      expect(db.rows('SELECT COUNT(*) AS n FROM conflicts')).toEqual([{ n: 0 }]);
    }
  });

  it('closes when a page is deleted', () => {
    const { db } = seeded();
    db.run(deletePageIndex('tab-b'));
    expect(open(db)).toEqual([]);
  });

  it('remembers when a page was last checked', () => {
    const db = knowledgeDb();
    expect(db.all(lastConflictCheck('tab-a'))).toEqual([]);
    db.run([noteConflictCheck('tab-a', NOW), noteConflictCheck('tab-a', NOW + 5)]);
    expect(db.all(lastConflictCheck('tab-a'))).toEqual([{ checkedAt: NOW + 5 }]);
    db.run(deletePageIndex('tab-a'));
    expect(db.all(lastConflictCheck('tab-a'))).toEqual([]);
  });
});

describe('usage counters', () => {
  it('counts inside a window', () => {
    const db = knowledgeDb();
    expect(db.all(readCounter(CONFLICT_CHECK_SCOPE, dayOf(NOW)))).toEqual([]);
    db.run([
      bumpCounter(CONFLICT_CHECK_SCOPE, dayOf(NOW)),
      bumpCounter(CONFLICT_CHECK_SCOPE, dayOf(NOW)),
    ]);
    expect(db.all(readCounter(CONFLICT_CHECK_SCOPE, dayOf(NOW)))).toEqual([{ used: 2 }]);
    expect(db.all(readCounter(CONFLICT_CHECK_SCOPE, dayOf(NOW + DAY)))).toEqual([]);
  });

  it("counts a question against its person's hour and the knowledgebase's day", () => {
    const db = knowledgeDb();
    const first = askCounters('acct_1', NOW);
    db.run(first.bump);
    db.run(askCounters('acct_1', NOW + 60_000).bump);
    db.run(askCounters('acct_2', NOW).bump);
    db.run(askCounters('acct_1', NOW + 3_600_000).bump);
    expect(db.all(first.readPerson)).toEqual([{ used: 2 }]);
    expect(db.all(first.readKnowledgebase)).toEqual([{ used: 4 }]);
    expect(first.readPerson.params).toEqual([askPersonScope('acct_1'), hourOf(NOW)]);
    expect(first.readKnowledgebase.params).toEqual([ASK_KNOWLEDGEBASE_SCOPE, dayOf(NOW)]);
  });

  it('drops the windows that are over', () => {
    const db = knowledgeDb();
    db.run([
      bumpCounter('s', hourOf(NOW - 2 * DAY)),
      bumpCounter('s', dayOf(NOW - 2 * DAY)),
      bumpCounter('s', hourOf(NOW - DAY)),
      bumpCounter('s', dayOf(NOW - DAY)),
      bumpCounter('s', hourOf(NOW)),
    ]);
    db.run(pruneCounters(NOW));
    expect(db.rows('SELECT period FROM usage_counters ORDER BY period')).toEqual([
      { period: dayOf(NOW - DAY) },
      { period: hourOf(NOW - DAY) },
      { period: hourOf(NOW) },
    ]);
  });
});

describe('AI settings', () => {
  it('stores the sealed key with its hint, replaces and removes them, and keeps the model', () => {
    const db = knowledgeDb();
    expect(db.all(readSetting(SETTING_AI_KEY))).toEqual([]);
    expect(db.all(readSetting(SETTING_AI_PROVIDER))).toEqual([]);
    db.run([
      ...putAiKey('v1.iv.sealed', '4f2a', 'anthropic'),
      putSetting(SETTING_AI_MODEL, 'claude-opus-5-5'),
    ]);
    db.run(putAiKey('v1.iv2.sealed2', '9c1d', 'anthropic'));
    expect(db.all(readSetting(SETTING_AI_KEY))).toEqual([{ value: 'v1.iv2.sealed2' }]);
    expect(db.all(readSetting(SETTING_AI_KEY_HINT))).toEqual([{ value: '9c1d' }]);
    db.run(removeAiKey());
    expect(db.all(readSetting(SETTING_AI_KEY))).toEqual([]);
    expect(db.all(readSetting(SETTING_AI_KEY_HINT))).toEqual([]);
    expect(db.all(readSetting(SETTING_AI_MODEL))).toEqual([{ value: 'claude-opus-5-5' }]);
    expect(db.all(readSetting(SETTING_AI_PROVIDER))).toEqual([{ value: 'anthropic' }]);
  });

  it('keeps the provider beside the key, and forgets the model when the provider changes', () => {
    const db = knowledgeDb();
    db.run([
      ...putAiKey('v1.iv.sealed', '4f2a', 'anthropic'),
      putSetting(SETTING_AI_MODEL, 'claude-opus-5-5'),
    ]);
    db.run([...putAiKey('v1.iv3.sealed3', 'oai1', 'openai'), removeAiModel()]);
    expect(db.all(readSetting(SETTING_AI_PROVIDER))).toEqual([{ value: 'openai' }]);
    expect(db.all(readSetting(SETTING_AI_KEY))).toEqual([{ value: 'v1.iv3.sealed3' }]);
    expect(db.all(readSetting(SETTING_AI_MODEL))).toEqual([]);
  });
});
