// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { layOutPages, type LaidOutPage } from '@liveknowledge/document';
import { FlashcardStackSheets, PageStackNav, StackNav } from './FlashcardStack';

// docs/specs/007-editor/pages-mode.md "Stacked infographics".
const cards = layOutPages(
  ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    orientation: 'landscape' as const,
    kind: 'infographic' as const,
  })),
);

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

  // pages-mode.md "Stacked infographics": a flip moves the stack a page with the view, so only the fan eases.
  it('stands every card behind at the card in front, its fan place a transform, so a flip eases only the fan', () => {
    const at = (front: LaidOutPage, behind: readonly LaidOutPage[]) => [
      ...render(
        <FlashcardStackSheets card={front} behind={behind} />,
      ).container.querySelectorAll<HTMLElement>('[data-flashcard-behind]'),
    ];
    const sheets = at(cards[0]!, cards.slice(1));
    for (const s of sheets) {
      expect(s.style.left).toBe(`${cards[0]!.rect.x}px`);
      expect(s.style.top).toBe(`${cards[0]!.rect.y}px`);
      expect(s.style.transform).toMatch(
        /^translate\(-?[\d.]+px, -?[\d.]+px\) rotate\(-?[\d.]+deg\)$/,
      );
      expect(s.className).toContain('transition-[transform,opacity]');
      expect(s.className).not.toMatch(/transition-\[[^\]]*\b(left|top)\b/);
    }
  });

  // pages-mode.md "Stacked infographics".
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

// pages-mode.md "Stacked infographics": Previous and Next under the page in front, for everyone who sees it.
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
