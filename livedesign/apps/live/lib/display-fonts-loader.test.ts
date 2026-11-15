// @vitest-environment jsdom

// Loading the display library's faces (docs/specs/004-interface-design/fonts.md "The display library"): a family is
// linked once an element uses it, never twice, and the previews come from one subset stylesheet under names of
// their own.

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISPLAY_FONTS } from '@livedesign/design';
import { useDisplayFonts } from '@/hooks/canvas/useDisplayFonts';
import {
  displayFontIdsIn,
  displayPreviewFamily,
  displayPreviewHref,
  displayPreviewLetters,
  loadDisplayFonts,
  loadDisplayPreviews,
  renamePreviewFamilies,
  resetDisplayPreviewsForTest,
} from './display-fonts-loader';

const links = () => [...document.head.querySelectorAll('link[data-display-font]')];

beforeEach(() => resetDisplayPreviewsForTest());
afterEach(() => {
  document.head.innerHTML = '';
  vi.restoreAllMocks();
});

describe('displayFontIdsIn', () => {
  it('finds the display faces a tab uses, once each, and nothing else', () => {
    expect(
      displayFontIdsIn([{ font: 'lobster' }, { font: 'lora' }, {}, { font: 'lobster' }, { font: 3 }]),
    ).toEqual(['lobster']);
  });
});

describe('loadDisplayFonts', () => {
  it('links each family once, from Google Fonts, and ignores the eleven and unknown ids', () => {
    loadDisplayFonts(['lobster', 'lora', 'nope']);
    loadDisplayFonts(['lobster', 'anton']);
    expect(links().map((l) => l.getAttribute('data-display-font'))).toEqual(['lobster', 'anton']);
    expect((links()[0] as HTMLLinkElement).href).toBe(
      'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
    );
  });

  it('follows a tab’s elements as they change (useDisplayFonts)', () => {
    const { rerender } = renderHook(({ els }) => useDisplayFonts(els), {
      initialProps: { els: [{ font: 'cinzel' }] as { font?: string }[] },
    });
    expect(links()).toHaveLength(1);
    rerender({ els: [{ font: 'cinzel' }, { font: 'rye' }] });
    expect(links().map((l) => l.getAttribute('data-display-font'))).toEqual(['cinzel', 'rye']);
  });
});

describe('the previews', () => {
  it('ask for every family once, holding only the letters of the names', () => {
    const letters = displayPreviewLetters();
    expect(letters).not.toContain(' ');
    expect(new Set(letters).size).toBe(letters.length);
    for (const f of DISPLAY_FONTS) for (const ch of f.label.replace(/ /g, '')) expect(letters).toContain(ch);
    const href = displayPreviewHref();
    expect(href).toContain('family=Montserrat&');
    expect(href).not.toContain('wght@');
    expect(href).toContain(`&text=${encodeURIComponent(letters)}`);
  });

  it('rename each family so a subset never stands in for the full face', () => {
    expect(displayPreviewFamily('great-vibes')).toBe('great-vibes preview');
    expect(renamePreviewFamilies("@font-face { font-family: 'Great Vibes'; src: url(x); }")).toBe(
      "@font-face { font-family: 'great-vibes preview'; src: url(x); }",
    );
  });

  it('are added once as a style, and fetched again after a failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = vi.fn(async () => new Response('', { status: 500 }));
    await loadDisplayPreviews(failing);
    expect(warn).toHaveBeenCalledWith('[display-fonts] previews failed', expect.any(Error));
    expect(document.head.querySelector('style[data-display-font-previews]')).toBeNull();
    const ok = vi.fn(async () => new Response("@font-face { font-family: 'Rye'; }"));
    await Promise.all([loadDisplayPreviews(ok), loadDisplayPreviews(ok)]);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(document.head.querySelector('style[data-display-font-previews]')?.textContent).toBe(
      "@font-face { font-family: 'rye preview'; }",
    );
  });
});
