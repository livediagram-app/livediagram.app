// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageDeckButton } from './PageDeckButton';

// docs/specs/007-editor/illustrate-pages.md "Slides": a slide page's deck button.
afterEach(cleanup);

const controls = (slide?: { id: string; hidden: boolean }) => ({
  slideOf: () => slide,
  add: vi.fn(),
  toggleHidden: vi.fn(),
});

describe('PageDeckButton', () => {
  it('adds the page to the deck while it has no slide', () => {
    const deck = controls();
    render(<PageDeckButton pageId="p1" deck={deck} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to slide deck' }));
    expect(deck.add).toHaveBeenCalledWith('p1');
  });

  it('hides a shown slide from the presentation', () => {
    const deck = controls({ id: 's1', hidden: false });
    render(<PageDeckButton pageId="p1" deck={deck} />);
    const button = screen.getByRole('button', { name: 'Hide from the presentation' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(deck.toggleHidden).toHaveBeenCalledWith('s1');
  });

  it('shows a hidden slide again', () => {
    const deck = controls({ id: 's1', hidden: true });
    render(<PageDeckButton pageId="p1" deck={deck} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show in the presentation' }));
    expect(deck.toggleHidden).toHaveBeenCalledWith('s1');
  });
});
