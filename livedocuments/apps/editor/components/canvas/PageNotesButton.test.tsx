// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteCard } from '@livedocuments/document';
import { PageNotesButton } from './PageNotesButton';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/pages-mode.md "Slides" and docs/specs/012-collaboration/speaker-note-cards.md: a slide
// page's notes, the deck slide's own note cards.
afterEach(cleanup);

const controls = (slide?: { id: string; hidden: boolean; noteCards: readonly NoteCard[] }) => ({
  slideOf: () => slide,
  add: vi.fn(),
  toggleHidden: vi.fn(),
  setNoteCards: vi.fn(),
});

describe('PageNotesButton', () => {
  it('shows nothing until the page is in the deck', () => {
    render(<PageNotesButton pageId="p1" deck={controls()} labelled />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("offers Add Notes, opening on the empty state, and adds the deck slide's first card", () => {
    const deck = controls({ id: 's1', hidden: false, noteCards: [] });
    render(<PageNotesButton pageId="p1" deck={deck} labelled />);
    const button = screen.getByRole('button', { name: 'Add Notes' });
    expect(button.textContent).toBe('Add Notes');
    fireEvent.click(button);
    expect(screen.getByText('No Notes Yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add First Card' }));
    expect(deck.setNoteCards).toHaveBeenCalledWith('s1', [{ id: 'c1', text: '' }]);
  });

  it('reads Notes, pressed, once the slide has a card with words, and lists its cards', () => {
    const deck = controls({
      id: 's1',
      hidden: false,
      noteCards: [
        { id: 'c1', text: 'Open with the customer story' },
        { id: 'c2', text: 'Then the numbers' },
      ],
    });
    render(<PageNotesButton pageId="p1" deck={deck} labelled />);
    const button = screen.getByRole('button', { name: 'Notes' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(screen.getByRole('group', { name: 'Card 1 of 2' }).textContent).toContain(
      'Open with the customer story',
    );
    expect(screen.getByText('2 cards · 5 sec')).toBeTruthy();
  });

  it('reads Add Notes while every card is blank', () => {
    render(
      <PageNotesButton
        pageId="p1"
        deck={controls({ id: 's1', hidden: false, noteCards: [{ id: 'c1', text: '  ' }] })}
        labelled={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add Notes' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});
