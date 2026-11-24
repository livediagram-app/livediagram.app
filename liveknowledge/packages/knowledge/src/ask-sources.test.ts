// Sources (search-and-ask.md "Sources"): the source index kept in step with its FTS, the searches only finding read
// sources, the chooser's budgets with pages first, the prompt's source block, and the Unanswered likely rows.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { knowledgeDb } from './__fixtures__/db';
import { ASK_MAX_PASSAGES, ASK_MAX_PASSAGE_CHARS } from './ask-limits';
import { askRequest } from './ask-request';
import {
  ASK_MAX_SOURCE_CHARS,
  ASK_MAX_SOURCE_PASSAGES,
  askSourceSearch,
  chooseAskPassagesWithSources,
  foundSourcePassage,
  sourceSearch,
} from './ask-sources';
import {
  QUESTION_LIKELY_KEPT,
  SOURCE_SCHEMA,
  clearSourceIndex,
  deleteSourceIndex,
  putQuestionLikely,
  readQuestionLikely,
  replaceSourceIndex,
  searchSourceChunks,
  sourceIds,
  type QuestionLikelyRow,
  type SourceSearchRow,
} from './sql/source-index';
import type { FoundPassage } from './sql/search';

function sourceDb() {
  const db = knowledgeDb();
  db.run(SOURCE_SCHEMA.map((sql) => ({ sql, params: [] })));
  return db;
}

const addSource = (
  db: ReturnType<typeof sourceDb>,
  itemId: string,
  app = 'livediagram',
  title = itemId,
) =>
  db.run({
    sql: `INSERT INTO source_items (item_id, app, title, origin, state, updated_at) VALUES (?, ?, ?, 'connected', 'waiting', 1)`,
    params: [itemId, app, title],
  });

const read = (db: ReturnType<typeof sourceDb>, itemId: string, texts: string[], at = 100) =>
  db.run(
    replaceSourceIndex({
      itemId,
      title: `${itemId} name`,
      version: 2,
      readAt: at,
      chunks: texts.map((text, n) => ({
        ref: `t:${n}`,
        title: `Tab ${n}`,
        text,
        place: JSON.stringify({ tabId: 't', elementIds: [`e${n}`] }),
      })),
    }),
  );

const ftsCount = (db: ReturnType<typeof sourceDb>, word: string) =>
  db.rows<{ n: number }>(
    `SELECT COUNT(*) AS n FROM source_passages_fts WHERE source_passages_fts MATCH '${word}'`,
  )[0]!.n;

describe('the source index', () => {
  it('replaces a source whole, keeping the search index in step, and only finds read sources', () => {
    const db = sourceDb();
    addSource(db, 'd1');
    addSource(db, 'd2');
    read(db, 'd1', ['Checkout calls Stripe for payments', 'Refunds go through support']);
    expect(
      db.rows(
        "SELECT state, chunks, chars, version, read_at FROM source_items WHERE item_id = 'd1'",
      ),
    ).toEqual([{ state: 'read', chunks: 2, chars: 60, version: 2, read_at: 100 }]);
    expect(ftsCount(db, 'stripe')).toBe(1);
    read(db, 'd1', ['Checkout calls Adyen now']);
    expect(ftsCount(db, 'stripe')).toBe(0);
    expect(ftsCount(db, 'adyen')).toBe(1);
    // d2 is waiting: nothing of it is found.
    const rows = db.all<SourceSearchRow>(askSourceSearch('How does checkout pay?')!);
    expect(rows.map((r) => [r.itemId, r.app, r.itemName, r.title])).toEqual([
      ['d1', 'livediagram', 'd1 name', 'Tab 0'],
    ]);
    expect(rows[0]!.snippet).toContain('Checkout');
    db.run(clearSourceIndex('d1', 'capped'));
    expect(ftsCount(db, 'adyen')).toBe(0);
    expect(db.rows("SELECT state, chunks FROM source_items WHERE item_id = 'd1'")).toEqual([
      { state: 'capped', chunks: 0 },
    ]);
    db.run(deleteSourceIndex('d1'));
    expect(db.rows('SELECT item_id FROM source_items')).toEqual([{ item_id: 'd2' }]);
    expect(db.all<{ itemId: string }>(sourceIds())).toEqual([{ itemId: 'd2' }]);
  });

  it('makes no search of no words, and finds a typed search by prefix', () => {
    const db = sourceDb();
    addSource(db, 'p1', 'liveplanner');
    read(db, 'p1', ['Launch date moved to March']);
    expect(askSourceSearch('?')).toBeUndefined();
    expect(sourceSearch('')).toBeUndefined();
    expect(searchSourceChunks([], { mode: 'all', limit: 3 })).toBeUndefined();
    expect(db.all<SourceSearchRow>(sourceSearch('launch mar')!).map((r) => r.itemId)).toEqual([
      'p1',
    ]);
  });

  it('reads a large source within a CPU budget', () => {
    const db = sourceDb();
    addSource(db, 'big');
    const texts = Array.from(
      { length: 200 },
      (_, i) => `Chunk ${i} ${'payments checkout words '.repeat(12)}`,
    );
    const ms = cpuMsOf(() => read(db, 'big', texts));
    const searchMs = cpuMsOf(() => db.all(askSourceSearch('checkout payments')!));
    expect(db.rows<{ n: number }>('SELECT COUNT(*) AS n FROM source_passages')[0]!.n).toBe(200);
    expect(ms).toBeLessThan(cpuBudgetMs(200));
    expect(searchMs).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('likely items', () => {
  it('keeps one a question, leaves out those that became sources, and trims to the newest', () => {
    const db = sourceDb();
    db.run(putQuestionLikely('pay', { app: 'livediagram', itemId: 'd9', title: 'Payments' }, 1));
    db.run(putQuestionLikely('pay', { app: 'livediagram', itemId: 'd8', title: 'Payments v2' }, 2));
    db.run(putQuestionLikely('ship', { app: 'liveplanner', itemId: 'p1', title: 'Shipping' }, 3));
    expect(db.all<QuestionLikelyRow>(readQuestionLikely(['pay', 'ship', 'none'])!)).toEqual([
      { key: 'pay', app: 'livediagram', itemId: 'd8', title: 'Payments v2' },
      { key: 'ship', app: 'liveplanner', itemId: 'p1', title: 'Shipping' },
    ]);
    addSource(db, 'p1');
    expect(db.all<QuestionLikelyRow>(readQuestionLikely(['ship'])!)).toEqual([]);
    expect(readQuestionLikely([])).toBeUndefined();
    for (let i = 0; i < QUESTION_LIKELY_KEPT + 5; i++)
      db.run(
        putQuestionLikely(`q${i}`, { app: 'livediagram', itemId: `d${i}`, title: 't' }, 10 + i),
      );
    expect(db.rows<{ n: number }>('SELECT COUNT(*) AS n FROM question_likely')[0]!.n).toBe(
      QUESTION_LIKELY_KEPT,
    );
  });
});

const page = (id: string, chars: number, rank = -1): FoundPassage => ({
  id,
  tab: `tab-${id}`,
  isTitle: false,
  title: `Page ${id}`,
  titleMarked: `Page ${id}`,
  headings: [],
  text: 'p'.repeat(chars),
  textHash: '',
  snippet: '',
  firstBlock: 'b',
  lastBlock: 'b',
  trust: 'verified',
  rank,
});

const source = (id: string, chars: number, rank = -1): FoundPassage =>
  foundSourcePassage({
    id,
    itemId: `item-${id}`,
    app: 'livediagram',
    itemName: 'Checkout Flow',
    title: 'Payments',
    text: 's'.repeat(chars),
    place: '{"tabId":"t"}',
    readAt: null,
    snippet: '',
    rank,
  });

describe('choosing passages with sources', () => {
  it('puts pages first, keeps room for sources, and caps them', () => {
    const pages = Array.from({ length: 4 }, (_, i) => page(`p${i}`, 5_000));
    const sources = Array.from({ length: 10 }, (_, i) => source(`s${i}`, 1_000, -i));
    const chosen = chooseAskPassagesWithSources(pages, sources);
    const pageChars = chosen
      .filter((c) => !c.passage.source)
      .reduce((n, c) => n + c.passage.text.length, 0);
    const sourceChosen = chosen.filter((c) => c.passage.source);
    expect(pageChars).toBeLessThanOrEqual(ASK_MAX_PASSAGE_CHARS - ASK_MAX_SOURCE_CHARS);
    expect(sourceChosen).toHaveLength(ASK_MAX_SOURCE_PASSAGES);
    // Best (lowest rank) first, numbered on after the pages.
    expect(sourceChosen[0]!.passage.id).toBe('s9');
    expect(chosen.map((c) => c.number)).toEqual(chosen.map((_, i) => i + 1));
    expect(chosen.length).toBeLessThanOrEqual(ASK_MAX_PASSAGES);
  });

  it('uses the whole budget for pages when no source was found, and skips a source too long for the room', () => {
    const pages = [page('a', 20_000)];
    expect(chooseAskPassagesWithSources(pages, [])[0]!.passage.text.length).toBe(20_000);
    const chosen = chooseAskPassagesWithSources([], [source('big', 9_000), source('ok', 500)]);
    expect(chosen.map((c) => c.passage.id)).toEqual(['ok']);
    expect(chosen[0]!.passage.trust).toBe('never-verified');
    expect(chosen[0]!.passage.headings).toEqual(['Payments']);
    expect(chosen[0]!.passage.source).toEqual({
      app: 'livediagram',
      itemId: 'item-ok',
      itemName: 'Checkout Flow',
      place: '{"tabId":"t"}',
      readAt: 0,
    });
  });

  it("sends a source as its app's item, with no trust or health, and tells the model so", () => {
    const passages = chooseAskPassagesWithSources(
      [page('a', 40)],
      [
        {
          ...source('s', 30),
          source: { ...source('s', 30).source!, readAt: Date.UTC(2026, 10, 12) },
        },
      ],
    );
    const request = askRequest({ question: 'How do we pay?', passages });
    const text = request.messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(text).toContain('source_app="livediagram"');
    expect(text).toContain('item="Checkout Flow"');
    expect(text).toContain('as_of="2026-11-12"');
    expect(request.system).toContain('nobody has verified here');
  });

  it('sends no place for a chunk named as its item, and no day for one not read', () => {
    const bare = foundSourcePassage({
      id: 'b',
      itemId: 'd1',
      app: 'livehuddle',
      itemName: 'Standup',
      title: 'Standup',
      text: 'Notes',
      place: '{}',
      readAt: null,
      snippet: '',
      rank: -1,
    });
    expect(bare.headings).toEqual([]);
    const { messages } = askRequest({
      question: 'What was said?',
      passages: chooseAskPassagesWithSources([], [bare]),
    });
    const text = typeof messages[0]!.content === 'string' ? messages[0]!.content : '';
    expect(text).toContain('<passage number="1" source_app="livehuddle" item="Standup">');
  });
});
