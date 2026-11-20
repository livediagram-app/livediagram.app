// @vitest-environment jsdom

// Search (docs/specs/030-knowledgebase/search-and-ask.md "Search"): the marks, one request at a time, the Offline
// search, and the dialog: results as you type, the keys, the empty state, the refusals in words, every role.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import type { ArticleBlock } from '@liveknowledge/document';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import {
  SEARCH_DEBOUNCE_MS,
  createSearchRunner,
  markedParts,
  searchLoadedPages,
  type SearchOutcome,
} from '@/lib/knowledge/knowledge-search';
import { isSearchChord, knowledgeSearch } from '@/lib/knowledge/search-open';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { SearchDialog } from './SearchDialog';
import { SearchField } from './SearchField';

const M = (word: string) => `\u0002${word}\u0003`;
const result = (over: Partial<KnowledgeSearchResult>): KnowledgeSearchResult => ({
  id: 'r1',
  tab: 'b',
  isTitle: false,
  title: 'Release Process',
  titleMarked: 'Release Process',
  headings: ['Rolling Back'],
  snippet: `How to ${M('roll')} a ${M('release')} back.`,
  firstBlock: 'blk-1',
  lastBlock: 'blk-2',
  trust: 'verified',
  ...over,
});
const PAGES = [
  { id: 'a', name: 'Handbook' },
  { id: 'b', name: 'Release Process', parent: 'a' },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  knowledgeSearch.close();
});

describe('the marks', () => {
  it('reads a snippet as text and marked words, and anything else as text', () => {
    expect(markedParts(`a ${M('roll')} b`)).toEqual([
      { text: 'a ', marked: false },
      { text: 'roll', marked: true },
      { text: ' b', marked: false },
    ]);
    expect(markedParts('<img src=x onerror=alert(1)>')).toEqual([
      { text: '<img src=x onerror=alert(1)>', marked: false },
    ]);
    expect(markedParts('')).toEqual([]);
  });
});

describe('one search at a time', () => {
  function runner() {
    const calls: {
      query: string;
      signal: AbortSignal;
      answer: (r: KnowledgeSearchResult[]) => void;
      fail: (e: unknown) => void;
    }[] = [];
    const told: SearchOutcome[] = [];
    const r = createSearchRunner(
      (query, signal) =>
        new Promise((answer, fail) => {
          calls.push({ query, signal, answer, fail });
        }),
      (outcome) => told.push(outcome),
    );
    return { r, calls, told };
  }

  it('waits for the typing to rest, then sends once', () => {
    const { r, calls } = runner();
    r.search('r');
    r.search('ro');
    r.search('roll');
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(calls.map((c) => c.query)).toEqual(['roll']);
  });

  it('aborts the request in flight when a newer search starts, and drops its answer', async () => {
    const { r, calls, told } = runner();
    r.search('roll');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    r.search('rollback');
    expect(calls[0]!.signal.aborted).toBe(true);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(calls).toHaveLength(2);
    // Never two in flight: the first was aborted before the second was sent.
    expect(calls.filter((c) => !c.signal.aborted)).toHaveLength(1);
    calls[0]!.answer([result({ id: 'stale' })]);
    calls[1]!.answer([result({ id: 'fresh' })]);
    await vi.runAllTimersAsync();
    const done = told.filter((t) => t.status === 'done');
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ query: 'rollback', results: [{ id: 'fresh' }] });
  });

  it('sends nothing for no words, or past 200 characters, and says the limit', () => {
    const { r, calls, told } = runner();
    r.search('   ');
    expect(told.at(-1)).toEqual({ status: 'idle' });
    r.search('x'.repeat(201));
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(calls).toHaveLength(0);
    expect(told.at(-1)).toMatchObject({ status: 'failed' });
    r.search('roll');
    r.stop();
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(calls).toHaveLength(0);
  });
});

describe('searching a knowledgebase kept Offline', () => {
  const para = (id: string, text: string, style?: string) =>
    ({ id, type: 'paragraph', ...(style ? { style } : {}), runs: [{ text }] }) as ArticleBlock;
  const pages = [
    {
      id: 'a',
      name: 'Release Process',
      knowledge: { verifiedAt: Date.UTC(2026, 10, 19) },
      articles: {
        f: {
          blocks: [
            para('t', 'Release Process', 'title'),
            para('h', 'Rolling Back', 'h1'),
            para('p', 'Run the rollback script, then tell the release channel.'),
          ],
        },
      },
    },
    {
      id: 'b',
      name: 'Holidays',
      articles: { f: { blocks: [para('q', 'Nothing about shipping.')] } },
    },
    // A page whose writing this browser does not hold: its title is still searched.
    { id: 'c', name: 'Rollback Drills' },
  ];
  const now = Date.UTC(2026, 10, 20);

  it('finds titles first, then passages, with the words marked and the passage’s blocks', () => {
    const found = searchLoadedPages(pages, 'rollb', now);
    expect(found.map((r) => [r.tab, r.isTitle])).toEqual([
      ['c', true],
      ['a', false],
    ]);
    expect(found[0]!.titleMarked).toBe(`${M('Rollback')} Drills`);
    expect(found[1]).toMatchObject({
      title: 'Release Process',
      headings: ['Rolling Back'],
      firstBlock: 'h',
      trust: 'verified',
    });
    expect(found[1]!.snippet).toContain(M('rollback'));
  });

  it('needs every word, and finds nothing for none', () => {
    expect(searchLoadedPages(pages, 'release channel', now).map((r) => r.tab)).toEqual(['a']);
    expect(searchLoadedPages(pages, 'release holidays', now)).toEqual([]);
    expect(searchLoadedPages(pages, '  ', now)).toEqual([]);
  });
});

function open(search = vi.fn(async () => [] as KnowledgeSearchResult[])) {
  const onOpen = vi.fn();
  const onClose = vi.fn();
  render(<SearchDialog onClose={onClose} search={search} pages={PAGES} onOpen={onOpen} />);
  const input = screen.getByRole('combobox', { name: 'Search This Knowledgebase' });
  const type = async (text: string) => {
    fireEvent.change(input, { target: { value: text } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
  };
  return { input, type, onOpen, onClose, search };
}

describe('the dialog', () => {
  it('lists results as you type: the page, where it is, its state and the matching lines', async () => {
    const d = open(
      vi.fn(async () => [
        result({ id: 't', isTitle: true, titleMarked: `${M('Release')} Process`, snippet: '' }),
        result({}),
      ]),
    );
    await d.type('release');
    expect(d.search).toHaveBeenCalledTimes(1);
    expect(d.search).toHaveBeenCalledWith('release', expect.any(AbortSignal));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]!.textContent).toContain('Release Process');
    // The page's ancestors, then the passage's headings.
    expect(options[1]!.textContent).toContain('Handbook / Rolling Back');
    expect(options[1]!.querySelectorAll('mark')).toHaveLength(2);
    expect(options[1]!.querySelector('mark')!.textContent).toBe('roll');
    expect(screen.getAllByRole('img', { name: 'Verified' })).toHaveLength(2);
  });

  it('draws a snippet as text: markup in the writing is never markup here', async () => {
    const d = open(
      vi.fn(async () => [result({ snippet: `<img src=x onerror=alert(1)> ${M('roll')}` })]),
    );
    await d.type('roll');
    const option = screen.getByRole('option');
    expect(option.querySelector('img')).toBeNull();
    expect(option.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('moves with the arrows, and Enter opens the page at the passage', async () => {
    const hits = [result({ id: 'one' }), result({ id: 'two', firstBlock: 'blk-9' })];
    const d = open(vi.fn(async () => hits));
    await d.type('roll');
    fireEvent.keyDown(d.input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    expect(d.input.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[1]!.id,
    );
    fireEvent.keyDown(d.input, { key: 'ArrowDown' });
    fireEvent.keyDown(d.input, { key: 'ArrowUp' });
    fireEvent.keyDown(d.input, { key: 'Enter' });
    expect(d.onOpen).toHaveBeenCalledWith(hits[1]);
    expect(d.onClose).toHaveBeenCalled();
  });

  it('says so when nothing matches, with the shared empty state', async () => {
    const d = open();
    await d.type('zzz');
    expect(screen.getByRole('status').textContent).toMatch(/No pages match/);
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('says the 200 character limit and a rate limit in words', async () => {
    const d = open(
      vi.fn().mockRejectedValue(new ApiError('search knowledge', 429, 'rate_limited')),
    );
    await d.type('roll');
    expect(screen.getByRole('alert').textContent).toMatch(/Too many searches/);
    await d.type('x'.repeat(201));
    expect(screen.getByRole('alert').textContent).toBe('A search is at most 200 characters.');
    expect(d.search).toHaveBeenCalledTimes(1);
  });

  it('keeps its size whatever it lists', async () => {
    const d = open(vi.fn(async () => [result({})]));
    const frame = document.querySelector('[data-knowledge-search]')!;
    const before = frame.className;
    await d.type('roll');
    expect(frame.className).toBe(before);
    expect(before).toContain('h-[min(70dvh,560px)]');
  });
});

describe('the doors', () => {
  it('the Search field opens the dialog for every role: it is given no role at all', () => {
    render(<SearchField />);
    expect(knowledgeSearch.isOpen()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(knowledgeSearch.isOpen()).toBe(true);
  });

  it('Cmd or Ctrl K is the chord, and nothing else', () => {
    const key = (over: object) => ({
      key: 'k',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      ...over,
    });
    expect(isSearchChord(key({ metaKey: true }))).toBe(true);
    expect(isSearchChord(key({ ctrlKey: true, key: 'K' }))).toBe(true);
    expect(isSearchChord(key({}))).toBe(false);
    expect(isSearchChord(key({ metaKey: true, shiftKey: true }))).toBe(false);
    expect(isSearchChord(key({ metaKey: true, key: 'j' }))).toBe(false);
  });
});
