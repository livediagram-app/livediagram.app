// @vitest-environment jsdom
// The page toolbar's page (docs/specs/007-editor/article-pages.md "The page toolbar"): the hovered article page, else
// one the Article tour's toolbar step pins (docs/specs/007-editor/pages-tour.md "Article track").
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  pinPageToolbar,
  readPinnedPageToolbar,
  useHoveredArticlePage,
} from './page-toolbar-presence';

const PAGES = [
  { id: 'p1', flow: 'f1' },
  { id: 'p2', flow: 'f2' },
];

afterEach(() => {
  pinPageToolbar(null);
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
