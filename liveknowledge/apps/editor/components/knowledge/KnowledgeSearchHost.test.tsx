// @vitest-environment jsdom

// The search dialog's host (docs/specs/030-knowledgebase/search-and-ask.md "Search"): Cmd or Ctrl K opens it for
// every role, a knowledgebase kept Offline is searched in the browser, and a result opens its page at the passage.
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

import { KnowledgeSearchHost } from './KnowledgeSearchHost';

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

function mount(level: 'edit' | 'participate' | 'view' = 'view') {
  const setActiveId = vi.fn();
  const scrollIntoView = vi.fn();
  const fields: Record<string, unknown> = {
    documentId: 'd1',
    tabs: TABS,
    activeId: 'a',
    activeTab: TABS[0],
    can: resolveEditorCapabilities(level),
    selfParticipant: { id: 'u1', name: 'Priya' },
    sessionShareCode: 'code',
    setActiveId,
    scrollIntoView,
  };
  const value = new Proxy(fields, {
    get: (target, key: string) => (key in target ? target[key] : vi.fn()),
  }) as unknown as EditorContextValue;
  render(
    <EditorChromeContext.Provider value={createEditorChromeStore(value)}>
      <KnowledgeSearchHost />
    </EditorChromeContext.Provider>,
  );
  return { setActiveId, scrollIntoView, fields };
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  offline.value = false;
  document.body.innerHTML = '';
});

describe('the search host', () => {
  it.each(['edit', 'participate', 'view'] as const)(
    'Cmd or Ctrl K opens search for a %s session',
    (level) => {
      mount(level);
      expect(screen.queryByRole('dialog')).toBeNull();
      chord();
      expect(screen.getByRole('dialog', { name: 'Search This Knowledgebase' })).toBeTruthy();
      cleanup();
      mount(level);
      chord(window, { metaKey: false, ctrlKey: true });
      expect(screen.getByRole('dialog')).toBeTruthy();
    },
  );

  it('leaves Cmd or Ctrl K to the link field while words are selected in the writing', () => {
    mount('edit');
    const writing = document.createElement('div');
    writing.className = 'article-flow';
    writing.textContent = 'Some words';
    document.body.append(writing);
    const range = document.createRange();
    range.selectNodeContents(writing);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    chord(writing);
    expect(screen.queryByRole('dialog')).toBeNull();
    // A caret alone in the writing: search.
    window.getSelection()!.collapseToEnd();
    chord(writing);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('asks the room’s index with the caller’s share code, and opens the chosen page at its passage', async () => {
    vi.useFakeTimers();
    api.apiSearchKnowledge.mockResolvedValue([
      {
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
      },
    ]);
    const { setActiveId } = mount('view');
    chord();
    await type('rollback');
    expect(api.apiSearchKnowledge).toHaveBeenCalledWith(
      { ownerId: 'u1', shareCode: 'code' },
      'd1',
      'rollback',
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole('option'));
    expect(setActiveId).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('searches the pages it holds for a knowledgebase kept Offline, and asks no server', async () => {
    vi.useFakeTimers();
    offline.value = true;
    mount('edit');
    chord();
    await type('rollb');
    expect(api.apiSearchKnowledge).not.toHaveBeenCalled();
    expect(screen.getByRole('option').textContent).toContain('Release Process');
    expect(screen.getByRole('option').querySelector('mark')!.textContent).toBe('rollback');
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
