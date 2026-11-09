// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PageKind } from '@livedesign/design';
import { setCurrentPageKind } from './current-page-kind';
import { paletteKindForPage, soleTabKind, usePaletteKind } from './palette-kind';

afterEach(() => setCurrentPageKind(null));
const tab = (...kinds: (PageKind | undefined)[]) => kinds.map((kind) => ({ kind }));

// docs/specs/007-editor/pages-mode.md "The palette's kind".
describe('the palette kind', () => {
  it('is the page’s own: Wireframe, Logo, else Design', () => {
    expect(paletteKindForPage('wireframe')).toBe('wireframe');
    expect(paletteKindForPage('logo')).toBe('logo');
    expect(paletteKindForPage('photo')).toBe('design');
    expect(paletteKindForPage(null)).toBe('design');
  });

  it("is the tab's one kind, whichever of its pages someone is on", () => {
    expect(soleTabKind(tab('logo', 'logo'))).toBe('logo');
    expect(soleTabKind(tab('logo', 'wireframe'))).toBeNull();
    expect(soleTabKind(tab(undefined, undefined))).toBeNull();
    expect(soleTabKind([])).toBeNull();
    expect(soleTabKind(null)).toBeNull();
    const pages = tab('logo', 'logo');
    const { result } = renderHook(() => usePaletteKind(pages));
    // Known before any page is measured, so the first paint is the Logo palette.
    expect(result.current).toBe('logo');
    act(() => setCurrentPageKind('wireframe', 'p2'));
    expect(result.current).toBe('logo');
  });

  it('keeps a tab of blank pages on Design, follows the page on a tab of mixed kinds, and is Design off Pages mode', () => {
    const blank = tab(undefined, undefined);
    const { result: plain } = renderHook(() => usePaletteKind(blank));
    act(() => setCurrentPageKind('logo', 'p2'));
    expect(plain.current).toBe('design');
    act(() => setCurrentPageKind(null));
    const pages = tab('wireframe', 'logo');
    const { result } = renderHook(() => usePaletteKind(pages));
    expect(result.current).toBe('wireframe');
    act(() => setCurrentPageKind('logo', 'p2'));
    expect(result.current).toBe('logo');
    expect(renderHook(() => usePaletteKind(null)).result.current).toBe('design');
  });
});
