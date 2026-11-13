// A board placed new (docs/specs/026-plan/plan-board.md): its preset, empty, named after its tab (boardTitleForTab), at
// least as wide as its columns need, and taller while it has no columns yet (planBoardHeightFor). Shared by the
// palette's add and a Dashboard slot's new Board tab (docs/specs/026-plan/plan-tabs.md).
import { SHAPE_DEFAULT_SIZE } from '@liveplanner/project';
import {
  freshBoardSetup,
  planBoardHeightFor,
  planBoardWidthFor,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { boardTitleForTab } from '@/lib/tab-named-plan';

export function planBoardPlacement(preset: string | undefined, tabName: string) {
  const fresh = freshBoardSetup(preset);
  return planBoardSized({ ...fresh, title: boardTitleForTab(tabName, fresh.title) });
}

// A board placed with a set-up of its own (Describe a Plan's Make Plan, docs/specs/026-plan/describe-a-plan.md): its
// own title kept, sized as any placed board is.
export function planBoardSized(planBoard: PlanBoardSetup) {
  return {
    planBoard,
    width: Math.max(SHAPE_DEFAULT_SIZE['plan-board'].width, planBoardWidthFor(planBoard)),
    height: planBoardHeightFor(planBoard),
  };
}
