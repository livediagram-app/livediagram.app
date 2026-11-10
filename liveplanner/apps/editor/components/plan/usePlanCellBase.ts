// What every card on a Plan board draws with (PlanBoardCellCards; docs/specs/026-plan/plan-board.md "A busy board"),
// for PlanBoardView: one identity while none of it changes, so a cell whose own cards and gap are as they were is
// skipped.
import { useMemo } from 'react';
import { CARD_FIELDS } from '@liveplanner/items';
import type { CellCardsBase } from './PlanBoardCellCards';

export function usePlanCellBase({
  palette,
  cardSize,
  slotBoard,
  cardTouch,
  interactive,
  canEditCards,
  cardHandlers,
  cardVote,
  setup,
  selfId,
  presence,
  selected,
  liftedId,
  carried,
}: {
  palette: CellCardsBase['palette'];
  cardSize: CellCardsBase['cardSize'];
  slotBoard: boolean;
  cardTouch: CellCardsBase['touch'];
  interactive: boolean;
  canEditCards: boolean;
  cardHandlers: Pick<CellCardsBase, 'onPress' | 'onOpen' | 'onKey' | 'onMenu'> & {
    onLongPress: NonNullable<CellCardsBase['onLongPress']>;
  };
  cardVote: CellCardsBase['cardVote'];
  setup: CellCardsBase['setup'];
  selfId: string;
  presence: CellCardsBase['presence'];
  selected: CellCardsBase['selected'];
  liftedId: CellCardsBase['liftedId'];
  carried: CellCardsBase['carried'];
}): CellCardsBase {
  return useMemo<CellCardsBase>(
    () => ({
      palette,
      // What a card shows is its type's Display (docs/specs/026-plan/item-types.md "Card display").
      setupFields: CARD_FIELDS,
      cardSize,
      stacked: slotBoard,
      touch: cardTouch,
      interactive,
      canMove: canEditCards,
      onPress: cardHandlers.onPress,
      onOpen: cardHandlers.onOpen,
      onKey: cardHandlers.onKey,
      onMenu: cardHandlers.onMenu,
      ...(interactive && canEditCards ? { onLongPress: cardHandlers.onLongPress } : {}),
      cardVote,
      setup,
      selfId,
      presence,
      selected,
      liftedId,
      carried,
    }),
    [
      palette,
      cardSize,
      slotBoard,
      cardTouch,
      interactive,
      canEditCards,
      cardHandlers,
      cardVote,
      setup,
      selfId,
      presence,
      selected,
      liftedId,
      carried,
    ],
  );
}
