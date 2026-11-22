// @vitest-environment jsdom

// The knowledgebase's doors into the universal search, and its first group (docs/specs/030-knowledgebase/
// search-and-ask.md "Search"): Cmd or Ctrl K opens the panel for every role, a knowledgebase kept Offline is searched
// in the browser, one request at a time, and a result opens its page at the passage.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArticleBlock, Tab } from '@liveknowledge/document';
import {
  createEditorChromeStore,
  EditorChromeContext,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { BLOCK_HIT_MS, goToBlock } from '@/lib/knowledge/go-to-block';
import { SEARCH_DEBOUNCE_MS } from '@/lib/knowledge/knowledge-search';

const api = vi.hoisted(() => ({ apiSearchKnowledge: vi.fn() }));
vi.mock('@/lib/api/knowledge', () => api);
const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.value,
}));
const handle = vi.hoisted(() => ({ rangeRect: vi.fn(() => ({ x: 1, y: 2, w: 3, h: 4 })) }));
vi.mock('@/lib/article/article-editor-store', () => ({ articleHandleOf: () => handle }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { useState } from 'react';
import { SearchPanel } from '@/components/panels/SearchPanel';
import { noteRecentPage, readRecentPages } from '@/lib/knowledge/recent-pages';
import { KnowledgeSearchHost } from './KnowledgeSearchHost';
import { useThisKnowledgebaseSearch } from './useThisKnowledgebaseSearch';

const para = (id: string, text: string) =>
  ({ id, type: 'paragraph', runs: [{ text }] }) as ArticleBlock;
const TABS: Tab[] = [
  { id: 'a', name: 'Handbook', elements: [] },
  {
    id: 'b',
    name: 'Release Process',
    elements: [],
    articles: { f: { blocks: [para('blk-1', 'Run the rollback script.')] } },
  },
];

// The panel's first group, as EditorSearchPanel wires it: the host's hook searches for what the field holds.
function Source() {
  const [query, setQuery] = useState('');
  const lead = useThisKnowledgebaseSearch(query, { enabled: true });
  return (
    <SearchPanel
      documents={[]}
      folders={[]}
      onSelectDocument={vi.fn()}
      onClose={vi.fn()}
      lead={lead}
      onQueryChange={setQuery}
    />
  );
}

function mount(level: 'edit' | 'participate' | 'view' = 'view', withSource = false) {
  const setActiveId = vi.fn();
  const scrollIntoView = vi.fn();
  const setSearchOpen = vi.fn();
  const fields: Record<string, unknown> = {
    documentId: 'd1',
    tabs: TABS,
    activeId: 'a',
    activeTab: TABS[0],
    can: resolveEditorCapabilities(level),
    selfParticipant: { id: 'u1', name: 'Priya' },
    sessionShareCode: 'code',
    searchOpen: false,
    setSearchOpen,
    setActiveId,
    scrollIntoView,
  };
  const value = new Proxy(fields, {
    get: (target, key: string) => (key in target ? target[key] : vi.fn()),
  }) as unknown as EditorContextValue;
  render(
    <EditorChromeContext.Provider value={createEditorChromeStore(value)}>
      <KnowledgeSearchHost />
      {withSource ? <Source /> : null}
    </EditorChromeContext.Provider>,
  );
  return { setActiveId, scrollIntoView, setSearchOpen, fields };
}

const chord = (target: Element | Window = window, over: KeyboardEventInit = {}) =>
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
        cancelable: true,
        ...over,
      }),
    );
  });
const type = async (text: string) => {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
  });
};
const passage = {
  id: 'r1',
  tab: 'b',
  isTitle: false,
  title: 'Release Process',
  titleMarked: 'Release Process',
  headings: [],
  snippet: 'Run the \u0002rollback\u0003 script.',
  firstBlock: 'blk-1',
  lastBlock: 'blk-1',
  trust: 'never-verified',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  offline.value = false;
  document.body.innerHTML = '';
  window.localStorage.clear();
});

describe('the search host', () => {
  it.each(['edit', 'participate', 'view'] as const)(
    'Cmd or Ctrl K opens the universal search for a %s session, and no dialog of its own',
    (level) => {
      const first = mount(level);
      chord();
      expect(first.setSearchOpen).toHaveBeenCalledWith(true);
      expect(screen.queryByRole('dialog')).toBeNull();
      cleanup();
      const second = mount(level);
      chord(window, { metaKey: false, ctrlKey: true });
      expect(second.setSearchOpen).toHaveBeenCalledWith(true);
    },
  );

  it('leaves Cmd or Ctrl K to the link field while words are selected in the writing', () => {
    const { setSearchOpen } = mount('edit');
    const writing = document.createElement('div');
    writing.className = 'article-flow';
    writing.textContent = 'Some words';
    document.body.append(writing);
    const range = document.createRange();
    range.selectNodeContents(writing);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    chord(writing);
    expect(setSearchOpen).not.toHaveBeenCalled();
    // A caret alone in the writing: search.
    window.getSelection()!.collapseToEnd();
    chord(writing);
    expect(setSearchOpen).toHaveBeenCalledWith(true);
  });

  it('notes the page someone is on, for the list of recent pages', () => {
    mount('view');
    expect(readRecentPages('d1')).toEqual(['a']);
  });
});

describe('This Knowledgebase, searched', () => {
  it('asks the room’s index with the caller’s share code, and opens the chosen page at its passage', async () => {
    vi.useFakeTimers();
    api.apiSearchKnowledge.mockResolvedValue([passage]);
    const { setActiveId } = mount('view', true);
    await type('rollback');
    expect(api.apiSearchKnowledge).toHaveBeenCalledWith(
      { ownerId: 'u1', shareCode: 'code' },
      'd1',
      'rollback',
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(setActiveId).toHaveBeenCalledWith('b');
  });

  it('aborts the request in flight when the field changes, and sends one request for a burst of typing', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    api.apiSearchKnowledge.mockImplementation(
      (_who: unknown, _id: unknown, _q: unknown, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise(() => {});
      },
    );
    mount('view', true);
    const input = screen.getByRole('combobox');
    for (const text of ['r', 'ro', 'rol']) fireEvent.change(input, { target: { value: text } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    expect(signals).toHaveLength(1);
    await type('roll');
    expect(signals).toHaveLength(2);
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
  });

  it('says No Pages Match in one line when the index finds nothing', async () => {
    vi.useFakeTimers();
    api.apiSearchKnowledge.mockResolvedValue([]);
    mount('view', true);
    await type('holidays');
    expect(document.querySelector('[data-search-lead-note]')!.textContent).toBe('No Pages Match');
  });

  it('searches the pages it holds for a knowledgebase kept Offline, and asks no server', async () => {
    vi.useFakeTimers();
    offline.value = true;
    mount('edit', true);
    await type('rollb');
    expect(api.apiSearchKnowledge).not.toHaveBeenCalled();
    const option = screen.getAllByRole('option')[0]!;
    expect(option.textContent).toContain('Release Process');
    expect(option.querySelector('mark')!.textContent).toBe('rollback');
  });

  it('lists the pages opened most recently while the field is empty', () => {
    noteRecentPage('d1', 'b');
    mount('view', true);
    const first = screen.getAllByRole('group')[0]!;
    expect(first.getAttribute('aria-label')).toBe('This Knowledgebase');
    expect(screen.getAllByRole('option')[0]!.textContent).toContain('Release Process');
    expect(api.apiSearchKnowledge).not.toHaveBeenCalled();
  });
});

describe('opening a page at a block', () => {
  it('waits for the writing to draw the block, brings it into view and lights it for a moment', () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    const setActiveId = vi.fn();
    let activeId = 'a';
    const editor = () => {
      const fields: Record<string, unknown> = {
        activeId,
        activeTab: TABS[1],
        setActiveId,
        scrollIntoView,
      };
      return new Proxy(fields, {
        get: (target, key: string) => (key in target ? target[key] : vi.fn()),
      }) as unknown as EditorContextValue;
    };
    goToBlock(editor, 'b', 'blk-1');
    expect(setActiveId).toHaveBeenCalledWith('b');
    vi.advanceTimersByTime(200);
    expect(scrollIntoView).not.toHaveBeenCalled();
    // The page has opened and drawn its writing.
    activeId = 'b';
    const block = document.createElement('p');
    block.setAttribute('data-block-id', 'blk-1');
    document.body.append(block);
    vi.advanceTimersByTime(50);
    expect(scrollIntoView).toHaveBeenCalledWith(1, 2, 3, 4);
    expect(block.classList.contains('article-search-hit')).toBe(true);
    vi.advanceTimersByTime(BLOCK_HIT_MS);
    expect(block.classList.contains('article-search-hit')).toBe(false);
  });
});
