// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PageKind } from '@livedocuments/document';
import { setCurrentPageKind } from './current-page-kind';
import { docksPageToolbar, paletteKindForPage, soleTabKind, usePaletteKind } from './palette-kind';

afterEach(() => setCurrentPageKind(null));
const tab = (...kinds: PageKind[]) => kinds.map((kind) => ({ kind }));

// docs/specs/007-editor/pages-mode.md "The palette's kind".
describe('the palette kind', () => {
  it('is the page’s own: Slide, Article, Flashcard, else Design', () => {
    expect(paletteKindForPage('slide')).toBe('slide');
    expect(paletteKindForPage('article')).toBe('article');
    expect(paletteKindForPage('flashcard')).toBe('flashcard');
    expect(paletteKindForPage('infographic')).toBe('design');
    expect(paletteKindForPage(null)).toBe('design');
  });

  // docs/specs/007-editor/flashcards.md "Text only".
  it('docks the page toolbar for writing: an article or a card', () => {
    expect(docksPageToolbar('article')).toBe(true);
    expect(docksPageToolbar('flashcard')).toBe(true);
    expect(docksPageToolbar('slide')).toBe(false);
    expect(docksPageToolbar('design')).toBe(false);
  });

  it("is the tab's one kind, whichever of its pages someone is on", () => {
    expect(soleTabKind(tab('slide', 'slide'))).toBe('slide');
    expect(soleTabKind(tab('slide', 'article'))).toBeNull();
    expect(soleTabKind([])).toBeNull();
    expect(soleTabKind(null)).toBeNull();
    const pages = tab('slide', 'slide');
    const { result } = renderHook(() => usePaletteKind(pages));
    // Known before any page is measured, so the first paint is the slide palette.
    expect(result.current).toBe('slide');
    act(() => setCurrentPageKind('infographic', 'p2'));
    expect(result.current).toBe('slide');
  });

  it('follows the page on a tab stored with mixed kinds, and is Design off Pages mode', () => {
    const pages = tab('article', 'slide');
    const { result } = renderHook(() => usePaletteKind(pages));
    expect(result.current).toBe('article');
    act(() => setCurrentPageKind('slide', 'p2'));
    expect(result.current).toBe('slide');
    expect(renderHook(() => usePaletteKind(null)).result.current).toBe('design');
  });
});
