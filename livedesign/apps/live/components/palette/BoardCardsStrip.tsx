'use client';

// The palette while a board covers the canvas (docs/specs/026-plan/plan-board.md "The palette follows what fills the
// screen"): in place of the mode's strip, a card of its own at the header's right end holding only the cards that
// board takes, each placed the way the Cards tiles are (dragged into a column, or picked then dropped). Apart from the
// board's controls card (the cog), and wearing the board's hue as the menu box does (BAND_TINT).
import { boardAddTypes, normaliseBoardSetup } from '@livedesign/items';
import type { Element } from '@livedesign/document';
import { BAND_STRIP_FLUSH, BAND_TINT, TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { usePlan } from '@/components/plan/PlanContext';
import { PaletteTile, type PaletteTileActions } from './PaletteTileGrid';
import { planCardTile } from './palette-plan-tiles';

export function BoardCardsStrip({
  boardId,
  elements,
  actions,
  pendingDraw,
}: {
  boardId: string;
  elements: readonly Element[];
  actions: PaletteTileActions;
  pendingDraw: React.ComponentProps<typeof PaletteTile>['pendingDraw'];
}) {
  const plan = usePlan();
  const board = elements.find((e) => e.id === boardId);
  if (!plan?.canEdit || board?.type !== 'shape' || board.shape !== 'plan-board') return null;
  const setup = normaliseBoardSetup((board as { planBoard?: unknown }).planBoard);
  // An Archive board takes no new cards, and a board whose types are not chosen yet has none to offer.
  const types = setup && !setup.archive ? boardAddTypes(setup, plan.types) : [];
  if (types.length === 0) return null;
  return (
    <div
      data-board-cards=""
      data-floating-panel=""
      role="group"
      aria-label="Add Cards"
      className={`${TOOLBAR_CARD} ${BAND_TINT} ${BAND_STRIP_FLUSH}`}
    >
      {types.map((t) => {
        const def = planCardTile(t);
        return (
          <PaletteTile key={def.id} def={def} actions={actions} pendingDraw={pendingDraw} compact />
        );
      })}
    </div>
  );
}
