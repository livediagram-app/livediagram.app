// @vitest-environment jsdom

// The display library (docs/specs/007-editor/logo-pages.md "Display faces"): searched, filtered by category, each
// face named in its own face; a hover previews, a press sets, and only a text on a logo page offers it.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISPLAY_FONTS } from '@livedesign/design';
import { resetDisplayPreviewsForTest } from '@/lib/display-fonts-loader';
import { DisplayFontLibrary, matchDisplayFonts } from './DisplayFontLibrary';
import { TypographySections } from './TypographySections';

beforeEach(() => {
  resetDisplayPreviewsForTest();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response("@font-face { font-family: 'Lobster'; }", { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

const list = () => screen.getByRole('group', { name: 'Display faces' });

describe('matchDisplayFonts', () => {
  it('matches every typed word against the name, style and category', () => {
    expect(matchDisplayFonts('')).toHaveLength(DISPLAY_FONTS.length);
    expect(matchDisplayFonts('LOBSTER').map((f) => f.id)).toEqual(['lobster', 'lobster-two']);
    expect(matchDisplayFonts('stencil military').map((f) => f.id)).toEqual(['black-ops-one']);
    expect(matchDisplayFonts('serif slab').map((f) => f.id)).toContain('zilla-slab');
    expect(matchDisplayFonts('zzz')).toEqual([]);
  });
});

describe('DisplayFontLibrary', () => {
  it('lists every face in its own preview face, the one in use pressed', () => {
    render(<DisplayFontLibrary currentFont="pacifico" onSetFont={vi.fn()} />);
    const rows = within(list()).getAllByRole('button');
    expect(rows).toHaveLength(DISPLAY_FONTS.length);
    const pacifico = within(list()).getByRole('button', { name: /Pacifico/ });
    expect(pacifico.getAttribute('aria-pressed')).toBe('true');
    expect((pacifico.firstElementChild as HTMLElement).style.fontFamily).toContain('pacifico preview');
    expect(screen.getByPlaceholderText('Search 90 display faces')).toBeTruthy();
  });

  it('fetches the preview subsets once on opening', () => {
    render(<DisplayFontLibrary currentFont={null} onSetFont={vi.fn()} />);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain('&text=');
  });

  it('narrows by search and by category, with counts, and says when nothing matches', () => {
    render(<DisplayFontLibrary currentFont={null} onSetFont={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search display faces' }), {
      target: { value: 'script' },
    });
    const chips = screen.getByRole('group', { name: 'Display face categories' });
    const script = within(chips).getByRole('button', { name: /Script/ });
    expect(within(chips).getByRole('button', { name: /Sans/ }).textContent).toBe('Sans0');
    fireEvent.click(script);
    expect(script.getAttribute('aria-pressed')).toBe('true');
    expect(within(list()).getAllByRole('button').length).toBeGreaterThan(10);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search display faces' }), {
      target: { value: 'nothing like this' },
    });
    expect(screen.getAllByText(/No display faces match/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search and Filters' }));
    expect(within(list()).getAllByRole('button')).toHaveLength(DISPLAY_FONTS.length);
  });

  it('previews on a hover, links the face, and sets it on a press', () => {
    const onSetFont = vi.fn();
    const onPreviewFont = vi.fn();
    const onPreviewEnd = vi.fn();
    render(
      <DisplayFontLibrary
        currentFont={null}
        onSetFont={onSetFont}
        onPreviewFont={onPreviewFont}
        onPreviewEnd={onPreviewEnd}
      />,
    );
    const row = within(list()).getByRole('button', { name: /Bebas Neue/ });
    fireEvent.pointerEnter(row, { pointerType: 'mouse' });
    expect(onPreviewFont).toHaveBeenLastCalledWith('bebas-neue');
    expect(document.head.querySelector('link[data-display-font="bebas-neue"]')).toBeTruthy();
    fireEvent.pointerLeave(row, { pointerType: 'mouse' });
    expect(onPreviewEnd).toHaveBeenCalled();
    fireEvent.click(row);
    expect(onSetFont).toHaveBeenLastCalledWith('bebas-neue');
  });
});

describe('the Font section', () => {
  const renderSections = (displayFontsOffered?: boolean) =>
    render(
      <TypographySections
        currentFont={null}
        currentSize="sm"
        presetPx={() => 14}
        padding="sm"
        onSetFont={vi.fn()}
        onSetSize={vi.fn()}
        onSetPadding={vi.fn()}
        sectionProps={() => ({ open: true, onToggle: vi.fn() })}
        displayFontsOffered={displayFontsOffered}
      />,
    );

  it('offers the display library only when asked (a text on a logo page)', () => {
    renderSections(true);
    expect(screen.getByText('Display Library')).toBeTruthy();
    cleanup();
    renderSections();
    expect(screen.queryByText('Display Library')).toBeNull();
  });
});
