// A board placed new (docs/specs/026-plan/plan-board.md): its preset, empty, named after its tab (boardTitleForTab), at
// least as wide as its columns need, and taller while it has no columns yet (planBoardHeightFor). Shared by the
// palette's add and a Dashboard slot's new Board tab (docs/specs/026-plan/plan-tabs.md).
import { SHAPE_DEFAULT_SIZE } from '@livediagram/document';
import { freshBoardSetup, planBoardHeightFor, planBoardWidthFor } from '@livediagram/items';
import { boardTitleForTab } from '@/lib/tab-named-plan';

export function planBoardPlacement(preset: string | undefined, tabName: string) {
  const fresh = freshBoardSetup(preset);
  const planBoard = { ...fresh, title: boardTitleForTab(tabName, fresh.title) };
  return {
    planBoard,
    width: Math.max(SHAPE_DEFAULT_SIZE['plan-board'].width, planBoardWidthFor(planBoard)),
    height: planBoardHeightFor(planBoard),
  };
}
