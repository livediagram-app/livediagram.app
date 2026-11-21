// @vitest-environment jsdom

// The page picker and the hover card over the editor's store (docs/specs/030-knowledgebase/links-and-embeds.md "Page
// links"): `[[` lists the knowledgebase's pages in the slash menu's popover, Enter inserts, Create Page makes a
// subpage and links it, a press opens the page, and each share role is offered what it may do.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useLayoutEffect, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import { pageOfRun, type ArticleBlock, type Tab } from '@liveknowledge/document';
import {
  createEditorChromeStore,
  EditorChromeContext,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { blocksToDoc, docToBlocks } from '@/lib/article/article-convert';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { PAGE_LINK_CARD_DWELL_MS } from './PageLinkHoverCard';
import { usePageLinks } from './usePageLinks';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const para = (id: string, runs: object[], style?: string) =>
  ({ id, type: 'paragraph', ...(style ? { style } : {}), runs }) as ArticleBlock;
const DAY = 86_400_000;
const TABS: Tab[] = [
  { id: 'a', name: 'Handbook', elements: [] },
  {
    id: 'b',
    name: 'Rollbacks',
    parent: 'a',
    elements: [],
    knowledge: { verifiedAt: Date.now() - DAY, verifiedBy: 'u1' },
    articles: {
      'art-1': {
        blocks: [
          para('t', [{ text: 'Rollbacks' }], 'title'),
          para('x', [{ text: 'Undo a release.' }]),
        ],
      },
    },
  },
  { id: 'c', name: 'Releases', elements: [] },
];

let view: EditorView | null = null;

// jsdom lays nothing out: the picker asks where the `[[` is, as the slash menu asks where its `/` is.
const box = { left: 10, right: 20, top: 30, bottom: 44, width: 10, height: 14, x: 10, y: 30 };
const rects = () => Object.assign([box], { item: () => box }) as unknown as DOMRectList;
Range.prototype.getClientRects = rects;
Range.prototype.getBoundingClientRect = () => box as DOMRect;
Element.prototype.getClientRects = rects;
Element.prototype.scrollIntoView = () => {};

function Writing({ canInsert, blocks }: { canInsert: boolean; blocks: ArticleBlock[] }) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const links = usePageLinks(viewRef, canInsert);
  useLayoutEffect(() => {
    const made = new EditorView(host.current, {
      state: EditorState.create({ doc: blocksToDoc(blocks), plugins: [links.makePlugin()] }),
    });
    made.dispatch(made.state.tr.setSelection(TextSelection.atEnd(made.state.doc)));
    viewRef.current = made;
    view = made;
    return () => made.destroy();
    // oxlint-disable-next-line react/exhaustive-deps -- made once, as the writing's own view is
  }, []);
  return (
    <>
      <div ref={host} />
      {links.element}
    </>
  );
}

function mount(level: AccessLevel, blocks: ArticleBlock[] = [para('p', [])]) {
  const can = resolveEditorCapabilities(level);
  const fields: Record<string, unknown> = {
    documentId: 'd1',
    tabs: TABS,
    activeId: 'a',
    can,
    isStructureReadOnly: level !== 'edit',
    addNamedSubpage: vi.fn(() => 'made'),
    setActiveId: vi.fn(),
  };
  const value = new Proxy(fields, {
    get: (target, key: string) => (key in target ? target[key] : vi.fn()),
  }) as unknown as EditorContextValue;
  render(
    <EditorChromeContext.Provider value={createEditorChromeStore(value)}>
      <Writing canInsert={can.writeArticle} blocks={blocks} />
    </EditorChromeContext.Provider>,
  );
  return fields as {
    addNamedSubpage: ReturnType<typeof vi.fn>;
    setActiveId: ReturnType<typeof vi.fn>;
  };
}

const type = (text: string) =>
  act(() => {
    for (const c of text) view!.dispatch(view!.state.tr.insertText(c));
  });
const key = (name: string) =>
  act(() => {
    const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
    view!.someProp('handleKeyDown', (f) => f(view!, event));
  });
const runs = () => (docToBlocks(view!.state.doc, []) as { runs: { text: string }[] }[])[0]!.runs;
const options = () => screen.getAllByRole('option').map((el) => el.textContent ?? '');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  view = null;
});

describe('the page picker', () => {
  it('lists the knowledgebase’s pages on [[, filters, and Enter inserts the link', () => {
    mount('edit');
    type('See [[');
    expect(screen.getByRole('listbox', { name: 'Link to a page' })).toBeTruthy();
    // Every page but the one being written.
    expect(options().join('|')).toMatch(/Rollbacks.*Releases/);
    type('rel');
    expect(options()[0]).toMatch(/^Releases/);
    expect(options().at(-1)).toMatch(/^Create Page/);
    key('Enter');
    expect(pageOfRun(runs()[1]!)).toBe('c');
    expect(runs()[1]!.text).toBe('Releases');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('moves with the arrows and leaves the text as typed on Escape', () => {
    mount('edit');
    type('[[r');
    key('ArrowDown');
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    key('Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(runs()).toEqual([{ text: '[[r' }]);
  });

  it('Create Page makes a subpage of this page with the typed title and links to it', () => {
    const editor = mount('edit');
    type('[[Runbooks');
    fireEvent.click(screen.getByRole('option', { name: /Create Page/ }));
    expect(editor.addNamedSubpage).toHaveBeenCalledWith('a', 'Runbooks');
    expect(runs()).toEqual([{ text: 'Runbooks', page: 'made' }]);
    // The writer stays on the page they are writing.
    expect(editor.setActiveId).not.toHaveBeenCalled();
  });

  it('opens for a participate session, as for an Editor', () => {
    mount('participate');
    type('[[');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it.each(['view'] as const)('never opens for a %s session', (level) => {
    mount(level);
    type('[[');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('following a link', () => {
  const linked = [
    para('p', [{ text: 'See ' }, { text: 'Old Name', page: 'b' }, { text: 'Gone', page: 'zz' }]),
  ];

  it.each(['edit', 'participate', 'view'] as const)(
    'a %s session opens the page on a press',
    (level) => {
      const editor = mount(level, linked);
      const [live, gone] = [...document.querySelectorAll('a.article-page-link')];
      fireEvent.click(live!);
      expect(editor.setActiveId).toHaveBeenCalledWith('b');
      // A link to a page that is gone goes nowhere.
      fireEvent.click(gone!);
      expect(editor.setActiveId).toHaveBeenCalledTimes(1);
    },
  );

  it('writes every page’s current title for its links, whatever words were stored', () => {
    mount('view', linked);
    const css = document.getElementById('page-link-titles')!.textContent;
    expect(css).toContain('[data-page="b"]::before{content:"Rollbacks"}');
    expect(css).not.toContain('zz');
  });

  it('shows the page’s title, state and first lines after a dwell, and Deleted Page for one that is gone', () => {
    vi.useFakeTimers();
    mount('view', linked);
    const [live, gone] = [...document.querySelectorAll('a.article-page-link')];
    fireEvent.mouseOver(live!);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => void vi.advanceTimersByTime(PAGE_LINK_CARD_DWELL_MS));
    const card = screen.getByRole('tooltip');
    expect(card.textContent).toContain('Rollbacks');
    expect(card.textContent).toContain('Undo a release.');
    expect(screen.getByRole('img', { name: 'Verified' })).toBeTruthy();
    fireEvent.mouseOut(live!);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseOver(gone!);
    act(() => void vi.advanceTimersByTime(PAGE_LINK_CARD_DWELL_MS));
    expect(screen.getByRole('tooltip').textContent).toBe('Deleted Page');
  });
});
