// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteCard } from '@livedocuments/document';
import { PresenterNoteCards, VIEWER_DOTS_MAX, VIEWER_STACK_MAX } from './PresenterNoteCards';

// docs/specs/012-collaboration/speaker-note-cards.md "Presenting": the card viewer.

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('reduce-motion');
});

const cards = (n: number): NoteCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, text: `Point ${i + 1}` }));

describe('PresenterNoteCards', () => {
  it('shows the card in front with its place, the cards behind it, and a live line', () => {
    render(<PresenterNoteCards cards={cards(5)} at={1} slideId="s1" onCard={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Presenter notes' });
    expect(dialog.textContent).toContain('Card 2 of 5');
    expect(dialog.querySelector('[data-note-card-front]')!.textContent).toContain('Point 2');
    expect(dialog.querySelectorAll('[data-note-card-behind]')).toHaveLength(VIEWER_STACK_MAX);
    expect(dialog.querySelector('[aria-live="polite"]')!.textContent).toBe('Card 2 of 5. Point 2');
  });

  it('goes to the cards either side and by dot, disabled at the ends', () => {
    const onCard = vi.fn();
    const { rerender } = render(
      <PresenterNoteCards cards={cards(3)} at={0} slideId="s1" onCard={onCard} />,
    );
    expect(screen.getByRole('button', { name: 'Previous Card' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Next Card' }));
    expect(onCard).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Card 3' }));
    expect(onCard).toHaveBeenLastCalledWith(2);
    rerender(<PresenterNoteCards cards={cards(3)} at={2} slideId="s1" onCard={onCard} />);
    expect(screen.getByRole('button', { name: 'Next Card' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Go to Card 3' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(document.querySelectorAll('[data-note-card-behind]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Previous Card' }));
    expect(onCard).toHaveBeenLastCalledWith(1);
  });

  it('shows no buttons for one card, and no dots past the most it draws', () => {
    const { rerender } = render(
      <PresenterNoteCards cards={cards(1)} at={0} slideId="s1" onCard={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Next Card' })).toBeNull();
    rerender(
      <PresenterNoteCards
        cards={cards(VIEWER_DOTS_MAX + 1)}
        at={0}
        slideId="s1"
        onCard={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Next Card' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to Card 1' })).toBeNull();
  });

  it('clamps a card past the end, and shows nothing with no cards', () => {
    const { rerender } = render(
      <PresenterNoteCards cards={cards(2)} at={9} slideId="s1" onCard={vi.fn()} />,
    );
    expect(screen.getByRole('dialog').textContent).toContain('Card 2 of 2');
    rerender(<PresenterNoteCards cards={[]} at={0} slideId="s1" onCard={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('flips forward with a picture of the card that turns away, back by turning the new card down', () => {
    const finish: (() => void)[] = [];
    const animate = vi.fn(function (this: HTMLElement) {
      const anim = { cancel: vi.fn(), onfinish: null as null | (() => void) };
      finish.push(() => anim.onfinish?.());
      return anim;
    });
    HTMLElement.prototype.animate = animate as never;
    const { rerender } = render(
      <PresenterNoteCards cards={cards(3)} at={0} slideId="s1" onCard={vi.fn()} />,
    );
    rerender(<PresenterNoteCards cards={cards(3)} at={1} slideId="s1" onCard={vi.fn()} />);
    const flip = document.querySelector('[data-note-card-flip]');
    expect(flip!.textContent).toContain('Point 1');
    expect(animate).toHaveBeenCalledTimes(1);
    finish[0]!();
    rerender(<PresenterNoteCards cards={cards(3)} at={1} slideId="s1" onCard={vi.fn()} />);
    expect(document.querySelector('[data-note-card-flip]')).toBeNull();
    rerender(<PresenterNoteCards cards={cards(3)} at={0} slideId="s1" onCard={vi.fn()} />);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-note-card-flip]')).toBeNull();
    // A new slide's first card comes without a flip.
    rerender(<PresenterNoteCards cards={cards(2)} at={1} slideId="s2" onCard={vi.fn()} />);
    expect(animate).toHaveBeenCalledTimes(2);
    // Reduced motion: no flip at all.
    document.documentElement.classList.add('reduce-motion');
    rerender(<PresenterNoteCards cards={cards(2)} at={0} slideId="s2" onCard={vi.fn()} />);
    expect(animate).toHaveBeenCalledTimes(2);
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });

  it('drops the picture at once where nothing animates', () => {
    const { rerender } = render(
      <PresenterNoteCards cards={cards(3)} at={0} slideId="s1" onCard={vi.fn()} />,
    );
    rerender(<PresenterNoteCards cards={cards(3)} at={1} slideId="s1" onCard={vi.fn()} />);
    expect(document.querySelector('[data-note-card-flip]')).toBeNull();
  });
});
