'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { Element, Tab } from '@liveplanner/project';
import type {
  FieldRetypeTarget,
  ItemPerson,
  BoardStatusTypes,
  StatusPhase,
} from '@liveplanner/items';

const NO_PHASES: ReadonlyMap<string, StatusPhase> = new Map();
const NO_STATUS_TYPES: BoardStatusTypes = new Map();
import { stepTrail, type ItemOpenVia } from '@/components/plan/item-trail';
import type {
  ItemTypeEditing,
  PlanCardPresence,
  PlanContextValue,
} from '@/components/plan/PlanContext';
import { track } from '@/lib/telemetry';
import type { PlanItems } from './usePlanItems';
import type { ItemTypesSlice } from './useItemTypes';
import { planBoardTarget } from './plan-board-targets';
import { countFieldFilters, tabsWithoutFieldFilters } from '@/components/plan/field-retype-tabs';
import { useTypeForBoard } from './useTypeForBoard';
import { usePlanPeople } from './usePlanPeople';
import type { StatusBoard } from './usePlanStatusNames';

const NO_STATUS_BOARDS: readonly StatusBoard[] = [];
import { moveStatusRefusal } from './status-refusal';
import { usePlanItemWrites } from './usePlanItemWrites';
import { usePlanElementWrites } from './usePlanElementWrites';

// The editor's Plan slice (docs/specs/026-plan/blueprints/plan-board.md "Editor components"): the
// open item panel and board set-up, and the actions boards and cards take, composed into the value
// PlanContext hands every board. Items change through `planItems`; boards and cards are elements,
// changed through `commit` on the active tab.
const NO_TABS: readonly Tab[] = [];

export function usePlanSlice(opts: {
  planItems: PlanItems;
  // The project's item types (docs/specs/026-plan/item-types.md).
  itemTypes: ItemTypesSlice;
  canEdit: boolean;
  // Cards, not structure (docs/specs/013-workspace/share-roles.md): an Editor's and a Participant's.
  canEditCards?: boolean;
  // Participate access: anyone who may read may vote.
  canVote: boolean;
  // The members of the teams this person is part of, as items name people (useTeamPeople).
  teamPeople: readonly ItemPerson[];
  presence: ReadonlyMap<string, PlanCardPresence>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // Every tab's elements at once (a state deleted from every board). Absent, only the open tab's boards change.
  commitTabs?: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  // The tabs as they are now, read when called (Edit Field's filter count and scan); stable or not, read by ref.
  readTabs?: () => readonly Tab[];
  select: (elementId: string | null) => void;
  announce: (message: string) => void;
  statusNames: ReadonlyMap<string, string>;
  // The phase the tab's boards give each status (the plan views).
  statusPhases?: ReadonlyMap<string, StatusPhase>;
  // The card types the project's boards show under each status (the Cards panel's Not on a Board).
  statusTypes?: BoardStatusTypes;
  // Each board's title and statuses (the type editor's States groups).
  statusBoards?: readonly StatusBoard[];
  // Tells the room which card this person is dragging or reading (usePlanPresence).
  publishPresence?: (itemId: string | null, state: 'drag' | 'view') => void;
  // Shows a refusal on screen (a toast): a canvas Plan card dropped where it cannot go.
  notify?: (message: string) => void;
  // New Form on a board's cog (useFormActions); stable.
  newFormFor?: (boardElementId: string) => void;
  // The Actions board's links (useLinkedActionCards); stable callbacks, placeOf changes with the tabs.
  linkedActions?: PlanContextValue['linkedActions'];
  // A card's address for Copy Card Link; read when pressed, so it may change every render.
  cardLink?: (itemId: string) => string;
}) {
  const { planItems, itemTypes, canEdit, canVote, presence } = opts;
  const canEditCards = opts.canEditCards ?? canEdit;
  // The editor hands these over fresh each render; read through refs, so the callbacks built on them,
  // and the context value, keep their identity and boards re-render only when Plan state changes.
  const commitRef = useLatest(opts.commit);
  const commitTabsRef = useLatest(opts.commitTabs);
  const readTabsRef = useLatest(opts.readTabs);
  const selectRef = useLatest(opts.select);
  const announceRef = useLatest(opts.announce);
  const publishRef = useLatest(opts.publishPresence);
  const cardLinkRef = useLatest(opts.cardLink);
  const hasCardLink = opts.cardLink !== undefined;
  const cardLink = useCallback(
    (itemId: string) => cardLinkRef.current?.(itemId) ?? '',
    [cardLinkRef],
  );
  const commit = useCallback(
    (mapElements: (els: Element[]) => Element[]) => commitRef.current(mapElements),
    [commitRef],
  );
  // A change to one element on whichever tab holds it: a board shown in a Dashboard's slot lives on its own Board tab
  // (docs/specs/026-plan/plan-tabs.md), so its set-up is changed there; on the open tab as ever otherwise.
  // `retab` may change the tab itself in the same step (a Board tab's name following its board's title).
  const commitOn = useCallback(
    (elementId: string, mapElements: (els: Element[]) => Element[], retab?: (tab: Tab) => Tab) => {
      const commitTabs = commitTabsRef.current;
      if (!commitTabs) return commitRef.current(mapElements);
      commitTabs((ts) => {
        const at = ts.findIndex((t) => t.elements.some((el) => el.id === elementId));
        if (at < 0) return ts;
        const next = mapElements(ts[at]!.elements);
        if (next === ts[at]!.elements) return ts;
        return ts.map((t, i) => {
          if (i !== at) return t;
          const changed = { ...t, elements: next };
          return retab ? retab(changed) : changed;
        });
      });
    },
    [commitRef, commitTabsRef],
  );
  const select = useCallback((id: string | null) => selectRef.current(id), [selectRef]);
  const announce = useCallback((message: string) => announceRef.current(message), [announceRef]);
  const publishPresence = useCallback(
    (itemId: string | null, state: 'drag' | 'view') => publishRef.current?.(itemId, state),
    [publishRef],
  );
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // The card this person just made and opened (openNewItem): its panel selects its title so typing names it.
  const [freshItemId, setFreshItemId] = useState<string | null>(null);
  // The cards opened from inside the item panel, ending on the open one (docs/specs/026-plan/plan-board.md
  // "Breadcrumb"): a card opened any other way starts it afresh.
  const [itemTrail, setItemTrail] = useState<readonly string[]>([]);
  // What the type editor is open on (docs/specs/026-plan/item-types.md "Editing a type"), or null.
  const [editingType, setEditingType] = useState<ItemTypeEditing | null>(null);
  // A new type filled from this one (Duplicate), or none.
  const [typeTemplateId, setTypeTemplateId] = useState<string | null>(null);
  // Add Card Type from a board's Add a Card menu: the board the new type is for (useTypeForBoard).
  const forBoard = useTypeForBoard(commitOn);
  const { setTypeForBoard } = forBoard;
  const editType = useCallback(
    (target: ItemTypeEditing, fromId?: string) => {
      setEditingType(target);
      setTypeTemplateId(target === 'new' && fromId ? fromId : null);
      setTypeForBoard(null);
    },
    [setTypeForBoard],
  );
  const createTypeForBoard = useCallback(
    (boardId: string, statuses: readonly string[]) => {
      setEditingType('new');
      setTypeTemplateId(null);
      setTypeForBoard({ boardId, statuses });
    },
    [setTypeForBoard],
  );

  // You, your teams' members and the plan's custom assignees (usePlanPeople); a card's current assignee who is
  // not among them still shows in its own picker.
  const people = usePlanPeople(planItems.self, opts.teamPeople, planItems.items);

  const write = planItems.write;
  const writeQuiet = planItems.writeQuiet;
  const {
    addItem,
    addItems,
    moveItem,
    moveItems,
    patchItem,
    trackTime,
    deleteItem,
    trashItems,
    patchItems,
    reshapeValues,
    trashItem,
    restoreItem,
    emptyTrash,
    requiredGate,
  } = usePlanItemWrites(planItems, itemTypes, setOpenItemId);
  // The tabs read when called, and a field's filters taken off them as one canvas commit (docs/specs/026-plan/
  // item-types.md "Edit Field": Filters on the field). Answers whether any came off: only then is a step made.
  const planTabs = useCallback(() => readTabsRef.current?.() ?? NO_TABS, [readTabsRef]);
  const removeFieldFilters = useCallback(
    (targets: readonly FieldRetypeTarget[]) => {
      const commitTabs = commitTabsRef.current;
      if (!commitTabs || countFieldFilters(planTabs(), targets) === 0) return false;
      commitTabs((ts) => tabsWithoutFieldFilters(ts, targets));
      return true;
    },
    [commitTabsRef, planTabs],
  );

  const { updateBoard, removeStatusColumns, updateView, placeCardOut, removeCard, updateCard } =
    usePlanElementWrites({
      commit,
      commitOn,
      commitRef,
      commitTabsRef,
      select,
    });

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
  const notify = useCallback((message: string) => notifyRef.current?.(message), [notifyRef]);
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
      practiceIds: planItems.practiceIds,
      types: itemTypes.types,
      itemTypes,
      editType,
      createTypeForBoard,
      ...(opts.newFormFor && canEdit ? { newFormFor: opts.newFormFor } : {}),
      ...(opts.linkedActions ? { linkedActions: opts.linkedActions } : {}),
      status: planItems.status,
      self: planItems.self,
      people,
      canEdit,
      canEditCards,
      canVote,
      presence,
      retry: planItems.refetch,
      openItem,
      openNewItem,
      openItemId,
      ...(hasCardLink ? { cardLink } : {}),
      addItem,
      addItems,
      moveItem,
      moveItems,
      patchItem,
      trackTime,
      deleteItem,
      notify,
      ownerId: planItems.ownerId,
      itemsScope: planItems.scope ?? null,
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
      patchItems,
      reshapeValues,
      planTabs,
      removeFieldFilters,
      restoreItem,
      emptyTrash,
      statusNames: opts.statusNames,
      statusPhases: opts.statusPhases ?? NO_PHASES,
      statusTypes: opts.statusTypes ?? NO_STATUS_TYPES,
      statusBoards: opts.statusBoards ?? NO_STATUS_BOARDS,
    }),
    [
      planItems.items,
      planItems.practiceIds,
      itemTypes,
      editType,
      createTypeForBoard,
      planItems.status,
      planItems.self,
      planItems.refetch,
      people,
      canEdit,
      canEditCards,
      canVote,
      presence,
      openItem,
      openNewItem,
      openItemId,
      hasCardLink,
      cardLink,
      addItem,
      addItems,
      moveItem,
      moveItems,
      patchItem,
      trackTime,
      deleteItem,
      notify,
      planItems.ownerId,
      planItems.scope,
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
      patchItems,
      reshapeValues,
      planTabs,
      removeFieldFilters,
      restoreItem,
      emptyTrash,
      opts.statusNames,
      opts.statusPhases,
      opts.statusTypes,
      opts.statusBoards,
      opts.newFormFor,
      opts.linkedActions,
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
    // A write with no undo step, for content the editor makes and takes away itself.
    writeQuiet,
    // The Boards tour's practice cards (docs/specs/026-plan/plan-tour.md "Practice cards").
    practiceIds: planItems.practiceIds,
    practise: planItems.practise,
    endPractice: planItems.endPractice,
    capturePractice: planItems.capturePractice,
    editingType,
    // A new card waiting for its required fields (RequiredFieldsDialog), and its answer.
    requiredFields: requiredGate.request,
    settleRequiredFields: requiredGate.settle,
    typeTemplateId,
    typeForBoard: forBoard.typeForBoard,
    addTypeToBoard: forBoard.addTypeToBoard,
    closeTypeEditor: () => {
      setEditingType(null);
      setTypeTemplateId(null);
      setTypeForBoard(null);
    },
    dropPlanCardOnBoard,
  };
}

export type PlanSlice = ReturnType<typeof usePlanSlice>;
