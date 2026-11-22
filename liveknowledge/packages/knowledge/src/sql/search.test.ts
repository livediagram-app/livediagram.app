import { describe, expect, it } from 'vitest';
import { knowledgeDb } from '../__fixtures__/db';
import { flowOf, para } from '../__fixtures__/writing';
import { pagePassages } from '../passages';
import { replacePageIndex, type PageTrustRow } from './page-index';
import {
  MATCH_END,
  MATCH_START,
  SEARCH_MAX_QUERY_CHARS,
  SEARCH_MAX_RESULTS,
  SEARCH_MAX_TERMS,
  foundPassage,
  ftsExpression,
  searchByTerms,
  searchPassages,
  searchTerms,
  type SearchOptions,
  type SearchRow,
} from './search';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20);

function seeded() {
  const db = knowledgeDb();
  const add = (tab: string, title: string, body: string[], trust: PageTrustRow = {}) =>
    db.run(
      replacePageIndex({
        tab,
        title,
        passages: pagePassages(
          tab,
          flowOf(...body.map((text, at) => para(text, at === 0 ? 'h1' : undefined))),
        ),
        links: [],
        trust,
      }),
    );
  add('never', 'Deploy Notes', ['Old Notes', 'We deploy the api on Fridays, said someone once.']);
  add('verified', 'Release Process', ['Deploys', 'We deploy the api on Tuesdays after review.'], {
    verifiedAt: NOW - DAY,
  });
  add('due', 'Runbook', ['Emergency', 'To deploy the api in an emergency, page the owner.'], {
    verifiedAt: NOW - 100 * DAY,
  });
  add('ageless', 'Glossary', ['Terms', 'API: the service we deploy. Café: where we meet.'], {
    verifiedAt: NOW - 2 * DAY,
  });
  const search = (query: string, options: Partial<SearchOptions> = {}) => {
    const statement = searchPassages(query, { now: NOW, reviewEvery: 90, ...options });
    return statement ? db.all<SearchRow>(statement).map(foundPassage) : undefined;
  };
  return { db, search };
}

describe('a query made safe', () => {
  it('keeps letters and digits, lowercased', () => {
    expect(searchTerms('  Deploy the API-v2, "now"! ')).toEqual([
      'deploy',
      'the',
      'api',
      'v2',
      'now',
    ]);
    expect(searchTerms('Café ＡＢＣ')).toEqual(['café', 'abc']);
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('"" * ( ) : ^ - +')).toEqual([]);
  });

  it('caps the characters and the terms', () => {
    expect(searchTerms(`${'a'.repeat(SEARCH_MAX_QUERY_CHARS)} tail`)).toEqual([
      'a'.repeat(SEARCH_MAX_QUERY_CHARS),
    ]);
    const many = Array.from({ length: 40 }, (_x, at) => `w${at}`).join(' ');
    expect(searchTerms(many)).toHaveLength(SEARCH_MAX_TERMS);
  });

  it("quotes every term, so no operator of the person's survives", () => {
    expect(ftsExpression(searchTerms('deploy AND api OR NOT text:secret NEAR(a b)'), 'all')).toBe(
      '"deploy" "and" "api" "or" "not" "text" "secret" "near" "a" "b"*',
    );
    expect(ftsExpression(['deploy', 'api'], 'any')).toBe('"deploy" OR "api"');
    expect(ftsExpression(['say "hi"', ' ', '"'], 'all')).toBe('"say hi"*');
    expect(ftsExpression([], 'all')).toBeUndefined();
    expect(ftsExpression(Array(30).fill('x'), 'any')!.split(' OR ')).toHaveLength(SEARCH_MAX_TERMS);
  });

  it('answers no statement for a query without words', () => {
    expect(searchPassages(' "*" ', { now: NOW, reviewEvery: 90 })).toBeUndefined();
    expect(searchByTerms([], { now: NOW, reviewEvery: 90 })).toBeUndefined();
  });
});

describe('search', () => {
  it('finds passages by stem, with the page, its headings and the words marked', () => {
    const { search } = seeded();
    const [first] = search('tuesdays')!;
    expect(first).toMatchObject({
      tab: 'verified',
      isTitle: false,
      title: 'Release Process',
      titleMarked: 'Release Process',
      headings: ['Deploys'],
      trust: 'verified',
      verifiedAt: NOW - DAY,
    });
    expect(first!.snippet).toContain(`${MATCH_START}Tuesdays${MATCH_END}`);
    expect(search('deploying')!.length).toBeGreaterThan(0);
  });

  it('puts title hits first, then verified pages, then the rest', () => {
    const { search } = seeded();
    const found = search('deploy')!;
    expect(found[0]).toMatchObject({ tab: 'never', isTitle: true, text: '' });
    expect(found[0]!.titleMarked).toBe(`${MATCH_START}Deploy${MATCH_END} Notes`);
    const passages = found.filter((f) => !f.isTitle);
    expect(passages.map((f) => f.trust)).toEqual([
      'verified',
      'verified',
      'review-due',
      'never-verified',
    ]);
    expect(
      passages
        .slice(0, 2)
        .map((f) => f.tab)
        .sort(),
    ).toEqual(['ageless', 'verified']);
    expect(passages[3]).not.toHaveProperty('verifiedAt');
  });

  it('works out verified from the clock handed in', () => {
    const { search } = seeded();
    const trustAt = (now: number) => search('tuesdays', { now })![0]!.trust;
    expect(trustAt(NOW)).toBe('verified');
    expect(trustAt(NOW + 89 * DAY)).toBe('review-due');
  });

  it("works out due from the knowledgebase's Review Period, with no row rewritten", () => {
    const { db, search } = seeded();
    const rows = () => db.rows('SELECT * FROM page_trust ORDER BY tab');
    const before = rows();
    const trustOf = (reviewEvery: SearchOptions['reviewEvery']) =>
      Object.fromEntries(
        search('deploy', { reviewEvery, passagesOnly: true })!.map((f) => [f.tab, f.trust]),
      );
    expect(trustOf(90)).toMatchObject({ verified: 'verified', due: 'review-due' });
    expect(trustOf(365)).toMatchObject({ verified: 'verified', due: 'verified' });
    expect(trustOf('never')).toEqual({ verified: 'off', due: 'off', ageless: 'off', never: 'off' });
    // To the millisecond: a page verified exactly a period ago is due.
    expect(search('tuesdays', { reviewEvery: 30, now: NOW + 29 * DAY })![0]!.trust).toBe(
      'review-due',
    );
    expect(search('tuesdays', { reviewEvery: 30, now: NOW + 29 * DAY - 1 })![0]!.trust).toBe(
      'verified',
    );
    expect(rows()).toEqual(before);
  });

  // verification.md "Under a Review Period of Never": no result is marked, dated or ranked first for it.
  it('under Never, marks no result, drops its date and ranks by match alone', () => {
    const { search } = seeded();
    const never = search('deploy', { reviewEvery: 'never', passagesOnly: true })!;
    expect(never.every((f) => f.trust === 'off' && !('verifiedAt' in f))).toBe(true);
    const byRank = [...never].sort((a, b) => a.rank - b.rank).map((f) => f.tab);
    expect(never.map((f) => f.tab)).toEqual(byRank);
  });

  it('needs every word, the last as a prefix', () => {
    const { search } = seeded();
    expect(search('deploy emergency')!.map((f) => f.tab)).toEqual(['due']);
    expect(search('deploy emerg')!.map((f) => f.tab)).toEqual(['due']);
    expect(search('deploy zebra')).toEqual([]);
  });

  it('takes any word for a question', () => {
    const { search } = seeded();
    const found = search('zebra emergency tuesdays', { mode: 'any', passagesOnly: true })!;
    expect(found.map((f) => f.tab).sort()).toEqual(['due', 'verified']);
  });

  it('leaves title rows or a page out when asked', () => {
    const { search } = seeded();
    expect(search('deploy', { passagesOnly: true })!.every((f) => !f.isTitle)).toBe(true);
    expect(search('deploy', { exceptTab: 'never' })!.every((f) => f.tab !== 'never')).toBe(true);
  });

  it('folds diacritics and case', () => {
    const { search } = seeded();
    expect(search('CAFE')!.map((f) => f.tab)).toEqual(['ageless']);
  });

  it('returns at most 20, or the limit asked for', () => {
    const { db, search } = seeded();
    for (let n = 0; n < 30; n++) {
      db.run(
        replacePageIndex({
          tab: `extra-${n}`,
          title: `Extra ${n}`,
          passages: pagePassages(`extra-${n}`, flowOf(para('The zebra crossing rules.'))),
          links: [],
          trust: {},
        }),
      );
    }
    expect(search('zebra')).toHaveLength(SEARCH_MAX_RESULTS);
    expect(search('zebra', { limit: 500 })).toHaveLength(SEARCH_MAX_RESULTS);
    expect(search('zebra', { limit: 3.9 })).toHaveLength(3);
    expect(search('zebra', { limit: 0 })).toHaveLength(1);
  });

  it('treats what a person types as words, never as a query', () => {
    const { search } = seeded();
    for (const query of [
      '"',
      'deploy"',
      'text:deploy',
      'deploy NOT api',
      'NEAR(deploy api)',
      '^deploy',
      'a* OR',
      "'; DROP TABLE passages; --",
    ]) {
      expect(() => search(query)).not.toThrow();
    }
    expect(search('title:zebra')).toEqual([]);
  });
});

describe('a search row read', () => {
  it('survives headings that are not a list of strings', () => {
    const row: SearchRow = {
      id: 'p1',
      tab: 't',
      ordinal: 0,
      headings: '{"not":"a list"}',
      text: 'x',
      textHash: 'h',
      firstBlock: 'b1',
      lastBlock: 'b1',
      title: 'T',
      titleMarked: 'T',
      snippet: 'x',
      verifiedAt: null,
      trust: 9,
      rank: -1,
    };
    expect(foundPassage(row).headings).toEqual([]);
    expect(foundPassage(row).trust).toBe('never-verified');
    expect(foundPassage({ ...row, headings: 'not json' }).headings).toEqual([]);
    expect(foundPassage({ ...row, headings: '["A", 3, "B"]' }).headings).toEqual(['A', 'B']);
  });
});
