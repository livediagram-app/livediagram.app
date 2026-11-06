import { describe, expect, it } from 'vitest';
import { layOutPages, newFlashcardPage } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import {
  cardInFrontOf,
  cardFlowsToMount,
  cardStageOf,
  flashcardStage,
  FLASHCARD_MOUNT_SPAN,
  FLASHCARD_FAN,
  FLASHCARD_STACK_MAX,
  shownPagesOf,
  stackSheets,
  stacksPages,
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

  it('brings the card before its place to the front when the card asked for has gone', () => {
    // An undone split took away card 3 of 4, the card in front: card 2 comes to the front, not card 1.
    expect(cardInFrontOf(cards, 'gone', 2)).toBe('b');
    expect(cardInFrontOf(cards, 'gone', 0)).toBe('a');
    expect(cardInFrontOf(cards, 'gone', 9)).toBe('d');
  });

  it('is none off a stack', () => {
    expect(cardInFrontOf([{ id: 'p', kind: 'slide' }], 'p')).toBeNull();
    expect(cardInFrontOf([], null)).toBeNull();
  });
});

// pages-mode.md "Stacking infographics": only flashcards stack by default; an infographic tab stacked from Contents
// Options stands as a stack too; an article never does.
describe('which tabs stack', () => {
  const sheets = layOutPages([
    { id: 'p1', orientation: 'portrait' },
    { id: 'p2', orientation: 'portrait', kind: 'infographic' },
    { id: 'p3', orientation: 'portrait' },
  ]);

  it('stacks flashcards by default, and an infographic tab only once stacked', () => {
    expect(stacksPages(cards)).toBe(true);
    expect(stacksPages(sheets)).toBe(false);
    expect(stacksPages(sheets, 'stack')).toBe(true);
    expect(cardInFrontOf(sheets, 'p2')).toBeNull();
    expect(stacksPages([{ kind: 'slide' }])).toBe(false);
    expect(stacksPages([{ kind: 'article' }])).toBe(false);
    expect(stacksPages([])).toBe(false);
  });

  it('puts an infographic page in front, the pages after it behind', () => {
    expect(cardInFrontOf(sheets, null, 0, 'stack')).toBe('p1');
    const stage = cardStageOf(sheets, cardInFrontOf(sheets, 'p2', 0, 'stack'))!;
    expect(stage.pages.map((p) => p.id)).toEqual(['p2']);
    expect(stage.stack).toEqual({ index: 1, count: 3, behind: 1 });
  });

  it('brings a page added to the front, and the page before forward when the one in front is deleted', () => {
    const added = layOutPages([...sheets, { id: 'p4', orientation: 'portrait' }]);
    expect(cardInFrontOf(added, 'p4', 0, 'stack')).toBe('p4');
    const deleted = layOutPages(sheets.filter((p) => p.id !== 'p3'));
    expect(cardInFrontOf(deleted, 'p3', 2, 'stack')).toBe('p2');
  });

  it('shows the page in front alone, so the elements are cut to it; every page off a stack or presenting', () => {
    const cardStage = cardStageOf(sheets, 'p2')!;
    expect(shownPagesOf({ pages: sheets, cardStage }).map((p) => p.id)).toEqual(['p2']);
    expect(shownPagesOf({ pages: sheets })).toBe(sheets);
    expect(shownPagesOf({ pages: sheets, cardStage, letterbox: true })).toBe(sheets);
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

  it('fan out round the card, nearest first, alternating sides, turning further back and fading', () => {
    const sheets = stackSheets(rect, FLASHCARD_STACK_MAX);
    // Each the card's size, nudged off it by its place in the fan.
    sheets.forEach((s, i) => {
      expect(s.rect).toEqual({
        x: 100 + FLASHCARD_FAN[i]!.dx,
        y: 50 + FLASHCARD_FAN[i]!.dy,
        width: 900,
        height: 540,
      });
    });
    const turns = sheets.map((s) => s.turn);
    // Alternating sides, so corners show left and right, not only below.
    turns.slice(1).forEach((t, i) => expect(Math.sign(t)).toBe(-Math.sign(turns[i]!)));
    // Turning further the deeper it sits, gently: never past 5 degrees.
    turns.slice(1).forEach((t, i) => expect(Math.abs(t)).toBeGreaterThan(Math.abs(turns[i]!)));
    expect(Math.max(...turns.map(Math.abs))).toBeLessThanOrEqual(5);
    // Receding: fainter the further back, never fully gone, never as strong as the card in front.
    sheets.slice(1).forEach((s, i) => expect(s.opacity).toBeLessThanOrEqual(sheets[i]!.opacity));
    expect(sheets[0]!.opacity).toBeLessThanOrEqual(0.5);
    expect(sheets.at(-1)!.opacity).toBeGreaterThan(0);
  });

  it('is the same fan every time', () => {
    expect(stackSheets(rect, 3)).toEqual(stackSheets(rect, 3));
  });

  it('show at most FLASHCARD_STACK_MAX, and none behind the last card', () => {
    expect(stackSheets(rect, 40)).toHaveLength(FLASHCARD_STACK_MAX);
    expect(stackSheets(rect, 0)).toEqual([]);
    expect(stackSheets(rect, -1)).toEqual([]);
  });
});

// flashcards.md "Long stacks stay quick".
describe('the writing a stack mounts', () => {
  const stack = (index: number) => ({
    index,
    count: cards.length,
    behind: cards.length - index - 1,
  });

  it('is the card in front and one each side', () => {
    expect(FLASHCARD_MOUNT_SPAN).toBe(1);
    expect([...cardFlowsToMount(cards, stack(1), [])!]).toEqual(['f0', 'f1', 'f2']);
    expect([...cardFlowsToMount(cards, stack(0), [])!]).toEqual(['f0', 'f1']);
    expect([...cardFlowsToMount(cards, stack(3), [])!]).toEqual(['f2', 'f3']);
  });

  it('keeps the card being written and one asked to take focus', () => {
    expect([...cardFlowsToMount(cards, stack(0), ['f3', null, undefined])!]).toEqual([
      'f0',
      'f1',
      'f3',
    ]);
  });

  it('skips a page with no writing, and mounts every article off a stack', () => {
    const row = [{ ...cards[0]!, flow: undefined }, cards[1]!];
    expect([...cardFlowsToMount(row, stack(0), [])!]).toEqual(['f1']);
    expect(cardFlowsToMount(cards, undefined, ['f0'])).toBeNull();
  });
});
