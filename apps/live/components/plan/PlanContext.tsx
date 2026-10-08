'use client';

// What every Plan board and Plan card on the canvas reads (docs/specs/026-plan/blueprints/plan-board.md
// "Editor components"): the document's items, who is looking, whether input works the Plan way, and
// the actions a board takes. A context, like MindOutlineContext, because the consumers are element
// bodies far below the editor state. Undefined outside the editor (share view, exports): a board
// then draws read-only from nothing.
import type { StatusBoard } from '@/hooks/plan/usePlanStatusNames';
import { createContext, useContext } from 'react';
import type { ItemCommentAction } from '@/lib/api/items';
import type { PlanViewRef } from '@livediagram/document';
import type {
  BoardStatusTypes,
  Item,
  ItemMove,
  ItemPatch,
  ItemPerson,
  ItemTypeDef,
  PlanBoardSetup,
  StatusPhase,
} from '@livediagram/items';
import type { PlanItemsStatus } from '@/hooks/plan/usePlanItems';
import type { ItemOpenVia } from './item-trail';
import type { ItemTypesSlice } from '@/hooks/plan/useItemTypes';

// Someone else's hands on a card: dragging it or reading it.
export type PlanCardPresence = { name: string; color: string; state: 'drag' | 'view' };

export type PlanContextValue = {
  items: ReadonlyMap<string, Item>;
  // The document's item types, in order (docs/specs/026-plan/item-types.md).
  types: readonly ItemTypeDef[];
  // Their changes (the Card Types panel and the type editor).
  itemTypes: ItemTypesSlice;
  // Opens the type editor on a type, or on a new one (filled from `fromId` when duplicating).
  editType: (typeId: string | 'new', fromId?: string) => void;
  // Add New Card Type from a board's Add a Card menu: a new type with only the board's statuses on, added to the
  // board once saved (docs/specs/026-plan/plan-board.md "Add New Card Type").
  createTypeForBoard: (boardId: string, statuses: readonly string[]) => void;
  // Setup Board on a board that has columns (its Board Title's Setup Board): the board showing it, or null.
  setupBoardId: string | null;
  openBoardSetup: (boardId: string | null) => void;
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
  // `via`: opened from inside the item panel, which steps its card trail (item-trail.ts) instead of starting one.
  openItem: (itemId: string, via?: ItemOpenVia) => void;
  // A card this person just made, opened at once with its title selected (never for others' or undone cards).
  openNewItem: (itemId: string, via?: ItemOpenVia) => void;
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
  // Whether the change landed (false: refused, and the store put back).
  patchItem: (itemId: string, patch: ItemPatch) => Promise<boolean>;
  deleteItem: (itemId: string) => void;
  // A card's comment change (docs/specs/026-plan/items.md "Comments"); comments need participate access.
  commentItem: (itemId: string, action: ItemCommentAction) => void;
  // This person's owner id: the author id on their own comments, for the delete-own control.
  ownerId: string;
  updateBoard: (boardId: string, setup: PlanBoardSetup) => void;
  // Delete Status: the state's columns off every board but `exceptBoardId` (the one deleting it updates itself).
  removeStatusColumns: (status: string, exceptBoardId: string) => void;
  // A plan view's settings (the Gantt's swimlanes and names width): one element edit, synced and undoable.
  updateView: (viewId: string, settings: PlanViewRef) => void;
  // A card dragged off a board onto the canvas, at a canvas point: a Plan card is left there.
  placeCardOut: (itemId: string, x: number, y: number) => void;
  removeCard: (cardElementId: string) => void;
  announce: (message: string) => void;
  setDragging: (itemId: string | null) => void;
  // The card being dragged by this person, if any (the Trash grows to take it).
  draggingItemId: string | null;
  // The Trash (docs/specs/026-plan/items.md "Trash").
  trashItem: (itemId: string) => void;
  // Many cards to the Trash as one write and one undo step; answers how many went.
  trashItems: (itemIds: readonly string[]) => number;
  restoreItem: (itemId: string) => void;
  emptyTrash: () => void;
  // A card as a slide of the deck (docs/specs/012-collaboration/presentation-mode.md "Item slides");
  // absent where there is no deck to add to.
  addItemSlide?: (itemId: string) => void;
  // A whole board as a slide ("Board slides" there); absent with addItemSlide.
  addBoardSlide?: (boardId: string) => void;
  // The names the tab's boards give their statuses, in order (an All Cards board's rows).
  statusNames: ReadonlyMap<string, string>;
  // The phase the tab's boards give each status: what the plan views count as done
  // (docs/specs/026-plan/plan-views.md "What a plan view reads").
  statusPhases: ReadonlyMap<string, StatusPhase>;
  // The card types the document's boards show under each status they name: what Not on a Board reads
  // (docs/specs/026-plan/items.md "Finding a card").
  statusTypes: BoardStatusTypes;
  // Each board's title and the statuses it names, in board order: the type editor's States groups by them.
  statusBoards: readonly StatusBoard[];
};

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export const PlanProvider = PlanContext.Provider;

export function usePlan(): PlanContextValue | undefined {
  return useContext(PlanContext);
}
