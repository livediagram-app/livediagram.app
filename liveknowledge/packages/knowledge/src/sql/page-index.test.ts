import { describe, expect, it } from 'vitest';
import { knowledgeDb } from '../__fixtures__/db';
import { flowOf, para } from '../__fixtures__/writing';
import { pagePassages } from '../passages';
import {
  MAX_INDEXED_TITLE_CHARS,
  backlinkRows,
  deletePageIndex,
  countReviewDue,
  putPageTrust,
  replacePageIndex,
} from './page-index';
import { KNOWLEDGE_SCHEMA } from './schema';
import { MAX_BOUND_PARAMETERS, insertRows } from './statement';
import { searchPassages, type SearchRow } from './search';

const NOW = Date.UTC(2026, 10, 20);

const index = (tab: string, title: string, body: string[], links: string[] = []) =>
  replacePageIndex({
    tab,
    title,
    passages: pagePassages(tab, flowOf(...body.map((text) => para(text)))),
    links,
    trust: {},
  });

const count = (db: ReturnType<typeof knowledgeDb>, table: string) =>
  db.rows<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]!.n;

describe('the schema', () => {
  it('creates idempotently', () => {
    const db = knowledgeDb();
    db.schema();
    db.schema();
    const tables = db.rows<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`);
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'passages',
        'passages_fts',
        'page_trust',
        'page_links',
        'page_reads',
        'questions',
        'question_agents',
        'conflicts',
        'usage_counters',
        'conflict_checks',
        'knowledge_settings',
      ]),
    );
    for (const sql of KNOWLEDGE_SCHEMA) expect(sql).toContain('IF NOT EXISTS');
  });
});

describe('insertRows', () => {
  it('batches rows under the bound parameter limit', () => {
    const rows = Array.from({ length: 120 }, (_x, at) => [`a${at}`, `b${at}`, at]);
    const statements = insertRows('INSERT INTO', 't', ['a', 'b', 'c'], rows);
    expect(statements.map((s) => s.params.length)).toEqual([99, 99, 99, 63]);
    for (const s of statements) expect(s.params.length).toBeLessThanOrEqual(MAX_BOUND_PARAMETERS);
    expect(statements[3]!.sql).toBe(
      `INSERT INTO t (a, b, c) VALUES ${Array(21).fill('(?, ?, ?)').join(', ')}`,
    );
    expect(insertRows('INSERT INTO', 't', ['a'], [])).toEqual([]);
    // More columns than the limit still makes a statement a row.
    const wide = Array.from({ length: 101 }, (_x, at) => `c${at}`);
    expect(insertRows('INSERT INTO', 't', wide, [wide, wide])).toHaveLength(2);
  });
});

describe('a page in the index', () => {
  it('writes the title row, the passages, the words, the links and the trust row', () => {
    const db = knowledgeDb();
    db.run(
      index(
        'tab-1',
        'Release Process',
        ['We deploy on Fridays.'],
        ['tab-2', 'tab-2', 'tab-1', 'tab-3'],
      ),
    );
    expect(db.rows('SELECT ordinal, title, text FROM passages ORDER BY ordinal')).toEqual([
      { ordinal: -1, title: 'Release Process', text: '' },
      { ordinal: 0, title: '', text: 'We deploy on Fridays.' },
    ]);
    expect(db.rows('SELECT from_tab, to_tab FROM page_links ORDER BY to_tab')).toEqual([
      { from_tab: 'tab-1', to_tab: 'tab-2' },
      { from_tab: 'tab-1', to_tab: 'tab-3' },
    ]);
    expect(db.rows('SELECT * FROM page_trust')).toEqual([
      { tab: 'tab-1', title: 'Release Process', verified_at: null },
    ]);
    expect(
      db.all<SearchRow>(searchPassages('fridays', { now: NOW, reviewEvery: 90 })!),
    ).toHaveLength(1);
  });

  it('replaces a page whole: old words no longer match, other pages are untouched', () => {
    const db = knowledgeDb();
    db.run(index('tab-1', 'Release Process', ['We deploy on Fridays.'], ['tab-2']));
    db.run(index('tab-2', 'Support', ['Ask in the channel on Fridays.']));
    db.run(index('tab-1', 'Logistics', ['We ship on Tuesdays.'], ['tab-3']));
    const found = (query: string) =>
      db.all<SearchRow>(searchPassages(query, { now: NOW, reviewEvery: 90 })!).map((r) => r.tab);
    expect(found('fridays')).toEqual(['tab-2']);
    expect(found('tuesdays')).toEqual(['tab-1']);
    expect(found('release')).toEqual([]);
    expect(found('logistics')).toEqual(['tab-1']);
    expect(count(db, 'passages')).toBe(4);
    expect(db.rows('SELECT to_tab FROM page_links')).toEqual([{ to_tab: 'tab-3' }]);
    expect(db.rows(`SELECT title FROM page_trust WHERE tab = 'tab-1'`)).toEqual([
      { title: 'Logistics' },
    ]);
    // The index agrees with the table it is built over.
    expect(() =>
      db.rows(`INSERT INTO passages_fts (passages_fts) VALUES ('integrity-check')`),
    ).not.toThrow();
  });

  it('indexes a page of hundreds of passages in statements the platform takes', () => {
    const db = knowledgeDb();
    const body = Array.from({ length: 300 }, (_x, at) => `Paragraph ${at} ${'word '.repeat(230)}`);
    const statements = index(
      'tab-1',
      'Long',
      body,
      Array.from({ length: 700 }, (_x, at) => `tab-${at + 2}`),
    );
    db.run(statements);
    expect(count(db, 'passages')).toBeGreaterThan(280);
    expect(count(db, 'page_links')).toBe(500);
    // One statement for every eleven passages or fifty links, not one a row.
    expect(statements.length).toBeLessThan(50);
  });

  it('cuts a title at what is indexed', () => {
    const db = knowledgeDb();
    db.run(index('tab-1', 'T'.repeat(500), []));
    expect(db.rows<{ title: string }>('SELECT title FROM page_trust')[0]!.title).toHaveLength(
      MAX_INDEXED_TITLE_CHARS,
    );
  });

  it('rolls back whole when a statement fails', () => {
    const db = knowledgeDb();
    db.run(index('tab-1', 'Release Process', ['We deploy on Fridays.']));
    expect(() =>
      db.run([
        ...index('tab-1', 'Changed', ['Other.']),
        { sql: 'INSERT INTO no_such_table VALUES (1)', params: [] },
      ]),
    ).toThrow();
    expect(db.rows(`SELECT title FROM page_trust`)).toEqual([{ title: 'Release Process' }]);
  });

  it('deletes a page, keeping the links other pages make to it', () => {
    const db = knowledgeDb();
    db.run(index('tab-1', 'Release Process', ['We deploy on Fridays.'], ['tab-2']));
    db.run(index('tab-2', 'Support', ['Ask in the channel.'], ['tab-1']));
    db.run(deletePageIndex('tab-1'));
    expect(db.rows('SELECT DISTINCT tab FROM passages')).toEqual([{ tab: 'tab-2' }]);
    expect(db.rows('SELECT from_tab, to_tab FROM page_links')).toEqual([
      { from_tab: 'tab-2', to_tab: 'tab-1' },
    ]);
    expect(db.rows('SELECT tab FROM page_trust')).toEqual([{ tab: 'tab-2' }]);
    expect(db.all<SearchRow>(searchPassages('fridays', { now: NOW, reviewEvery: 90 })!)).toEqual(
      [],
    );
    // Deleting a page that is not there is no error.
    db.run(deletePageIndex('tab-9'));
  });

  it('reads backlinks from the link table', () => {
    const db = knowledgeDb();
    db.run(index('tab-1', 'A', ['a'], ['tab-3']));
    db.run(index('tab-2', 'B', ['b'], ['tab-3', 'tab-1']));
    expect(
      db
        .all<{ fromTab: string }>(backlinkRows('tab-3'))
        .map((r) => r.fromTab)
        .sort(),
    ).toEqual(['tab-1', 'tab-2']);
    expect(db.all(backlinkRows('tab-2'))).toEqual([]);
  });

  it('writes Verify without touching the passages', () => {
    const db = knowledgeDb();
    db.run(index('tab-1', 'A', ['a']));
    db.run(putPageTrust('tab-1', 'A', { verifiedAt: NOW }));
    expect(db.rows('SELECT * FROM page_trust')).toEqual([
      { tab: 'tab-1', title: 'A', verified_at: NOW },
    ]);
  });

  it('counts the pages a Review Period makes due, from the index on verified_at', () => {
    const db = knowledgeDb();
    const DAY = 86_400_000;
    db.run(index('never', 'N', ['n']));
    for (const [tab, days] of [
      ['a', 10],
      ['b', 30],
      ['c', 100],
      ['d', 400],
    ] as const) {
      db.run(index(tab, tab, [tab]));
      db.run(putPageTrust(tab, tab, { verifiedAt: NOW - days * DAY }));
    }
    const due = (days: number) => db.all<{ due: number }>(countReviewDue(days, NOW))[0]!.due;
    expect([due(30), due(90), due(180), due(365)]).toEqual([3, 2, 1, 1]);
    const plan = db
      .rows<{ detail: string }>(
        `EXPLAIN QUERY PLAN SELECT COUNT(*) FROM page_trust WHERE verified_at IS NOT NULL AND verified_at <= 1`,
      )
      .map((r) => r.detail)
      .join(' ');
    expect(plan).toContain('page_trust_verified');
  });
});
