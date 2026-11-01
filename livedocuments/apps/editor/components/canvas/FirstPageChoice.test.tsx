// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirstPageChoice } from './FirstPageChoice';
import { kindCardIsWide } from './page-kind-cards';

// docs/specs/007-editor/pages-mode.md "Page kinds": the first page's own choice.
afterEach(() => cleanup());

describe('FirstPageChoice', () => {
  it('moves between the four cards with the arrow keys, as the Add a Page popover does', () => {
    const onChoose = vi.fn();
    render(<FirstPageChoice zoom={1} onChoose={onChoose} />);
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(4);
    cards[0]!.focus();
    fireEvent.keyDown(cards[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cards[1]);
    fireEvent.keyDown(cards[1]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(cards[0]);
    fireEvent.keyDown(cards[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cards[2]);
    fireEvent.keyDown(cards[2]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cards[0]);
    fireEvent.keyDown(cards[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(cards[3]);
    fireEvent.click(cards[2]!);
    expect(onChoose).toHaveBeenCalledWith('slide');
  });

  // docs/specs/007-editor/flashcards.md "Making flashcards".
  it('offers Flashcards, which makes the first card of a stack', () => {
    const onChoose = vi.fn();
    render(<FirstPageChoice zoom={1} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole('button', { name: /Flashcards/ }));
    expect(onChoose).toHaveBeenCalledWith('flashcard');
  });

  it('puts an odd last card across both columns, never an even one', () => {
    expect(kindCardIsWide(3)).toBe(false);
    expect(kindCardIsWide(2, 3)).toBe(true);
    expect(kindCardIsWide(1, 3)).toBe(false);
  });

  // A 375 px phone cut both edges off a fixed 420 px card: it keeps a 16 px gutter a side.
  it('is never wider than the screen less a 16 px gutter a side', () => {
    render(<FirstPageChoice zoom={0.4} onChoose={vi.fn()} />);
    const card = document.querySelector('[data-first-page-choice]')!;
    expect(card.className).toContain('w-[min(420px,calc(100vw-32px))]');
    expect(card.className).not.toMatch(/(^|\s)w-\[420px\]/);
  });
});
