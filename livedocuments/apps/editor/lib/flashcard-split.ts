// Split Onto a New Card's state as the card's menu and its Too long marker offer it
// (docs/specs/007-editor/flashcards.md "Never flows").
import { MAX_PAGES } from '@livedocuments/document';
import type { CardSplitState } from '@/hooks/editor/page-edits';

/** A card's split, as its marker reads it: whether it can split now, and the split. */
export type CardSplit = {
  state: (pageId: string) => CardSplitState;
  run: (pageId: string) => void;
};

/** Why a too-long card cannot split now, as a tooltip says it. */
export const CARD_SPLIT_REASON: Record<Exclude<CardSplitState, 'fits' | 'ready'>, string> = {
  'one-paragraph': 'One paragraph fills this card: shorten it to split',
  'page-limit': `A tab holds at most ${MAX_PAGES} pages: delete one to split this card`,
};

/** The split button's tooltip in the card's menu. */
export function cardSplitLabel(state: Exclude<CardSplitState, 'fits'>): string {
  return state === 'ready' ? 'Split Onto a New Card' : CARD_SPLIT_REASON[state];
}
