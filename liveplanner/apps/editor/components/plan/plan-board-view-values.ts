// What PlanBoardView hands the parts of the board it draws (PlanBoardViewHeader, PlanBoardGrid,
// PlanBoardColumnHeads): this render's values, read as they were when the board drew them all itself.
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ShapeElement } from '@liveplanner/project';
import type {
  BoardProjection,
  Item,
  ItemTypeDef,
  LaneHead,
  PlanBoardSetup,
  QuickFilter,
} from '@liveplanner/items';
import type { usePlanBoardDrop } from '@/hooks/plan/usePlanBoardDrop';
import type { useBoardCollapsed } from '@/hooks/plan/useBoardCollapsed';
import type { SlotSettingsValue } from '@/components/plan/dashboard/slot-menu';
import type { PlanContextValue } from './PlanContext';
import type { PlanPalette } from './plan-palette';
import type { ColumnTone } from './column-tones';
import type { boardLook } from './phone-board';
import type { useColumnReorder } from './useColumnReorder';
import type { CellCardsBase } from './PlanBoardCellCards';
import type { NewCard } from './AddCardPopover';
import type { usePlanTextScale } from './PlanTextScaleContext';
import type { useBoardSelection } from '@/hooks/plan/useBoardSelection';
import type { pickableStatuses } from './column-status-picks';

export interface PlanBoardViewValues {
  element: ShapeElement;
  plan: PlanContextValue | undefined;
  setup: PlanBoardSetup;
  projection: BoardProjection;
  palette: PlanPalette;
  types: readonly ItemTypeDef[];
  items: ReadonlyMap<string, Item>;
  statusNames: ReadonlyMap<string, string> | undefined;
  shownItems: readonly Item[];
  addTypes: ItemTypeDef[];
  self: PlanContextValue['self'];
  slot: SlotSettingsValue | null;
  look: ReturnType<typeof boardLook>;
  interactive: boolean;
  simplified: boolean;
  selected: boolean;
  maximised: boolean;
  filled: boolean;
  phone: boolean;
  canEdit: boolean;
  canEditCards: boolean;
  setUpHere: boolean;
  configuredFromCluster: boolean;
  quick: QuickFilter;
  setQuick: Dispatch<SetStateAction<QuickFilter>>;
  columnName: (s: string) => string;
  gridRef: RefObject<HTMLDivElement | null>;
  slotBoard: boolean;
  columnTemplate: string;
  lanes: LaneHead[];
  withLanes: boolean;
  collapse: ReturnType<typeof useBoardCollapsed>;
  collapsed: ReturnType<typeof useBoardCollapsed>['lanes'];
  shutColumns: ReadonlySet<string>;
  canCollapse: boolean;
  firstOpenLane: number;
  frameColumn: ((header: HTMLElement) => void) | null;
  addInHead: boolean;
  mayAdd: boolean;
  adding: { status: string; laneKey: string } | null;
  closeAdding: () => void;
  addInto: (
    status: string,
    lane: LaneHead | undefined,
    cell: readonly Item[],
  ) => (card: NewCard) => void;
  toneOf: (id: string) => ColumnTone | { palette: PlanPalette; bar: undefined };
  toggleColumn: (columnId: string) => void;
  reorder: ReturnType<typeof useColumnReorder>;
  held: ReturnType<typeof usePlanBoardDrop>['incoming'];
  empty: boolean;
  loading: boolean;
  shipColumnId: string | undefined;
  cellBase: CellCardsBase;
  busy: boolean;
  // The frame's own (PlanBoardFrame).
  boardRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  cardSize: CellCardsBase['cardSize'];
  radius: string;
  cornerVars: React.CSSProperties;
  fontFamily: string | undefined;
  textScale: ReturnType<typeof usePlanTextScale>;
  selection: ReturnType<typeof useBoardSelection>;
  menu: PlanBoardMenu | null;
  setMenu: Dispatch<SetStateAction<PlanBoardMenu | null>>;
  drag: ReturnType<typeof usePlanBoardDrop>['drag'];
  dragging: ReturnType<typeof usePlanBoardDrop>['drag']['drag'];
  fullSetup: PlanBoardSetup | null;
  pickable: ReturnType<typeof pickableStatuses>;
}

// A card's right-click menu (PlanCardMenu): the card and where it was asked for.
export interface PlanBoardMenu {
  itemId: string;
  at: { x: number; y: number };
}
