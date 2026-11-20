// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeSearchResult, KnowledgeSummaryResponse } from '@liveknowledge/api-schema';
import { ARRIVAL_KEY, handArrival, takeArrival } from './arrival-handoff';
import {
  HOME_KNOWLEDGEBASES_MAX,
  HOME_SUMMARY_TTL_MS,
  createSummaryCache,
  firstNameOf,
  homeKnowledgebases,
  mergeSearchResults,
  pagesText,
  recentPagesAcross,
  reviewKey,
  reviewPagesAcross,
  verifiedPercent,
} from './home-data';

const item = (id: string, updatedAt: number, over = {}) => ({
  id,
  title: `KB ${id}`,
  updatedAt,
  lastOpenedAt: null,
  trashedAt: null,
  ...over,
});
const summary = (over: Partial<KnowledgeSummaryResponse> = {}): KnowledgeSummaryResponse => ({
  pages: 64,
  health: { verified: 59, reviewDue: 3, neverVerified: 2, total: 64 },
  recent: [],
  yoursToReview: [],
  ...over,
});
const result = (id: string, isTitle = false): KnowledgeSearchResult => ({
  id,
  tab: `tab-${id}`,
  isTitle,
  title: id,
  titleMarked: id,
  headings: [],
  snippet: '',
  firstBlock: 'b',
  lastBlock: 'b',
  trust: 'verified',
});

afterEach(() => sessionStorage.clear());

describe('the knowledgebases Home shows', () => {
  it('are the most recent first, opened or changed, twelve at most', () => {
    const items = Array.from({ length: 15 }, (_, i) => item(`k${i}`, i));
    items.push(item('opened', 1, { lastOpenedAt: 99 }));
    const { shown, total } = homeKnowledgebases(items);
    expect(total).toBe(16);
    expect(shown).toHaveLength(HOME_KNOWLEDGEBASES_MAX);
    expect(shown.slice(0, 2).map((k) => k.id)).toEqual(['opened', 'k14']);
  });

  it('leave out what is in the Trash or Archived, and name one with no name', () => {
    const { shown } = homeKnowledgebases([
      item('a', 3, { trashedAt: 5 }),
      item('b', 2, { archivedAt: 5 }),
      item('c', 1, { title: '  ' }),
    ]);
    expect(shown).toEqual([{ id: 'c', name: 'Untitled Knowledgebase', at: 1 }]);
  });
});

describe('the numbers on a card', () => {
  it('say the pages and the share verified', () => {
    expect(pagesText(64)).toBe('64 pages');
    expect(pagesText(1)).toBe('1 page');
    expect(pagesText(1200)).toBe('1,200 pages');
    expect(verifiedPercent(summary().health)).toBe(92);
    expect(verifiedPercent({ verified: 0, reviewDue: 0, neverVerified: 0, total: 0 })).toBeNull();
  });
});

describe('Recently Updated', () => {
  it('is the eight pages changed last across the knowledgebases read so far', () => {
    const kbs = [
      { id: 'a', name: 'Handbook', at: 2 },
      { id: 'b', name: 'Runbooks', at: 1 },
      { id: 'c', name: 'Not Read Yet', at: 0 },
    ];
    const recent = (n: number, from: number) =>
      Array.from({ length: n }, (_, i) => ({
        tab: `t${from + i}`,
        title: `P${from + i}`,
        updatedAt: from + i,
      }));
    const pages = recentPagesAcross(
      kbs,
      new Map([
        ['a', summary({ recent: recent(6, 100) })],
        ['b', summary({ recent: recent(6, 103) })],
      ]),
    );
    expect(pages).toHaveLength(8);
    expect(pages[0]).toEqual({
      documentId: 'b',
      knowledgebase: 'Runbooks',
      tab: 't108',
      title: 'P108',
      updatedAt: 108,
    });
    expect(pages.map((p) => p.updatedAt)).toEqual(
      [...pages.map((p) => p.updatedAt)].sort((x, y) => y - x),
    );
  });
});

describe('a search across knowledgebases', () => {
  const a = { id: 'a', name: 'Handbook', at: 2 };
  const b = { id: 'b', name: 'Runbooks', at: 1 };
  it('takes each knowledgebase by its own rank, titles ahead at each rank', () => {
    const merged = mergeSearchResults([
      { knowledgebase: a, results: [result('a1'), result('a2')] },
      { knowledgebase: b, results: [result('b1', true), result('b2'), result('b3')] },
    ]);
    expect(merged.map((r) => r.id)).toEqual(['b1', 'a1', 'a2', 'b2', 'b3']);
    expect(merged[0]).toMatchObject({ documentId: 'b', knowledgebase: 'Runbooks' });
  });
  it('stops at the cap', () => {
    const many = Array.from({ length: 20 }, (_, i) => result(`a${i}`));
    expect(mergeSearchResults([{ knowledgebase: a, results: many }], 12)).toHaveLength(12);
    expect(mergeSearchResults([])).toEqual([]);
  });
});

describe('the summary cache', () => {
  it('reads a knowledgebase once a minute, and a failed read again at once', async () => {
    let clock = 0;
    const read = vi.fn((id: string) =>
      id === 'bad' ? Promise.reject(new Error('down')) : Promise.resolve(summary()),
    );
    const cache = createSummaryCache(read, () => clock);
    await cache.get('a');
    await cache.get('a');
    expect(read).toHaveBeenCalledTimes(1);
    clock = HOME_SUMMARY_TTL_MS;
    await cache.get('a');
    expect(read).toHaveBeenCalledTimes(2);
    await expect(cache.get('bad')).rejects.toThrow('down');
    await expect(cache.get('bad')).rejects.toThrow('down');
    expect(read).toHaveBeenCalledTimes(4);
  });
});

describe('Yours to Review across knowledgebases', () => {
  const kbs = [
    { id: 'a', name: 'Handbook', at: 2 },
    { id: 'b', name: 'Runbooks', at: 1 },
  ];
  const summaries = new Map([
    [
      'a',
      summary({
        yoursToReview: [
          { tab: 't2', title: 'On Call', reviewAt: 300 },
          { tab: 't1', title: 'Releases', reviewAt: 100 },
        ],
      }),
    ],
    ['b', summary({ yoursToReview: [{ tab: 't9', title: 'Rotas', reviewAt: 200 }] })],
  ]);

  it('lists every knowledgebase’s due pages together, the longest overdue first', () => {
    expect(reviewPagesAcross(kbs, summaries).map((p) => [p.knowledgebase, p.title])).toEqual([
      ['Handbook', 'Releases'],
      ['Runbooks', 'Rotas'],
      ['Handbook', 'On Call'],
    ]);
  });

  it('leaves out a page verified here, and reads a summary with no list as none', () => {
    const done = new Set([reviewKey({ documentId: 'a', tab: 't1' })]);
    expect(reviewPagesAcross(kbs, summaries, done).map((p) => p.title)).toEqual([
      'Rotas',
      'On Call',
    ]);
    const older = new Map([['a', { ...summary(), yoursToReview: undefined } as never]]);
    expect(reviewPagesAcross(kbs, older)).toEqual([]);
  });

  it('reads a knowledgebase’s summary again once it is dropped', async () => {
    const read = vi.fn(async () => summary());
    const cache = createSummaryCache(read, () => 0);
    await cache.get('a');
    cache.drop('a');
    await cache.get('a');
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('a first name', () => {
  it('is the first word of the account name', () => {
    expect(firstNameOf('Thomas McClean')).toBe('Thomas');
    expect(firstNameOf('  ')).toBe('');
    expect(firstNameOf(null)).toBe('');
  });
});

describe('what Home hands the editor', () => {
  it('is taken once, by the knowledgebase it names', () => {
    handArrival({ kind: 'ask', documentId: 'd1', question: 'How?' }, 1000);
    expect(takeArrival('import', 'd1', 1001)).toBeNull();
    expect(takeArrival('ask', 'd2', 1001)).toBeNull();
    expect(takeArrival('ask', 'd1', 1001)).toEqual({
      kind: 'ask',
      documentId: 'd1',
      question: 'How?',
    });
    expect(takeArrival('ask', 'd1', 1002)).toBeNull();
  });
  it('goes to the knowledgebase about to be made when it names none', () => {
    handArrival({ kind: 'import', documentId: null }, 1000);
    expect(takeArrival('import', 'new-one', 1500)).toEqual({ kind: 'import', documentId: null });
  });
  it('is dropped when stale or not a handoff', () => {
    handArrival({ kind: 'import', documentId: null }, 0);
    expect(takeArrival('import', 'd1', 120_000)).toBeNull();
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull();
    sessionStorage.setItem(ARRIVAL_KEY, 'not json');
    expect(takeArrival('import', 'd1')).toBeNull();
  });
});
