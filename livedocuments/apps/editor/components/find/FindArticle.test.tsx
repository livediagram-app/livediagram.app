// @vitest-environment jsdom

// Work Tracker 1051: Find over an article's heading, paragraph and list item, as the editor holds it. The writing is
// committed to the tab while the bar is shut (a typing commit renders nothing in the Find host), then the bar opens
// seeded from a selection in the writing, and Replace, Replace All and Undo work on the matches
// (docs/specs/007-editor/find-and-replace.md "Opening and closing", "Replace").
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Tab } from '@livedocuments/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { blockSearchText } from '@/lib/find/find-targets';
import { fixtureTab, rowsOf } from '@/test/find-fixture';
import type { FindDoor } from '@/hooks/editor/useFindReplace';
import {
  createEditorChromeStore,
  EditorChromeContext,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { EditorFindHost } from './FindHost';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/text-hug', () => ({ hugsText: () => false, hugTextSize: () => ({}) }));
vi.mock('@/components/canvas/text-hug-measure', () => ({ measureDrawnText: () => () => ({}) }));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

// The host lazy-loads the bar and shows a stand-in (a Find box, no Replace row) until it lands. A cold import under a
// coverage run on a busy runner can outlast a findBy's second, so the bar's module is loaded once before the tests.
beforeAll(async () => {
  await import('./FindBar');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

const base = fixtureTab();
const pages = rowsOf(base);
const can = resolveEditorCapabilities('edit');

const article = (heading: string, para: string, item: string): Tab => ({
  ...base,
  elements: [],
  articles: {
    f1: {
      blocks: [
        { id: 'h', type: 'paragraph', style: 'title', runs: [{ text: heading }] },
        { id: 'p', type: 'paragraph', runs: [{ text: para }] },
        { id: 'l', type: 'list', list: 'bullet', runs: [{ text: item }] },
      ],
    },
  },
});
const textsOf = (tab: Tab) =>
  Object.values(tab.articles!.f1!.blocks).map((b) => blockSearchText(b as never));

// The editor around Find: a tab, its history (one entry a commit, as the editor's undo keeps), and the chrome store
// the Find host reads its deps from. The writing starts as typed and committed while the bar is shut.
function mount() {
  const mainRef: { current: HTMLElement | null } = { current: document.createElement('main') };
  const opener: { current: FindDoor['openBar'] } = { current: () => {} };
  const editor = { tab: article('teh Title', 'a teh b teh', 'teh item'), history: [] as Tab[] };
  const depsOf = () => ({
    activeTab: editor.tab,
    pages,
    can,
    standsAside: false,
    canvasMainRef: mainRef,
    getView: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
    focusPage: () => {},
    scrollIntoView: () => {},
    commitActiveTab: (map: (t: Tab) => Tab) => {
      const next = map(editor.tab);
      if (next === editor.tab) return;
      editor.history.push(editor.tab);
      editor.tab = next;
      store.set({ findDeps: depsOf() } as unknown as EditorContextValue);
    },
    notify: () => {},
  });
  const store = createEditorChromeStore({ findDeps: depsOf() } as unknown as EditorContextValue);
  render(
    <EditorChromeContext.Provider value={store}>
      <EditorFindHost openerRef={opener} canvasMainRef={mainRef} />
    </EditorChromeContext.Provider>,
  );
  const undo = () =>
    act(() => {
      editor.tab = editor.history.pop()!;
      store.set({ findDeps: depsOf() } as unknown as EditorContextValue);
    });
  return { editor, opener, undo };
}

describe('Find over an article committed while the bar was shut', () => {
  it('opens seeded from text selected in the writing and finds every match in heading, paragraph and list', async () => {
    const { opener } = mount();
    const flow = document.createElement('div');
    flow.className = 'article-flow';
    const para = document.createElement('p');
    para.textContent = 'teh';
    flow.appendChild(para);
    document.body.appendChild(flow);
    const range = document.createRange();
    range.selectNodeContents(para);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    act(() => opener.current(false));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Find' }).value).toBe('teh');
    // Heading 1, paragraph 2, list item 1.
    expect(await screen.findByText('1 of 4')).toBeTruthy();
  });

  it('Replace, Replace All and Undo change and restore the heading, paragraph and list text', async () => {
    const { editor, opener, undo } = mount();
    const original = textsOf(editor.tab);
    act(() => opener.current(true));
    fireEvent.change(screen.getByRole('textbox', { name: 'Find' }), { target: { value: 'teh' } });
    fireEvent.change(await screen.findByRole('textbox', { name: 'Replace With' }), {
      target: { value: 'the' },
    });
    expect(await screen.findByText('1 of 4')).toBeTruthy();

    // Replace swaps the match in hand only (the heading's).
    fireEvent.click(screen.getByRole('button', { name: /^Replace \(/ }));
    expect(textsOf(editor.tab)).toEqual(['the Title', 'a teh b teh', 'teh item']);
    undo();
    expect(textsOf(editor.tab)).toEqual(original);

    // Replace All swaps every match, in every kind of block, as one edit: one undo takes them all back.
    fireEvent.click(await screen.findByRole('button', { name: /^Replace All/ }));
    expect(textsOf(editor.tab)).toEqual(['the Title', 'a the b the', 'the item']);
    expect(editor.history).toHaveLength(1);
    undo();
    expect(textsOf(editor.tab)).toEqual(original);
    expect(editor.history).toHaveLength(0);
  });
});
