// The stack (docs/specs/007-editor/flashcards.md "The stack"): a tab of flashcards shows one card at
// a time, the card in front, with the cards still to come stacked behind it. The canvas's world
// layers (the sheets, the writing, the elements) are given the view narrowed to that card
// (flashcardStage); the chrome keeps the whole row. Pure.
import type { LaidOutPage, PageRect } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';

// At most this many cards show behind the card in front: enough depth to read as "many".
export const FLASHCARD_STACK_MAX = 6;
// Each card behind sits this much lower (canvas px) and this much narrower each side.
export const FLASHCARD_STACK_STEP_Y = 10;
export const FLASHCARD_STACK_INSET_X = 14;
// Each card further back is this much dimmer.
const STACK_DIM_STEP = 0.06;

export type CardStack = {
  // The card in front's place (0 first) and how many cards the stack holds.
  index: number;
  count: number;
  // How many cards come after it.
  behind: number;
};

/** The card in front and where it stands, its `pages` the one card: kept by identity while the
 *  row and the card are (usePagesMode memoises it). Null off a stack. */
export type CardStage = { pages: LaidOutPage[]; stack: CardStack };

export function cardStageOf(pages: LaidOutPage[], cardId: string | null): CardStage | null {
  if (!cardId) return null;
  const index = pages.findIndex((p) => p.id === cardId);
  if (index < 0) return null;
  const count = pages.length;
  return { pages: [pages[index]!], stack: { index, count, behind: count - index - 1 } };
}

/** The view the world layers draw in a stack: the card in front alone (the whole row kept for the
 *  writing's layout), and where it stands. Any other view as it is. */
export function flashcardStage(view: PagesModeView): PagesModeView {
  const { cardStage, ...rest } = view;
  // A page slide presenting shows its own page alone already.
  if (!cardStage || view.letterbox) return view;
  return {
    ...rest,
    pages: cardStage.pages,
    rowPages: view.rowPages ?? view.pages,
    cardStack: cardStage.stack,
  };
}

export type StackSheet = { rect: PageRect; dim: number };

/** The sheets drawn behind the card in front, nearest first: each lower and narrower than the one
 *  before it, at most FLASHCARD_STACK_MAX. */
export function stackSheets(rect: PageRect, behind: number): StackSheet[] {
  const n = Math.max(0, Math.min(FLASHCARD_STACK_MAX, behind));
  return Array.from({ length: n }, (_, i) => {
    const step = i + 1;
    return {
      rect: {
        x: rect.x + FLASHCARD_STACK_INSET_X * step,
        y: rect.y + FLASHCARD_STACK_STEP_Y * step,
        width: rect.width - 2 * FLASHCARD_STACK_INSET_X * step,
        height: rect.height,
      },
      dim: Math.min(0.5, STACK_DIM_STEP * step),
    };
  });
}

/** The card in front: the one asked for while it is a card of the row, else the first card. Null
 *  off a stack. When the card asked for has gone (an undo of the split that made it, a peer's
 *  delete), the card before its place (`at`, where it last stood) comes to the front, as a delete
 *  lands on the page before; an undone split no longer threw the stack back to its first card. */
export function cardInFrontOf(
  pages: readonly Pick<LaidOutPage, 'id' | 'kind'>[],
  wanted: string | null,
  at = 0,
): string | null {
  if (pages[0]?.kind !== 'flashcard') return null;
  if (wanted && pages.some((p) => p.id === wanted)) return wanted;
  if (!wanted) return pages[0].id;
  return pages[Math.min(Math.max(0, at - 1), pages.length - 1)]!.id;
}
