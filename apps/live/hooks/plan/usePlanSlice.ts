'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { usePlanFillTab } from './usePlanFillTab';
import {
  createShape,
  hasPlanInput,
  type EditorMode,
  type Element,
  type Tab,
  type PlanCardRef,
  type PlanViewRef,
} from '@livediagram/document';
import {
  normaliseBoardSetup,
  TRASHED_FROM_FIELD,
  TRASH_STATUS,
  isTrashed,
  itemStatus,
  type Item,
  type ItemMove,
  type ItemPatch,
  type ItemPatchOf,
  type ItemPerson,
  type BoardStatusTypes,
  type PlanBoardSetup,
  type StatusPhase,
} from '@livediagram/items';

const NO_PHASES: ReadonlyMap<string, StatusPhase> = new Map();
const NO_STATUS_TYPES: BoardStatusTypes = new Map();
import { stepTrail, type ItemOpenVia } from '@/components/plan/item-trail';
import type { PlanCardPresence, PlanContextValue } from '@/components/plan/PlanContext';
import { titleCaseType, track } from '@/lib/telemetry';
import type { PlanItems } from './usePlanItems';
import type { ItemCommentAction } from '@/lib/api/items';
import type { ItemTypesSlice } from './useItemTypes';
import { planBoardTarget } from './plan-board-targets';
import { useTypeForBoard } from './useTypeForBoard';
import type { StatusBoard } from './usePlanStatusNames';

const NO_STATUS_BOARDS: readonly StatusBoard[] = [];
const NO_TAB_ELEMENTS: readonly Element[] = [];
const NO_ELEMENTS = () => NO_TAB_ELEMENTS;
import { moveStatusRefusal } from './status-refusal';

// The editor's Plan slice (docs/specs/026-plan/blueprints/plan-board.md "Editor components"): the
// open item panel and board set-up, and the actions boards and cards take, composed into the value
// PlanContext hands every board. Items change through `planItems`; boards and cards are elements,
// changed through `commit` on the active tab.
// Deletes in flight at once while the Trash empties (the store holds at most ITEMS_MAX).
const EMPTY_TRASH_BATCH = 8;

export function usePlanSlice(opts: {
  planItems: PlanItems;
  // The document's item types (docs/specs/026-plan/item-types.md).
  itemTypes: ItemTypesSlice;
  editorMode: EditorMode;
  canEdit: boolean;
  // Participate access: anyone who may read may vote.
  canVote: boolean;
  // The members of the teams this person is part of, as items name people (useTeamPeople).
  teamPeople: readonly ItemPerson[];
  presence: ReadonlyMap<string, PlanCardPresence>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // Every tab's elements at once (a state deleted from every board). Absent, only the open tab's boards change.
  commitTabs?: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  select: (elementId: string | null) => void;
  announce: (message: string) => void;
  addItemSlide?: (itemId: string) => void;
  addBoardSlide?: (boardId: string) => void;
  statusNames: ReadonlyMap<string, string>;
  // The phase the tab's boards give each status (the plan views).
  statusPhases?: ReadonlyMap<string, StatusPhase>;
  // The card types the document's boards show under each status (the Cards panel's Not on a Board).
  statusTypes?: BoardStatusTypes;
  // Each board's title and statuses (the type editor's States groups).
  statusBoards?: readonly StatusBoard[];
  // Tells the room which card this person is dragging or reading (usePlanPresence).
  publishPresence?: (itemId: string | null, state: 'drag' | 'view') => void;
  // Shows a refusal on screen (a toast): a canvas Plan card dropped where it cannot go.
  notify?: (message: string) => void;
  // Fill Tab (usePlanFillTab): the open tab's live elements.
  readTabElements?: () => readonly Element[];
}) {
  const { planItems, itemTypes, editorMode, canEdit, canVote, presence } = opts;
  // The editor hands these over fresh each render; read through refs, so the callbacks built on them,
  // and the context value, keep their identity and boards re-render only when Plan state changes.
  const commitRef = useLatest(opts.commit);
  const commitTabsRef = useLatest(opts.commitTabs);
  const selectRef = useLatest(opts.select);
  const announceRef = useLatest(opts.announce);
  const publishRef = useLatest(opts.publishPresence);
  const slideRef = useLatest(opts.addItemSlide);
  const boardSlideRef = useLatest(opts.addBoardSlide);
  const commit = useCallback(
    (mapElements: (els: Element[]) => Element[]) => commitRef.current(mapElements),
    [commitRef],
  );
  const select = useCallback((id: string | null) => selectRef.current(id), [selectRef]);
  const announce = useCallback((message: string) => announceRef.current(message), [announceRef]);
  const publishPresence = useCallback(
    (itemId: string | null, state: 'drag' | 'view') => publishRef.current?.(itemId, state),
    [publishRef],
  );
  const hasSlides = !!opts.addItemSlide;
  const addItemSlide = useCallback((itemId: string) => slideRef.current?.(itemId), [slideRef]);
  const addBoardSlide = useCallback(
    (boardId: string) => boardSlideRef.current?.(boardId),
    [boardSlideRef],
  );
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // The card this person just made and opened (openNewItem): its panel selects its title so typing names it.
  const [freshItemId, setFreshItemId] = useState<string | null>(null);
  // The cards opened from inside the item panel, ending on the open one (docs/specs/026-plan/plan-board.md
  // "Breadcrumb"): a card opened any other way starts it afresh.
  const [itemTrail, setItemTrail] = useState<readonly string[]>([]);
  // The type the type editor is open on, or 'new' (docs/specs/026-plan/item-types.md "Editing a type").
  const [editingTypeId, setEditingTypeId] = useState<string | 'new' | null>(null);
  // A new type filled from this one (Duplicate), or none.
  const [typeTemplateId, setTypeTemplateId] = useState<string | null>(null);
  // Add New Card Type from a board's Add a Card menu: the board the new type is for (useTypeForBoard).
  const forBoard = useTypeForBoard(commit);
  const { setTypeForBoard } = forBoard;
  const editType = useCallback(
    (typeId: string | 'new', fromId?: string) => {
      setEditingTypeId(typeId);
      setTypeTemplateId(typeId === 'new' && fromId ? fromId : null);
      setTypeForBoard(null);
    },
    [setTypeForBoard],
  );
  // The board showing Setup Board again (docs/specs/026-plan/plan-board.md "Setup Board"), for this person only.
  const [setupBoardId, openBoardSetup] = useState<string | null>(null);
  const createTypeForBoard = useCallback(
    (boardId: string, statuses: readonly string[]) => {
      setEditingTypeId('new');
      setTypeTemplateId(null);
      setTypeForBoard({ boardId, statuses });
    },
    [setTypeForBoard],
  );

  const people = useMemo(() => {
    const byId = new Map<string, ItemPerson>();
    const self = planItems.self;
    if (self) byId.set(self.id, self);
    // Your teams' members only (docs/specs/026-plan/items.md "Who may do what"); a card's current assignee
    // who is not among them still shows in its own picker.
    for (const p of opts.teamPeople) if (!byId.has(p.id)) byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [planItems.self, opts.teamPeople]);

  const write = planItems.write;

  const addItem = useCallback(
    (input: {
      type: string;
      fields: Item['fields'];
      status: string;
      after: string | null;
      before?: string | null;
      id?: string;
    }) => {
      const made = write({
        kind: 'create',
        creates: [
          {
            ...(input.id ? { id: input.id } : {}),
            type: input.type,
            fields: input.fields,
            place: {
              status: input.status,
              ...(input.after ? { after: input.after } : {}),
              ...(input.before ? { before: input.before } : {}),
            },
          },
        ],
      });
      track('Plan', 'Added', titleCaseType(input.type));
      return made;
    },
    [write],
  );

  const moveItem = useCallback(
    (itemId: string, move: ItemMove) => {
      void write({ kind: 'move', id: itemId, move });
      track('Plan', 'Moved', 'Board');
    },
    [write],
  );

  const patchItem = useCallback(
    (itemId: string, patch: ItemPatch) => write({ kind: 'patch', id: itemId, patch }),
    [write],
  );

  const deleteItem = useCallback(
    (itemId: string) => {
      const type = planItems.items.get(itemId)?.type ?? 'item';
      void write({ kind: 'delete', id: itemId });
      setOpenItemId((open) => (open === itemId ? null : open));
      track('Plan', 'Deleted', titleCaseType(type));
    },
    [write, planItems.items],
  );

  // The Trash (docs/specs/026-plan/items.md "Trash"): a status no board shows, the old one kept to restore. Many
  // cards (a deleted type's, a removed column's) go as one write: one request per ITEM_BULK_MAX, one undo step.
  const trashItems = useCallback(
    (itemIds: readonly string[]) => {
      const patches: ItemPatchOf[] = [];
      for (const id of itemIds) {
        const item = planItems.items.get(id);
        if (!item || isTrashed(item)) continue;
        const from = itemStatus(item);
        patches.push({
          id,
          patch: { set: { status: TRASH_STATUS, ...(from ? { [TRASHED_FROM_FIELD]: from } : {}) } },
        });
      }
      if (patches.length === 0) return 0;
      void write(
        patches.length === 1
          ? { kind: 'patch', id: patches[0]!.id, patch: patches[0]!.patch }
          : { kind: 'patches', patches },
      );
      const gone = new Set(patches.map((p) => p.id));
      setOpenItemId((open) => (open && gone.has(open) ? null : open));
      track('Plan', 'Moved', 'Trash');
      return patches.length;
    },
    [write, planItems.items],
  );
  const trashItem = useCallback((itemId: string) => void trashItems([itemId]), [trashItems]);
  const restoreItem = useCallback(
    (itemId: string) => {
      const item = planItems.items.get(itemId);
      if (!item || !isTrashed(item)) return;
      const from = item.fields[TRASHED_FROM_FIELD];
      void write({
        kind: 'patch',
        id: itemId,
        patch:
          typeof from === 'string'
            ? { set: { status: from }, clear: [TRASHED_FROM_FIELD] }
            : { clear: ['status', TRASHED_FROM_FIELD] },
      });
      track('Plan', 'Restored', 'Card');
    },
    [write, planItems.items],
  );
  // Every trashed item deleted for good: a few requests at a time (never hundreds at once), one event.
  const emptyTrash = useCallback(() => {
    const ids = [...planItems.items.values()].filter(isTrashed).map((it) => it.id);
    if (ids.length === 0) return;
    setOpenItemId((open) => (open && ids.includes(open) ? null : open));
    track('Plan', 'Deleted', 'Trash');
    void (async () => {
      for (let i = 0; i < ids.length; i += EMPTY_TRASH_BATCH)
        await Promise.all(
          ids.slice(i, i + EMPTY_TRASH_BATCH).map((id) => write({ kind: 'delete', id })),
        );
    })();
  }, [planItems.items, write]);

  const commentFn = planItems.comment;
  const commentItem = useCallback(
    (itemId: string, action: ItemCommentAction) => void commentFn(itemId, action),
    [commentFn],
  );

  const fill = usePlanFillTab({
    readElements: opts.readTabElements ?? NO_ELEMENTS,
    commit,
  });

  const updateBoard = useCallback(
    (boardId: string, setup: PlanBoardSetup) => {
      commit((els) =>
        els.map((el) =>
          el.id === boardId && el.type === 'shape' && el.shape === 'plan-board'
            ? { ...el, planBoard: setup }
            : el,
        ),
      );
    },
    [commit],
  );

  // Delete Status (docs/specs/026-plan/plan-board.md "Column settings"): the state's columns come off every other
  // board in the document too, so no board keeps an empty column for a state that is gone.
  const removeStatusColumns = useCallback(
    (status: string, exceptBoardId: string) => {
      const drop = (els: Element[]) => {
        let changed = false;
        const next = els.map((el) => {
          if (el.id === exceptBoardId || el.type !== 'shape' || el.shape !== 'plan-board')
            return el;
          const setup = normaliseBoardSetup(el.planBoard);
          if (!setup || !setup.columns.some((c) => c.status === status)) return el;
          changed = true;
          return {
            ...el,
            planBoard: { ...setup, columns: setup.columns.filter((c) => c.status !== status) },
          };
        });
        return changed ? next : els;
      };
      const commitTabs = commitTabsRef.current;
      if (commitTabs)
        commitTabs((ts) =>
          ts.map((t) => {
            const elements = drop(t.elements);
            return elements === t.elements ? t : { ...t, elements };
          }),
        );
      else commitRef.current(drop);
    },
    [commitRef, commitTabsRef],
  );

  const updateView = useCallback(
    (viewId: string, settings: PlanViewRef) => {
      commit((els) =>
        els.map((el) =>
          el.id === viewId && el.type === 'shape' && el.shape === 'plan-view'
            ? { ...el, planView: settings }
            : el,
        ),
      );
    },
    [commit],
  );

  const placeCardOut = useCallback(
    (itemId: string, x: number, y: number) => {
      const card = createShape('plan-card', 0, 0);
      const placed = {
        ...card,
        x: x - card.width / 2,
        y: y - card.height / 2,
        planCard: { itemId },
      };
      commit((els) => [...els, placed]);
      select(placed.id);
      track('Plan', 'Added', 'Card');
    },
    [commit, select],
  );

  const removeCard = useCallback(
    (cardElementId: string) => commit((els) => els.filter((el) => el.id !== cardElementId)),
    [commit],
  );

  const updateCard = useCallback(
    (cardElementId: string, ref: PlanCardRef) =>
      commit((els) =>
        els.map((el) =>
          el.id === cardElementId && el.type === 'shape' && el.shape === 'plan-card'
            ? { ...el, planCard: ref }
            : el,
        ),
      ),
    [commit],
  );

  const openItem = useCallback((itemId: string, via?: ItemOpenVia) => {
    setOpenItemId(itemId);
    setFreshItemId(null);
    setItemTrail((trail) => (via ? stepTrail(trail, itemId) : [itemId]));
    track('Plan', 'Opened', via ?? 'Item');
  }, []);

  // A card this person just made (Add Card, a palette card placed in a column, New {Type} on a card): opened at
  // once, its title selected to be named (docs/specs/026-plan/plan-board.md "Open an item"). Never for a card
  // made by someone else, an undo or redo, a duplicate, a template or an agent: only these callers open one.
  const openNewItem = useCallback(
    (itemId: string, via?: ItemOpenVia) => {
      openItem(itemId, via);
      setFreshItemId(itemId);
    },
    [openItem],
  );

  // A Plan card dropped on a board: its item moves into the column under the drop, and the card,
  // now on the board, leaves the canvas (docs/specs/026-plan/plan-board.md "Working on a board"). Checked first:
  // a board that does not show the card's type, or a status its type leaves out
  // (docs/specs/026-plan/item-types.md "An item type"), moves nothing; the refusal is shown and 'refused' is
  // answered, so the drag puts the canvas card back where it started. The canvas card goes only once the move
  // has landed.
  const statusNamesRef = useLatest(opts.statusNames);
  const notifyRef = useLatest(opts.notify);
  const dropPlanCardOnBoard = useCallback(
    (card: Element, status: string, boardId?: string): 'refused' | undefined => {
      const itemId = card.type === 'shape' ? card.planCard?.itemId : undefined;
      const item = itemId ? planItems.items.get(itemId) : undefined;
      if (!itemId || !item) return undefined;
      const target = boardId ? planBoardTarget(boardId) : undefined;
      const refused =
        target && !target.accepts(itemId)
          ? target.refusal()
          : moveStatusRefusal(
              itemTypes.types,
              item,
              { status },
              (s) => statusNamesRef.current.get(s) ?? s,
            );
      if (refused) {
        announce(refused);
        notifyRef.current?.(refused);
        return 'refused';
      }
      track('Plan', 'Moved', 'Board');
      void write({ kind: 'move', id: itemId, move: { status, before: null } }).then((ok) => {
        if (!ok) return;
        removeCard(card.id);
        announce('Card filed on the board');
      });
      return undefined;
    },
    [planItems.items, itemTypes.types, write, removeCard, announce, statusNamesRef, notifyRef],
  );

  // Dragging outranks reading; letting go goes back to the open item, if any.
  // The card being dragged here, so the Trash can make itself a target.
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const setDragging = useCallback(
    (itemId: string | null) => {
      setDraggingItemId(itemId);
      if (itemId) publishPresence?.(itemId, 'drag');
      else publishPresence?.(openItemId, 'view');
    },
    [publishPresence, openItemId],
  );
  useEffect(() => {
    publishPresence?.(openItemId, 'view');
  }, [openItemId, publishPresence]);

  const context = useMemo<PlanContextValue>(
    () => ({
      items: planItems.items,
      types: itemTypes.types,
      itemTypes,
      editType,
      createTypeForBoard,
      setupBoardId,
      openBoardSetup,
      status: planItems.status,
      self: planItems.self,
      people,
      planInput: hasPlanInput(editorMode),
      canEdit,
      canVote,
      presence,
      retry: planItems.refetch,
      openItem,
      openNewItem,
      openItemId,
      addItem,
      moveItem,
      patchItem,
      deleteItem,
      commentItem,
      ownerId: planItems.ownerId,
      updateBoard,
      removeStatusColumns,
      updateView,
      placeCardOut,
      removeCard,
      updateCard,
      announce,
      setDragging,
      draggingItemId,
      trashItem,
      trashItems,
      restoreItem,
      emptyTrash,
      statusNames: opts.statusNames,
      statusPhases: opts.statusPhases ?? NO_PHASES,
      statusTypes: opts.statusTypes ?? NO_STATUS_TYPES,
      statusBoards: opts.statusBoards ?? NO_STATUS_BOARDS,
      ...fill,
      ...(hasSlides ? { addItemSlide, addBoardSlide } : {}),
    }),
    [
      planItems.items,
      itemTypes,
      editType,
      createTypeForBoard,
      setupBoardId,
      planItems.status,
      planItems.self,
      planItems.refetch,
      people,
      editorMode,
      canEdit,
      canVote,
      presence,
      openItem,
      openNewItem,
      openItemId,
      addItem,
      moveItem,
      patchItem,
      deleteItem,
      commentItem,
      planItems.ownerId,
      updateBoard,
      removeStatusColumns,
      updateView,
      placeCardOut,
      removeCard,
      updateCard,
      announce,
      setDragging,
      draggingItemId,
      trashItem,
      trashItems,
      restoreItem,
      emptyTrash,
      addItemSlide,
      addBoardSlide,
      hasSlides,
      opts.statusNames,
      opts.statusPhases,
      opts.statusTypes,
      opts.statusBoards,
      fill,
    ],
  );

  return {
    context,
    openItemId,
    freshItemId,
    itemTrail,
    closeItem: () => {
      setOpenItemId(null);
      setFreshItemId(null);
    },
    // Opens an item without counting it as the person's (the Plan tour's card panel step).
    showItem: setOpenItemId,
    editingTypeId,
    typeTemplateId,
    typeForBoard: forBoard.typeForBoard,
    addTypeToBoard: forBoard.addTypeToBoard,
    closeTypeEditor: () => {
      setEditingTypeId(null);
      setTypeTemplateId(null);
      setTypeForBoard(null);
    },
    dropPlanCardOnBoard,
  };
}

export type PlanSlice = ReturnType<typeof usePlanSlice>;
