// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageNotesButton } from './PageNotesButton';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/illustrate-pages.md "Slides": a slide page's notes, the deck slide's own.
afterEach(cleanup);

const controls = (slide?: { id: string; hidden: boolean; notes: string }) => ({
  slideOf: () => slide,
  add: vi.fn(),
  toggleHidden: vi.fn(),
  setNotes: vi.fn(),
});

describe('PageNotesButton', () => {
  it('shows nothing until the page is in the deck', () => {
    render(<PageNotesButton pageId="p1" deck={controls()} labelled />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("offers Add Notes and writes the deck slide's notes", () => {
    const deck = controls({ id: 's1', hidden: false, notes: '' });
    render(<PageNotesButton pageId="p1" deck={deck} labelled />);
    const button = screen.getByRole('button', { name: 'Add Notes' });
    expect(button.textContent).toBe('Add Notes');
    fireEvent.click(button);
    fireEvent.change(screen.getByPlaceholderText("What you'll say over this slide…"), {
      target: { value: 'Open with the customer story' },
    });
    expect(deck.setNotes).toHaveBeenCalledWith('s1', 'Open with the customer story');
  });

  it('reads Notes, pressed, once the slide has some', () => {
    render(
      <PageNotesButton
        pageId="p1"
        deck={controls({ id: 's1', hidden: false, notes: 'Hi' })}
        labelled
      />,
    );
    expect(screen.getByRole('button', { name: 'Notes' }).getAttribute('aria-pressed')).toBe('true');
  });
});
