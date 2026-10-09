// @vitest-environment jsdom

// The article's colours on the one colour picker (docs/specs/004-interface-design/colour-picker.md;
// docs/specs/007-editor/article-pages.md "The page toolbar", "Article style").
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { penColourHex, standardColours } from '@livediagram/document';
import type { ArticleSelectionState } from '@/lib/article/article-commands';
import { ColourPanel } from './page-toolbar-panels';
import { ArticleStyleSection } from './ArticleStyleSection';

afterEach(() => cleanup());

const ACCENT = penColourHex('teal', 'light');
const selection = (color: string | null, highlight: string | null) =>
  ({ color, highlight }) as unknown as ArticleSelectionState;

function panel(color: string | null, highlight: string | null) {
  const onColor = vi.fn();
  const onHighlight = vi.fn();
  render(
    <ColourPanel
      selection={selection(color, highlight)}
      accent={ACCENT}
      onColor={onColor}
      onHighlight={onHighlight}
    />,
  );
  return { onColor, onHighlight };
}
const group = (name: string) => screen.getByRole('group', { name });

describe('the page toolbar colours', () => {
  it('leads text colour with Default and Accent before the strong colours', () => {
    const { onColor } = panel(null, null);
    const text = within(group('Text colour'));
    const colours = within(text.getByRole('group', { name: 'Standard Colours' })).getAllByRole(
      'button',
    );
    expect(colours.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Default colour',
      'Accent',
      ...standardColours('strong', 'light').map((c) => c.label),
    ]);
    expect(colours[0]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(colours[1]!);
    expect(onColor).toHaveBeenLastCalledWith(ACCENT);
    fireEvent.click(text.getByRole('button', { name: 'Red' }));
    expect(onColor).toHaveBeenLastCalledWith(penColourHex('red', 'light'));
    fireEvent.click(colours[0]!);
    expect(onColor).toHaveBeenLastCalledWith(null);
  });

  it('marks the Accent, not the same standard colour, when the text is in the accent', () => {
    panel(ACCENT.toUpperCase(), null);
    const text = within(group('Text colour'));
    expect(text.getByRole('button', { name: 'Accent' }).getAttribute('aria-pressed')).toBe('true');
    expect(text.getByRole('button', { name: 'Teal' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('leads highlight with No highlight before the soft colours', () => {
    const yellow = standardColours('soft', 'light')[4]!.hex;
    const { onHighlight } = panel(null, yellow);
    const hl = within(group('Highlight'));
    expect(hl.getByRole('button', { name: 'Yellow' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(hl.getByRole('button', { name: 'No highlight' }));
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    fireEvent.click(hl.getByRole('button', { name: 'Pink' }));
    expect(onHighlight).toHaveBeenLastCalledWith(standardColours('soft', 'light')[9]!.hex);
  });
});

describe('the article accent', () => {
  it('offers the theme accent first, then the strong colours, previewing on hover', () => {
    const onChange = vi.fn();
    const onPreview = vi.fn();
    render(
      <ArticleStyleSection
        part="style"
        style={undefined}
        themeAccent="#0ea5e9"
        onChange={onChange}
        onPreview={onPreview}
      />,
    );
    const accent = within(group('Accent colour'));
    expect(accent.getByRole('button', { name: 'Theme' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.pointerEnter(accent.getByRole('button', { name: 'Violet' }), {
      pointerType: 'mouse',
    });
    expect(onPreview).toHaveBeenLastCalledWith({ accent: penColourHex('violet', 'light') });
    fireEvent.click(accent.getByRole('button', { name: 'Violet' }));
    expect(onChange).toHaveBeenLastCalledWith({
      patch: { accent: penColourHex('violet', 'light') },
    });
    fireEvent.click(accent.getByRole('button', { name: 'Theme' }));
    expect(onChange).toHaveBeenLastCalledWith({ patch: { accent: undefined } });
  });
});
