// @vitest-environment jsdom

// Search (docs/specs/030-knowledgebase/search-and-ask.md "Search"): the marks, one request at a time, the Offline
// search, and the dialog: results as you type, the keys, the empty state, the refusals in words, every role.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import type { ArticleBlock } from '@liveknowledge/document';
import {
  SEARCH_DEBOUNCE_MS,
  createSearchRunner,
  markedParts,
  searchFailureText,
  searchLoadedPages,
  SearchTooLongError,
  type SearchOutcome,
} from '@/lib/knowledge/knowledge-search';
import { isSearchChord, knowledgeSearch } from '@/lib/knowledge/search-open';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { SearchPanel } from '@/components/panels/SearchPanel';
import type { SearchLeadGroup } from '@/components/panels/search-lead-group';
import { noteRecentPage, readRecentPages, RECENT_PAGES_MAX } from '@/lib/knowledge/recent-pages';
import { KnowledgeResultRow } from './KnowledgeResultRow';
import {
  NO_PAGES_MATCH,
  recentResults,
  resultPlace,
  THIS_KNOWLEDGEBASE,
} from './useThisKnowledgebaseSearch';
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

// The dialog is gone (docs/specs/030-knowledgebase/search-and-ask.md "Search"): its results are the first group of the
// universal search panel. What the dialog's tests held is held here, of that group.
const leadOf = (
  results: KnowledgeSearchResult[],
  onOpen: (r: KnowledgeSearchResult) => void,
  over: Partial<SearchLeadGroup> = {},
): SearchLeadGroup => ({
  label: THIS_KNOWLEDGEBASE,
  items: results.map((r) => ({
    id: r.id,
    content: <KnowledgeResultRow result={r} place={resultPlace(PAGES, r)} />,
    onSelect: () => onOpen(r),
  })),
  ...over,
});

function panel(lead: SearchLeadGroup, onClose = vi.fn()) {
  render(
    <SearchPanel
      documents={[{ id: 'd1', name: 'Release notes elsewhere' }]}
      folders={[]}
      onSelectDocument={vi.fn()}
      onClose={onClose}
      lead={lead}
    />,
  );
  return { input: screen.getByRole('combobox'), onClose };
}

describe('This Knowledgebase in the search panel', () => {
  it('is the first group: the page, where it is, its state and the matching lines', () => {
    panel(leadOf([result({})], vi.fn()));
    const groups = screen.getAllByRole('group');
    expect(groups[0]!.getAttribute('aria-label')).toBe('This Knowledgebase');
    const option = screen.getAllByRole('option')[0]!;
    expect(option.textContent).toContain('Release Process');
    expect(option.textContent).toContain('Handbook / Rolling Back');
    expect(option.textContent).toContain('How to roll a release back.');
    expect([...option.querySelectorAll('mark')].map((m) => m.textContent)).toEqual([
      'roll',
      'release',
    ]);
  });

  it('stays first when the panel’s other groups have results too', () => {
    const { input } = panel(leadOf([result({})], vi.fn()));
    fireEvent.change(input, { target: { value: 'release' } });
    const labels = screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'));
    expect(labels[0]).toBe('This Knowledgebase');
    expect(labels.length).toBeGreaterThan(1);
    expect(screen.getAllByRole('option')[0]!.textContent).toContain('Rolling Back');
  });

  it('draws a snippet as text: markup in the writing is never markup here', () => {
    panel(leadOf([result({ snippet: `<img src=x onerror=alert(1)> ${M('roll')}` })], vi.fn()));
    const option = screen.getAllByRole('option')[0]!;
    expect(option.querySelector('img')).toBeNull();
    expect(option.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('moves with the arrows across the groups, and Enter opens the page at the passage', () => {
    const onOpen = vi.fn();
    const second = result({ id: 'r2', tab: 'a', title: 'Handbook', titleMarked: 'Handbook' });
    const { input, onClose } = panel(leadOf([result({}), second], onOpen));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(second);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says No Pages Match in one line, and the other groups follow', () => {
    const { input } = panel(leadOf([], vi.fn(), { note: NO_PAGES_MATCH }));
    fireEvent.change(input, { target: { value: 'release' } });
    const first = screen.getAllByRole('group')[0]!;
    expect(first.getAttribute('aria-label')).toBe('This Knowledgebase');
    expect(first.querySelector('[data-search-lead-note]')!.textContent).toBe('No Pages Match');
    expect(screen.getByRole('option', { name: /Release notes elsewhere/ })).toBeTruthy();
  });

  it('says a failure in words, as an alert, and still lists the other groups', () => {
    const words = searchFailureText(new SearchTooLongError(), () => '');
    panel(leadOf([], vi.fn(), { note: words, alert: true }));
    expect(screen.getByRole('alert').textContent).toContain('200');
  });

  it('tells its host what is typed, so the host searches by itself', () => {
    const onQueryChange = vi.fn();
    render(
      <SearchPanel
        documents={[]}
        folders={[]}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
        lead={leadOf([], vi.fn())}
        onQueryChange={onQueryChange}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'roll' } });
    expect(onQueryChange).toHaveBeenCalledWith('roll');
  });
});

describe('the pages opened most recently', () => {
  const pages = [
    { id: 'a', name: 'Handbook' },
    { id: 'b', name: 'Release Process', parent: 'a' },
    { id: 'c', name: '' },
  ];

  it('lists them newest first while the field is empty, a page that is gone left out', () => {
    const got = recentResults(pages, ['b', 'gone', 'a'], Date.now());
    expect(got.map((r) => r.tab)).toEqual(['b', 'a']);
    expect(got.every((r) => r.isTitle && r.firstBlock === '')).toBe(true);
    expect(resultPlace(pages, got[0]!)).toBe('Handbook');
  });

  it('keeps eight a knowledgebase, per browser, and writes nothing for the page already first', () => {
    window.localStorage.clear();
    for (let i = 1; i <= 12; i++) noteRecentPage('kb1', `p${i}`);
    expect(readRecentPages('kb1')).toHaveLength(RECENT_PAGES_MAX);
    expect(readRecentPages('kb1')[0]).toBe('p12');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    noteRecentPage('kb1', 'p12');
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
    noteRecentPage('kb1', 'p3');
    expect(readRecentPages('kb1').slice(0, 2)).toEqual(['p3', 'p12']);
    expect(readRecentPages('kb2')).toEqual([]);
    expect(readRecentPages(null)).toEqual([]);
  });
});

describe('the doors', () => {
  it('the Search field asks for the search for every role: it is given no role at all', () => {
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
