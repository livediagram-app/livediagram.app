// @vitest-environment jsdom
// docs/specs/030-knowledgebase/page-comments.md "Comments on the writing": a note on words picked while the page is
// read goes straight into the page as saved, though the read lens locks the tab; a locked page, and a session that may
// not write, still refuse it. The note's marker lands beside the words and its thread or action opens.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { articlesOf, type ArticleBlock, type Tab } from '@liveknowledge/document';
import { useArticles } from './useArticles';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const handle = vi.hoisted(() => ({ flow: 'a', markNote: vi.fn() }));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => handle,
  markZoneReleased: vi.fn(),
  takeZoneReleased: () => false,
  forgetZonesReleased: vi.fn(),
}));

const blocks: ArticleBlock[] = [{ id: 'p', type: 'paragraph', runs: [{ text: 'Ships Tuesday' }] }];
const marked: ArticleBlock[] = [
  { id: 'p', type: 'paragraph', runs: [{ text: 'Ships ' }, { text: 'Tuesday', note: 'n' }] },
];
// The page as the read lens draws it: locked, so nothing else of it changes.
const page = (pageLocked = false): Tab =>
  ({
    id: 't',
    name: 'Page',
    elements: [],
    locked: true,
    pages: [
      {
        id: 'a1',
        orientation: 'portrait',
        kind: 'article',
        flow: 'a',
        ...(pageLocked ? { locked: true } : {}),
      },
    ],
    articles: { a: { blocks } },
  }) as unknown as Tab;

function setup(tab: Tab, canEdit = true) {
  const commitTabs = vi.fn<(map: (ts: Tab[]) => Tab[]) => void>();
  const openNote = vi.fn();
  const { result } = renderHook(() =>
    useArticles({
      activeTab: tab,
      on: true,
      pages: null,
      localEditSeq: { current: 0 },
      placeAt: vi.fn(),
      canEdit,
      canWrite: canEdit,
      commitTabs,
      tickTabs: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      clearSelection: vi.fn(),
      openNote,
      reveal: vi.fn(),
    }),
  );
  return { view: result.current!, commitTabs, openNote };
}

beforeEach(() => {
  track.mockClear();
  handle.markNote.mockReset();
  handle.markNote.mockReturnValue({
    blocks: marked,
    place: { id: 'n', index: 0, y: 40, height: 20 },
  });
});

describe('a note put on words while reading', () => {
  it('writes the mark and the marker into the page as saved, and opens the thread', () => {
    const { view, commitTabs, openNote } = setup(page());
    let done = false;
    act(() => {
      done = view.addReadingNote('a', 'comment');
    });
    expect(done).toBe(true);
    const id = String(handle.markNote.mock.calls[0]![0]);
    const next = commitTabs.mock.calls[0]![0]([{ ...page(), locked: undefined }]);
    expect(articlesOf(next[0]).a!.blocks).toEqual(marked);
    expect(next[0]!.elements).toMatchObject([{ id, type: 'article-note', articleNote: 'comment' }]);
    expect(openNote).toHaveBeenCalledWith(id, 'comment');
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'ArticleComment');
  });

  it('is refused while editing the locked lens, as every edit is', () => {
    const { view } = setup(page());
    act(() => view.addNote('a', 'action'));
    expect(handle.markNote).not.toHaveBeenCalled();
  });

  it('is refused on a locked page, for a session that may not write, and with no words picked', () => {
    for (const { tab, canEdit } of [
      { tab: page(true), canEdit: true },
      { tab: page(), canEdit: false },
    ]) {
      const { view, commitTabs } = setup(tab, canEdit);
      expect(view.addReadingNote('a', 'action')).toBe(false);
      expect(commitTabs).not.toHaveBeenCalled();
    }
    handle.markNote.mockReturnValue(null);
    const { view, commitTabs } = setup(page());
    expect(view.addReadingNote('a', 'comment')).toBe(false);
    expect(commitTabs).not.toHaveBeenCalled();
  });
});
