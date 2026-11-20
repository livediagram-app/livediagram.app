import { describe, expect, it } from 'vitest';
import { guardFlashcards } from './flashcard-guard';
import { layOutPages, newFlashcardPage, type Page } from './page';
import type { Element } from './index';

const box = (id: string, cx: number, cy: number) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: cx - 10,
    y: cy - 10,
    width: 20,
    height: 20,
  }) as Element;

const pages: Page[] = [newFlashcardPage('a', 'fa'), newFlashcardPage('b', 'fb')];
const [a] = layOutPages(pages);
const onCard = { x: a!.rect.x + 100, y: a!.rect.y + 100 };
const offCard = { x: a!.rect.x - 500, y: a!.rect.y };

describe('guardFlashcards', () => {
  it('passes an edit of a tab with no cards, or no edit at all', () => {
    const prev = [box('x', 0, 0)];
    const next = [box('x', 5, 5), box('y', 0, 0)];
    expect(guardFlashcards(prev, next, [{ id: 'p', orientation: 'portrait' }])).toEqual({
      elements: next,
      blocked: false,
    });
    expect(guardFlashcards(prev, prev, pages)).toEqual({ elements: prev, blocked: false });
  });

  it('leaves out a new element landing on a card, keeps one landing off every card', () => {
    const prev: Element[] = [];
    const landed = box('n', onCard.x, onCard.y);
    const beside = box('m', offCard.x, offCard.y);
    const out = guardFlashcards(prev, [landed, beside], pages);
    expect(out.blocked).toBe(true);
    expect(out.elements.map((e) => e.id)).toEqual(['m']);
  });

  it('puts back an element moved onto a card from off it', () => {
    const was = box('x', offCard.x, offCard.y);
    const moved = box('x', onCard.x, onCard.y);
    const out = guardFlashcards([was], [moved], pages);
    expect(out).toEqual({ elements: [was], blocked: true });
  });

  it('lets an element already on a card stay, change and move', () => {
    const was = box('x', onCard.x, onCard.y);
    const nudged = box('x', onCard.x + 10, onCard.y);
    expect(guardFlashcards([was], [nudged], pages)).toEqual({
      elements: [nudged],
      blocked: false,
    });
    const off = box('x', offCard.x, offCard.y);
    expect(guardFlashcards([was], [off], pages).blocked).toBe(false);
  });
});
