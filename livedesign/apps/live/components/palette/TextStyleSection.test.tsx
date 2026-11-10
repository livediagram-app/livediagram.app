// @vitest-environment jsdom

// The Text menu's Text Style (docs/specs/008-canvas/canvas-and-palette.md "Text styles"): a row per style, the one the
// text wears pressed, a press commits and a mouse hover previews.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEXT_PRESETS, type TextPresetId } from '@livedesign/design';
import { TextStyleSection, textStylePreviewPx, textStyleSummary } from './TextStyleSection';

afterEach(() => cleanup());

function renderSection(current: TextPresetId | null) {
  const onSet = vi.fn();
  const onPreview = vi.fn();
  const onPreviewEnd = vi.fn();
  const view = render(
    <TextStyleSection
      current={current}
      section={{ open: true, onToggle: vi.fn() }}
      onSet={onSet}
      onPreview={onPreview}
      onPreviewEnd={onPreviewEnd}
    />,
  );
  return { onSet, onPreview, onPreviewEnd, view };
}

const row = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}, \\d+ px$`) });

describe('TextStyleSection', () => {
  it('lists the seven styles, each with its size, and presses the one the text wears', () => {
    renderSection('heading');
    const names = ['Title', 'Subtitle', 'Heading', 'Subheading', 'Paragraph', 'Quote', 'Caption'];
    for (const name of names) expect(row(name)).toBeTruthy();
    expect(row('Heading').getAttribute('aria-pressed')).toBe('true');
    expect(row('Subheading').getAttribute('aria-pressed')).toBe('false');
    expect(row('Heading').getAttribute('aria-label')).toBe('Heading, 32 px');
  });

  it('presses none for a text styled by hand', () => {
    renderSection(null);
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('sets each name in its own weight and slant', () => {
    renderSection(null);
    const name = (n: string) => row(n).querySelector('span')!;
    expect(name('Title').style.fontWeight).toBe('700');
    expect(name('Quote').style.fontStyle).toBe('italic');
    expect(name('Paragraph').style.fontWeight).toBe('400');
  });

  it('commits a style on a press', () => {
    const { onSet } = renderSection('paragraph');
    fireEvent.click(row('Quote'));
    expect(onSet).toHaveBeenLastCalledWith('quote');
  });

  it('previews on a mouse hover only, and reverts when the pointer leaves or the section goes', () => {
    const { onPreview, onPreviewEnd, view } = renderSection(null);
    fireEvent.pointerEnter(row('Caption'), { pointerType: 'touch' });
    expect(onPreview).not.toHaveBeenCalled();
    fireEvent.pointerEnter(row('Caption'), { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith('caption');
    fireEvent.pointerLeave(row('Caption'), { pointerType: 'mouse' });
    expect(onPreviewEnd).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(onPreviewEnd).toHaveBeenCalledTimes(2);
  });
});

describe('a style in the menu', () => {
  it('keeps the styles in order, smallest at 10 px', () => {
    const { title, heading, paragraph, caption } = TEXT_PRESETS;
    expect(textStylePreviewPx(caption)).toBe(10);
    expect(textStylePreviewPx(title)).toBe(17);
    expect(textStylePreviewPx(title)).toBeGreaterThan(textStylePreviewPx(heading));
    expect(textStylePreviewPx(heading)).toBeGreaterThan(textStylePreviewPx(paragraph));
  });

  it('says its size, weight, wrap and use in its hover card', () => {
    expect(textStyleSummary(TEXT_PRESETS.heading)).toBe('32 px, bold. Starts a section.');
    expect(textStyleSummary(TEXT_PRESETS.quote)).toBe(
      '20 px, italic, wraps at 320 px. A line pulled out of the body.',
    );
    expect(textStyleSummary(TEXT_PRESETS.subtitle)).toBe('24 px. A quieter line under a title.');
  });
});
