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
import { FlashcardFooter, FlashcardStackSheets, PageStackNav, StackNav } from './FlashcardStack';
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

  // flashcards.md "The card in front stands out".
  it('lifts the card in front off the fan, with a rim that suits its background, only while cards stand behind', () => {
    const lift = (card: LaidOutPage, behind: readonly LaidOutPage[]) =>
      render(
        <FlashcardStackSheets card={card} behind={behind} />,
      ).container.querySelector<HTMLElement>('[data-flashcard-lift]');
    const light = lift(cards[0]!, cards.slice(1))!;
    expect(light.style.left).toBe(`${cards[0]!.rect.x}px`);
    expect(light.style.width).toBe(`${cards[0]!.rect.width}px`);
    // A card with no background of its own: the rim follows the app's light or dark.
    expect(light.className).toContain('dark:[--rim:rgb(255_255_255/0.28)]');
    expect(light.style.boxShadow).toContain('var(--rim)');
    const darkCard = {
      ...cards[0]!,
      background: { fill: { kind: 'solid', color: '#2a1a10' } },
    } as LaidOutPage;
    expect(lift(darkCard, cards.slice(1))!.style.getPropertyValue('--rim')).toBe(
      'rgb(255 255 255 / 0.28)',
    );
    expect(lift(cards[3]!, [])).toBeNull();
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
        row={cards}
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
        row={cards.slice(0, 1)}
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

// flashcards.md "Getting around a stack": Previous and Next under the page in front, for everyone who sees it.
describe('getting around a stack', () => {
  it('goes to the card before or after, and stops at the ends', () => {
    const onGo = vi.fn();
    render(
      <StackNav
        stack={{ index: 1, count: 4, behind: 2 }}
        row={cards}
        noun="Card"
        dark={false}
        onGo={onGo}
      />,
    );
    expect(screen.getByRole('group', { name: 'Card 2 of 4' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    expect(onGo.mock.calls).toEqual([['a'], ['c']]);
  });

  it('disables Previous on the first and Next on the last', () => {
    const { rerender } = render(
      <StackNav stack={{ index: 0, count: 4, behind: 3 }} row={cards} noun="Card" onGo={vi.fn()} />,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Previous card' }).disabled).toBe(
      true,
    );
    rerender(
      <StackNav stack={{ index: 3, count: 4, behind: 0 }} row={cards} noun="Card" onGo={vi.fn()} />,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Next card' }).disabled).toBe(
      true,
    );
  });

  // Drawn over the card's writing, whose paper (ArticleFlows, painted after the sheets) would otherwise take the press.
  it('lifts a card’s footer and an infographic’s nav above the writing', () => {
    const { container } = render(
      <>
        <FlashcardFooter
          card={cards[1]!}
          stack={{ index: 1, count: 4, behind: 2 }}
          row={cards}
          flow={undefined}
          margin={48}
          font={undefined}
          onGo={vi.fn()}
        />
        <PageStackNav
          page={cards[0]!}
          stack={{ index: 0, count: 4, behind: 3 }}
          row={cards}
          zoom={1}
          onGo={vi.fn()}
        />
      </>,
    );
    expect(container.querySelector('[data-flashcard-footer]')!.className).toContain('z-[2]');
    expect(container.querySelector('[data-page-stack-nav]')!.className).toContain('z-[2]');
  });

  it('sits in a card’s footer beside its speaking time when it may flip, the place alone when not', () => {
    const { rerender } = render(
      <FlashcardFooter
        card={cards[1]!}
        stack={{ index: 1, count: 4, behind: 2 }}
        row={cards}
        flow={undefined}
        margin={48}
        font={undefined}
        onGo={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Next card' })).toBeTruthy();
    rerender(
      <FlashcardFooter
        card={cards[1]!}
        stack={{ index: 1, count: 4, behind: 2 }}
        row={cards}
        flow={undefined}
        margin={48}
        font={undefined}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says Page under an infographic page, held at one screen size under its bottom-right corner', () => {
    const page = cards[0]!;
    const { container } = render(
      <PageStackNav
        page={page}
        stack={{ index: 0, count: 4, behind: 3 }}
        row={cards}
        zoom={0.5}
        onGo={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Page 1 of 4' })).toBeTruthy();
    const host = container.querySelector<HTMLElement>('[data-page-stack-nav]')!;
    expect(host.style.left).toBe(`${page.rect.x + page.rect.width}px`);
    expect(host.style.transform).toContain('scale(2)');
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
