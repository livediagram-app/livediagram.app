import { describe, expect, it } from 'vitest';
import { layOutPages, newFlashcardPage } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import {
  cardInFrontOf,
  cardStageOf,
  flashcardStage,
  FLASHCARD_STACK_INSET_X,
  FLASHCARD_STACK_MAX,
  FLASHCARD_STACK_STEP_Y,
  stackSheets,
} from './flashcard-stack';

// docs/specs/007-editor/flashcards.md "The stack".
const cards = layOutPages(['a', 'b', 'c', 'd'].map((id, i) => newFlashcardPage(id, `f${i}`)));
const view = (extra: Partial<PagesModeView> = {}) =>
  ({ pages: cards, ...extra }) as unknown as PagesModeView;

describe('the card in front', () => {
  it('is the card asked for while it is in the stack, else the first', () => {
    expect(cardInFrontOf(cards, 'c')).toBe('c');
    expect(cardInFrontOf(cards, 'gone')).toBe('a');
    expect(cardInFrontOf(cards, null)).toBe('a');
  });

  it('is none off a stack', () => {
    expect(cardInFrontOf([{ id: 'p', kind: 'slide' }], 'p')).toBeNull();
    expect(cardInFrontOf([], null)).toBeNull();
  });
});

describe('the stage', () => {
  it('is the card in front alone, with its place and the cards behind it', () => {
    const stage = cardStageOf(cards, 'b')!;
    expect(stage.pages.map((p) => p.id)).toEqual(['b']);
    expect(stage.stack).toEqual({ index: 1, count: 4, behind: 2 });
    expect(cardStageOf(cards, 'd')!.stack.behind).toBe(0);
  });

  it('is none without a card in front', () => {
    expect(cardStageOf(cards, null)).toBeNull();
    expect(cardStageOf(cards, 'gone')).toBeNull();
  });

  it('narrows the world layers to the card, keeping the whole row for the writing', () => {
    const cardStage = cardStageOf(cards, 'c')!;
    const staged = flashcardStage(view({ cardStage }));
    expect(staged.pages).toBe(cardStage.pages);
    expect(staged.rowPages).toBe(cards);
    expect(staged.cardStack).toEqual({ index: 2, count: 4, behind: 1 });
    expect(staged).not.toHaveProperty('cardStage');
  });

  it('leaves any other view, and a page slide presenting, as it is', () => {
    const plain = view();
    expect(flashcardStage(plain)).toBe(plain);
    const presenting = view({ cardStage: cardStageOf(cards, 'a')!, letterbox: true });
    expect(flashcardStage(presenting)).toBe(presenting);
  });
});

describe('the sheets behind', () => {
  const rect = { x: 100, y: 50, width: 900, height: 540 };

  it('step down and in, nearest first, dimmer the further back', () => {
    const sheets = stackSheets(rect, 2);
    expect(sheets.map((s) => s.rect)).toEqual([
      {
        x: 100 + FLASHCARD_STACK_INSET_X,
        y: 50 + FLASHCARD_STACK_STEP_Y,
        width: 900 - 2 * FLASHCARD_STACK_INSET_X,
        height: 540,
      },
      {
        x: 100 + 2 * FLASHCARD_STACK_INSET_X,
        y: 50 + 2 * FLASHCARD_STACK_STEP_Y,
        width: 900 - 4 * FLASHCARD_STACK_INSET_X,
        height: 540,
      },
    ]);
    expect(sheets[1]!.dim).toBeGreaterThan(sheets[0]!.dim);
  });

  it('show at most FLASHCARD_STACK_MAX, and none behind the last card', () => {
    expect(stackSheets(rect, 40)).toHaveLength(FLASHCARD_STACK_MAX);
    expect(stackSheets(rect, 0)).toEqual([]);
    expect(stackSheets(rect, -1)).toEqual([]);
  });
});
