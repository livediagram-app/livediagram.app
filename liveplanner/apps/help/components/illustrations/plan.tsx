// Plan mode illustrations (docs/specs/026-plan/): a board with its header widgets and columns, the
// bottom-right cluster Plan mode brings, a column's cog, the board picker, the card panel, the card menu,
// the Card Types panel and one item on two boards. Composed from the shared primitives so the house style
// holds; the labels are the editor's own (PlanColumnPopover, ItemPanel, PlanCardMenu, CardTypesPanel...).
//
// This module is the entry: the board scenes live in ./plan-board, the card scenes in ./plan-cards (a card's Hidden
// tab in ./plan-card-hidden), and
// the pieces both draw with (a card, a header widget, a cog, a column) in ./plan-parts.

export { PlanBoardScene, PlanBoardPickerScene, PlanColumnSettingsScene } from './plan-board';
export {
  PlanCardPanelScene,
  PlanCardMenuScene,
  PlanCardTypesScene,
  PlanItemTwoBoardsScene,
  PlanCardThreadsScene,
} from './plan-cards';
export { PlanCardHiddenTabScene } from './plan-card-hidden';
