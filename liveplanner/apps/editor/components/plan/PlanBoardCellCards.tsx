'use client';

// One cell's cards (docs/specs/026-plan/blueprints/plan-board.md "Card redraws"): memoised on the cell's cards and
// what every card of the board shares (`base`, kept by PlanBoardView), so a drop gap moving within one cell, the
// pointer crossing into another or a card picked up draws that cell alone; the board drew every card's element of
// 2,000 each time (plan-board.md "A drag stays smooth").
import { memo } from 'react';
import { cardIsFaceDown, type Item } from '@liveplanner/items';
import { PlanBoardCard } from './PlanBoardCells';
import { cardRuns } from './card-runs';
import { PlanCardRun } from './PlanCardRun';

type CardProps = Parameters<typeof PlanBoardCard>[0];

// What every card of the board draws with, one identity while none of it changes.
export type CellCardsBase = Pick<
  CardProps,
  | 'palette'
  | 'setupFields'
  | 'cardSize'
  | 'stacked'
  | 'touch'
  | 'interactive'
  | 'canMove'
  | 'onPress'
  | 'onOpen'
  | 'onKey'
  | 'onMenu'
  | 'onLongPress'
  | 'cardVote'
> & {
  // Null only while the board's set-up can't be read, when no cell is drawn.
  setup: Parameters<typeof cardIsFaceDown>[1] | null;
  selfId: string;
  presence: ReadonlyMap<string, NonNullable<CardProps['presence']>> | undefined;
  selected: ReadonlySet<string>;
  // The card being carried and the others carried with it: drawn lifted.
  liftedId: string | undefined;
  carried: ReadonlySet<string>;
};

// One card's element, outside the component: the React Compiler cached a card drawn by a closure inside the cell
// by the card's id alone, so a presence ring, a selection or a lifted card that changed for the same card never
// showed (an e2e caught it: plan-collab.spec.ts "someone who joins after a card was opened sees it held").
function cardElement(
  item: Item,
  base: CellCardsBase,
  done: boolean,
  ships: boolean,
  gapBefore: string | null,
  gapHeight: number | undefined,
) {
  const { setup, selfId, presence, selected, liftedId, carried, onLongPress, ...shared } = base;
  return (
    <PlanBoardCard
      key={item.id}
      {...shared}
      item={item}
      placeholderBefore={gapBefore === item.id ? gapHeight : undefined}
      lifted={liftedId === item.id || carried.has(item.id)}
      selected={selected.has(item.id)}
      done={done}
      ships={ships}
      faceDown={!!setup && cardIsFaceDown(item, setup, selfId)}
      presence={presence?.get(item.id)}
      {...(onLongPress ? { onLongPress } : {})}
    />
  );
}

export const PlanBoardCellCards = memo(function PlanBoardCellCards({
  cards,
  base,
  done,
  ships = false,
  busy,
  simplified,
  gapBefore,
  gapHeight,
}: {
  cards: readonly Item[];
  base: CellCardsBase;
  done: boolean;
  // The column the Practice Sprint ships to (plan-tour.md "Boards: Practice Sprint").
  ships?: boolean;
  busy: boolean;
  simplified: boolean;
  // The card a drop gap opens above in this cell (never the carried card itself), and its height.
  gapBefore: string | null;
  gapHeight: number | undefined;
}) {
  const draw = (run: readonly Item[]) =>
    run.map((item) => cardElement(item, base, done, ships, gapBefore, gapHeight));
  // A busy board draws its cards in runs, each built only while near the view (card-runs.ts, PlanCardRun).
  return busy
    ? cardRuns(cards).map((run) => (
        <PlanCardRun
          key={run[0]!.id}
          ids={run.map((c) => c.id).join(' ')}
          count={run.length}
          simplified={simplified}
        >
          {draw(run)}
        </PlanCardRun>
      ))
    : draw(cards);
});
