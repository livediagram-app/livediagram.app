// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOTE_CARDS_MAX, NOTE_CARD_TEXT_MAX, type NoteCard } from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { NOTE_CARD_UNDO_MS, NoteCardList, noteCardsSummary } from './NoteCardList';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/012-collaboration/speaker-note-cards.md "Writing note cards".

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(track).mockClear();
});

function Harness({
  initial,
  onChange,
}: {
  initial: NoteCard[];
  onChange?: (cards: readonly NoteCard[]) => void;
}) {
  const [cards, setCards] = useState<readonly NoteCard[]>(initial);
  return (
    <div>
      <button type="button">Outside</button>
      <NoteCardList
        cards={cards}
        onChange={(next) => {
          onChange?.(next);
          setCards(next);
        }}
      />
      <output data-testid="ids">{cards.map((c) => `${c.id}:${c.text}`).join('|')}</output>
    </div>
  );
}

const three: NoteCard[] = [
  { id: 'c1', text: 'One' },
  { id: 'c2', text: 'Two' },
  { id: 'c3', text: 'Three' },
];
const ids = () => screen.getByTestId('ids').textContent;
const card = (n: number, of: number) => screen.getByRole('group', { name: `Card ${n} of ${of}` });

describe('NoteCardList', () => {
  it('starts empty with a way to add the first card, which opens for writing', () => {
    render(<Harness initial={[]} />);
    expect(screen.getByText('No Notes Yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add First Card' }));
    const box = screen.getByRole('textbox', { name: 'Card 1' });
    expect(document.activeElement).toBe(box);
    fireEvent.change(box, { target: { value: 'Open with the customer story' } });
    expect(ids()).toBe('c1:Open with the customer story');
    expect(track).toHaveBeenCalledWith('UI', 'Added', 'NoteCard');
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'SlideNotes');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('1 card · 5 sec')).toBeTruthy();
  });

  it('takes a blank card away when it closes, with no Undo', () => {
    render(<Harness initial={three} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));
    expect(ids()).toBe('c1:One|c2:Two|c3:Three|c4:');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(ids()).toBe('c1:One|c2:Two|c3:Three');
    expect(screen.queryByText('Card removed')).toBeNull();
  });

  it('opens one card at a time: opening another closes the first, a blank first going', () => {
    render(<Harness initial={[...three, { id: 'c4', text: '' }]} />);
    fireEvent.click(card(4, 4));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.click(card(1, 4));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Card 1' })).toBeTruthy();
    expect(ids()).toBe('c1:One|c2:Two|c3:Three');
    // Opening the card already open changes nothing.
    fireEvent.click(screen.getByRole('textbox', { name: 'Card 1' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('adds a card straight after the open one with Mod+Enter, never stacking blanks', () => {
    render(<Harness initial={three} />);
    fireEvent.click(card(1, 3));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true });
    expect(ids()).toBe('c1:One|c4:|c2:Two|c3:Three');
    expect(screen.getByRole('textbox', { name: 'Card 2' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
    expect(ids()).toBe('c1:One|c4:|c2:Two|c3:Three');
    // Other keys stay in the box.
    const other = new KeyboardEvent('keydown', { key: 'g', bubbles: true });
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    screen.getByRole('textbox').dispatchEvent(other);
    window.removeEventListener('keydown', spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('moves cards with their buttons and Alt+arrows, and moves focus with the arrows', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    render(<Harness initial={three} />);
    // The first card has no Move Up, the last no Move Down.
    expect(card(1, 3).querySelector('[aria-label="Move Up"]')).toBeNull();
    expect(card(3, 3).querySelector('[aria-label="Move Down"]')).toBeNull();
    fireEvent.click(card(1, 3).querySelector('[aria-label="Move Down"]')!);
    expect(ids()).toBe('c2:Two|c1:One|c3:Three');
    expect(track).toHaveBeenCalledWith('UI', 'Moved', 'NoteCard');
    fireEvent.click(card(3, 3).querySelector('[aria-label="Move Up"]')!);
    expect(ids()).toBe('c2:Two|c3:Three|c1:One');
    card(1, 3).focus();
    fireEvent.keyDown(card(1, 3), { key: 'ArrowDown', altKey: true });
    expect(ids()).toBe('c3:Three|c2:Two|c1:One');
    // Focus followed the card it moved.
    expect(document.activeElement).toBe(card(2, 3));
    fireEvent.keyDown(card(2, 3), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(card(1, 3));
    fireEvent.keyDown(card(1, 3), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(card(1, 3));
    fireEvent.keyDown(card(1, 3), { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Card 1' })).toBeTruthy();
    vi.mocked(window.requestAnimationFrame).mockRestore();
  });

  it('removes a card with words behind an Undo that puts it back, and lets the Undo go', () => {
    vi.useFakeTimers();
    render(<Harness initial={three} />);
    fireEvent.click(card(2, 3).querySelector('[aria-label="Remove Card"]')!);
    expect(ids()).toBe('c1:One|c3:Three');
    expect(track).toHaveBeenCalledWith('UI', 'Removed', 'NoteCard');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(ids()).toBe('c1:One|c2:Two|c3:Three');
    expect(screen.queryByText('Card removed')).toBeNull();
    // Delete on a focused card, and the Undo leaves on its own.
    fireEvent.keyDown(card(3, 3), { key: 'Delete' });
    expect(ids()).toBe('c1:One|c2:Two');
    expect(screen.getByText('Card removed')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(NOTE_CARD_UNDO_MS);
    });
    expect(screen.queryByText('Card removed')).toBeNull();
  });

  it('keeps the Undo when the last card goes, on the empty state', () => {
    render(<Harness initial={[{ id: 'c1', text: 'Only' }]} />);
    fireEvent.keyDown(card(1, 1), { key: 'Backspace' });
    expect(screen.getByText('No Notes Yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(ids()).toBe('c1:Only');
  });

  it('removes an open card from its bin, and a blank one with no Undo', () => {
    render(<Harness initial={[...three, { id: 'c4', text: ' ' }]} />);
    fireEvent.keyDown(card(4, 4), { key: 'Delete' });
    expect(ids()).toBe('c1:One|c2:Two|c3:Three');
    expect(screen.queryByText('Card removed')).toBeNull();
  });

  it('stops at the most cards a slide holds', () => {
    const full = Array.from({ length: NOTE_CARDS_MAX }, (_, i) => ({
      id: `c${i + 1}`,
      text: 'x',
    }));
    render(<Harness initial={full} />);
    const add = screen.getByRole('button', { name: 'Add Card' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(add);
    expect(screen.getAllByRole('group')).toHaveLength(NOTE_CARDS_MAX);
    // Mod+Enter in an open card adds nothing either.
    fireEvent.click(card(1, NOTE_CARDS_MAX));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true });
    expect(screen.getAllByRole('group')).toHaveLength(NOTE_CARDS_MAX - 1);
  });

  it('closes the open card on a press outside it, and not on a press inside it', () => {
    render(<Harness initial={three} />);
    fireEvent.click(card(2, 3));
    fireEvent.pointerDown(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox')).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('counts characters near the limit, amber at it', () => {
    render(<Harness initial={[{ id: 'c1', text: 'a'.repeat(799) }]} />);
    fireEvent.click(card(1, 1));
    expect(screen.queryByText(/\/ 1,000/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a'.repeat(840) } });
    expect(screen.getByText('840 / 1,000').className).not.toContain('amber');
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'a'.repeat(NOTE_CARD_TEXT_MAX) },
    });
    expect(screen.getByText('1,000 / 1,000').className).toContain('amber');
  });

  it('takes a blank open card away when the list goes', () => {
    const onChange = vi.fn();
    const { unmount } = render(<Harness initial={three} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));
    onChange.mockClear();
    unmount();
    expect(onChange).toHaveBeenCalledWith(three);
  });

  it('reorders a card dragged by its grip', () => {
    render(<Harness initial={three} />);
    const grip = card(1, 3).querySelector('[aria-label="Drag to Reorder"]') as HTMLElement;
    const target = card(3, 3);
    target.getBoundingClientRect = () => ({ top: 100, height: 40 }) as DOMRect;
    document.elementFromPoint = () => target;
    fireEvent.pointerDown(grip, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(grip, { clientX: 10, clientY: 135 });
    fireEvent.pointerUp(grip, { clientX: 10, clientY: 135 });
    expect(ids()).toBe('c2:Two|c3:Three|c1:One');
  });
});

describe('noteCardsSummary', () => {
  it('counts the cards with words and their speaking time', () => {
    expect(noteCardsSummary([])).toBeNull();
    expect(noteCardsSummary([{ id: 'a', text: ' ' }])).toBeNull();
    expect(
      noteCardsSummary([
        { id: 'a', text: Array.from({ length: 130 }, () => 'word').join(' ') },
        { id: 'b', text: 'two words' },
      ]),
    ).toBe('2 cards · 1 min');
  });
});
