// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageDeckButton } from './PageDeckButton';

// docs/specs/007-editor/illustrate-pages.md "Slides": a slide page's deck button.
afterEach(cleanup);

const controls = (slide?: { id: string; hidden: boolean }) => ({
  slideOf: () => (slide ? { ...slide, notes: '' } : undefined),
  add: vi.fn(),
  toggleHidden: vi.fn(),
  setNotes: vi.fn(),
});

describe('PageDeckButton', () => {
  it('adds the page to the deck while it has no slide', () => {
    const deck = controls();
    render(<PageDeckButton pageId="p1" deck={deck} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Slides' }));
    expect(deck.add).toHaveBeenCalledWith('p1');
  });

  it('hides a shown slide from the presentation', () => {
    const deck = controls({ id: 's1', hidden: false });
    render(<PageDeckButton pageId="p1" deck={deck} />);
    const button = screen.getByRole('button', { name: 'Hide in Slides' });
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    fireEvent.click(button);
    expect(deck.toggleHidden).toHaveBeenCalledWith('s1');
  });

  it('shows a hidden slide again', () => {
    const deck = controls({ id: 's1', hidden: true });
    render(<PageDeckButton pageId="p1" deck={deck} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show in Slides' }));
    expect(deck.toggleHidden).toHaveBeenCalledWith('s1');
  });

  it('names itself beside its icon on a desktop', () => {
    render(<PageDeckButton pageId="p1" deck={controls()} labelled />);
    expect(screen.getByRole('button', { name: 'Add to Slides' }).textContent).toBe('Add to Slides');
  });
});
