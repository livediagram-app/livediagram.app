// @vitest-environment jsdom
// The page toolbar's page (docs/specs/007-editor/article-pages.md "The page toolbar"): the hovered article page, else
// one the Article tour's toolbar step pins (docs/specs/007-editor/pages-tour.md "Article track").
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  blurActiveArticle,
  setActiveArticle,
  type ArticleEditorHandle,
} from '@/lib/article/article-editor-store';
import {
  pinPageToolbar,
  readPinnedPageToolbar,
  useHoveredArticlePage,
  useShownArticle,
} from './page-toolbar-presence';

const PAGES = [
  { id: 'p1', flow: 'f1' },
  { id: 'p2', flow: 'f2' },
];

afterEach(() => {
  pinPageToolbar(null);
  setActiveArticle(null);
  cleanup();
});

describe('useHoveredArticlePage', () => {
  it('holds the toolbar on a pinned page with nothing hovered, and lets it go when unpinned', () => {
    const { result } = renderHook(() => useHoveredArticlePage(PAGES));
    expect(result.current).toBeNull();
    act(() => pinPageToolbar('p2'));
    expect(result.current).toEqual({ flow: 'f2', pageId: 'p2' });
    expect(readPinnedPageToolbar()).toBe('p2');
    act(() => pinPageToolbar(null));
    expect(result.current).toBeNull();
  });

  it('ignores a pin on a page it was not given (a locked article)', () => {
    const { result } = renderHook(() => useHoveredArticlePage(PAGES));
    act(() => pinPageToolbar('gone'));
    expect(result.current).toBeNull();
  });
});

// A phone's writing bar gives the top row back once the writing lets go of the caret
// (docs/specs/030-knowledgebase/page-surface.md "The footer": "until the caret leaves").
describe('useShownArticle letGo', () => {
  const handle = { flow: 'f1', selection: () => ({}) } as unknown as ArticleEditorHandle;
  const worked = (focused: boolean) => ({
    handle,
    pageId: 'p1',
    selection: handle.selection(),
    focused,
  });

  it('is false while the writing has the caret, true once it lets go, and false with nothing worked on', () => {
    const { result } = renderHook(() => useShownArticle(PAGES));
    expect(result.current.letGo).toBe(false);
    act(() => setActiveArticle(worked(true)));
    expect(result.current.letGo).toBe(false);
    expect(result.current.shown?.pageId).toBe('p1');
    act(() => blurActiveArticle('f1'));
    expect(result.current.letGo).toBe(true);
    // Still the article worked on: a desktop keeps its toolbar until a press off its pages.
    expect(result.current.active?.handle.flow).toBe('f1');
  });

  it('is false for a pinned page nobody is writing on', () => {
    const { result } = renderHook(() => useShownArticle(PAGES));
    act(() => pinPageToolbar('p2'));
    expect(result.current.letGo).toBe(false);
  });
});
