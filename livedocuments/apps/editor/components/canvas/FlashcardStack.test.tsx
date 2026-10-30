// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  layOutPages,
  newFlashcardPage,
  type ArticleFlow,
  type LaidOutPage,
} from '@livedocuments/document';
import { publishCardOverflow } from '@/lib/flashcard-overflow-store';
import type { CardSplit } from '@/lib/flashcard-split';
import { FlashcardFooter, FlashcardStackSheets } from './FlashcardStack';
import { FlashcardTooLong } from './article/FlashcardTooLong';

// docs/specs/007-editor/flashcards.md "The stack", "Card number and speaking time", "Never flows"
// and "Share roles".
const cards = layOutPages(['a', 'b', 'c', 'd'].map((id, i) => newFlashcardPage(id, `f${i}`)));
const flow = (text: string): ArticleFlow => ({
  blocks: [{ id: 'p', type: 'paragraph', runs: [{ text }] }],
});

afterEach(() => publishCardOverflow('f0', null));

describe('the cards behind', () => {
  it('draws one sheet per card still to come, a view taking no presses', () => {
    const { container } = render(<FlashcardStackSheets card={cards[0]!} behind={cards.slice(1)} />);
    const sheets = container.querySelectorAll('[data-flashcard-behind]');
    expect(sheets).toHaveLength(3);
    for (const sheet of sheets) {
      expect(sheet.getAttribute('aria-hidden')).toBe('true');
      expect(sheet.className).toContain('pointer-events-none');
    }
  });

  it('wears each card’s own background', () => {
    const tinted = { ...cards[1]!, background: { fill: { kind: 'solid', color: '#fef3c7' } } };
    const { container } = render(
      <FlashcardStackSheets card={cards[0]!} behind={[tinted as LaidOutPage]} />,
    );
    const sheet = container.querySelector<HTMLElement>('[data-flashcard-behind]')!;
    expect(sheet.className).not.toContain('bg-white');
  });
});

describe('the footer', () => {
  it('says the card’s place and how long its words take to say', () => {
    const { container } = render(
      <FlashcardFooter
        card={cards[1]!}
        stack={{ index: 1, count: 4, behind: 2 }}
        flow={flow(Array.from({ length: 130 }, () => 'word').join(' '))}
        margin={48}
        font="serif"
      />,
    );
    expect(screen.getByText('Card 2 of 4')).toBeTruthy();
    expect(container.querySelector('[data-speaking-time]')!.textContent).toBe('1 min');
  });

  it('shows the number alone on an empty card, light on a dark one', () => {
    const dark = { ...cards[0]!, background: { fill: { kind: 'solid', color: '#0f172a' } } };
    const { container } = render(
      <FlashcardFooter
        card={dark as LaidOutPage}
        stack={{ index: 0, count: 1, behind: 0 }}
        flow={undefined}
        margin={48}
        font={undefined}
      />,
    );
    const footer = container.querySelector<HTMLElement>('[data-flashcard-footer]')!;
    expect(footer.textContent).toBe('Card 1 of 1');
    expect(footer.style.color).toContain('255');
  });
});

describe('Too long for this card', () => {
  const split = (state: ReturnType<CardSplit['state']>): CardSplit => ({
    state: vi.fn(() => state),
    run: vi.fn(),
  });

  it('an Editor splits the card from it', () => {
    const s = split('ready');
    render(<FlashcardTooLong page={cards[0]!} zoom={1} split={s} />);
    expect(screen.getByRole('status').textContent).toContain('Too long for this card');
    fireEvent.click(screen.getByRole('button', { name: 'Split Onto a New Card' }));
    expect(s.run).toHaveBeenCalledWith('a');
  });

  it('says why it cannot split, and does nothing pressed', () => {
    const s = split('one-paragraph');
    render(<FlashcardTooLong page={cards[0]!} zoom={1} split={s} />);
    const button = screen.getByRole('button', { name: 'Split Onto a New Card' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(s.run).not.toHaveBeenCalled();
  });

  it.each(['Participant', 'Viewer'])('a %s sees the marker without its button', () => {
    render(<FlashcardTooLong page={cards[0]!} zoom={2} />);
    expect(screen.getByRole('status').textContent).toBe('Too long for this card');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads the split again as the writing past the foot changes', () => {
    const s = split('ready');
    render(<FlashcardTooLong page={cards[0]!} zoom={1} split={s} />);
    const before = vi.mocked(s.state).mock.calls.length;
    act(() => publishCardOverflow('f0', 'p'));
    expect(vi.mocked(s.state).mock.calls.length).toBeGreaterThan(before);
  });
});
