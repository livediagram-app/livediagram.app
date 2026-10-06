'use client';

// What every Plan board and Plan card on the canvas reads (docs/specs/026-plan/blueprints/plan-board.md
// "Editor components"): the document's items, who is looking, whether input works the Plan way, and
// the actions a board takes. A context, like MindOutlineContext, because the consumers are element
// bodies far below the editor state. Undefined outside the editor (share view, exports): a board
// then draws read-only from nothing.
import { createContext, useContext } from 'react';
import type {
  Item,
  ItemMove,
  ItemPatch,
  ItemPerson,
  ItemTypeDef,
  PlanBoardSetup,
  StatusPhase,
} from '@livediagram/items';
import type { PlanItemsStatus } from '@/hooks/plan/usePlanItems';
import type { ItemTypesSlice } from '@/hooks/plan/useItemTypes';

// Someone else's hands on a card: dragging it or reading it.
export type PlanCardPresence = { name: string; color: string; state: 'drag' | 'view' };

export type PlanContextValue = {
  items: ReadonlyMap<string, Item>;
  // The document's item types, in order (docs/specs/026-plan/item-types.md).
  types: readonly ItemTypeDef[];
  // Their changes (the Card Types panel and the type editor).
  itemTypes: ItemTypesSlice;
  // Opens the type editor on a type, or on a new one.
  editType: (typeId: string | 'new') => void;
  status: PlanItemsStatus;
  self: ItemPerson | null;
  // People who could be assigned (the room, and the people already on items).
  people: readonly ItemPerson[];
  // Plan mode is on for this person: cards take the pointer.
  planInput: boolean;
  canEdit: boolean;
  // Votes need only participate access (docs/specs/026-plan/items.md "Who may do what").
  canVote: boolean;
  presence: ReadonlyMap<string, PlanCardPresence>;
  retry: () => void;
  openItem: (itemId: string) => void;
  openItemId: string | null;
  addItem: (input: {
    type: string;
    fields: Item['fields'];
    status: string;
    after: string | null;
    // Placed before this item instead (a palette card dropped between two cards).
    before?: string | null;
    // The new item's id, when the caller opens it next.
    id?: string;
  }) => void;
  moveItem: (itemId: string, move: ItemMove) => void;
  patchItem: (itemId: string, patch: ItemPatch) => void;
  deleteItem: (itemId: string) => void;
  vote: (itemId: string, delta: 1 | -1) => void;
  updateBoard: (boardId: string, setup: PlanBoardSetup) => void;
  // A card dragged off a board onto the canvas, at a canvas point: a Plan card is left there.
  placeCardOut: (itemId: string, x: number, y: number) => void;
  removeCard: (cardElementId: string) => void;
  announce: (message: string) => void;
  setDragging: (itemId: string | null) => void;
  // The card being dragged by this person, if any (the Trash grows to take it).
  draggingItemId: string | null;
  // The Trash (docs/specs/026-plan/items.md "Trash").
  trashItem: (itemId: string) => void;
  restoreItem: (itemId: string) => void;
  emptyTrash: () => void;
  // A card as a slide of the deck (docs/specs/012-collaboration/presentation-mode.md "Item slides");
  // absent where there is no deck to add to.
  addItemSlide?: (itemId: string) => void;
  // The names the tab's boards give their statuses, in order (an All Cards board's rows).
  statusNames: ReadonlyMap<string, string>;
  // The phase the tab's boards give each status: what the plan views count as done
  // (docs/specs/026-plan/plan-views.md "What a plan view reads").
  statusPhases: ReadonlyMap<string, StatusPhase>;
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export const PlanProvider = PlanContext.Provider;

export function usePlan(): PlanContextValue | undefined {
  return useContext(PlanContext);
}
