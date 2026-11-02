'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  createShape,
  type Element,
  type Tab,
  type PlanCardRef,
  type PlanViewRef,
} from '@liveplanner/project';
import {
  normaliseBoardSetup,
  TRASHED_FROM_FIELD,
  TRASH_STATUS,
  isTrashed,
  itemStatus,
  type Item,
  type ItemCreate,
  type ItemMove,
  type ItemPatch,
  type ItemPatchOf,
  type ItemMoveOf,
  type ItemPerson,
  type BoardStatusTypes,
  settleDoneColumns,
  type PlanBoardSetup,
  type StatusPhase,
  type TimeOp,
} from '@liveplanner/items';

const NO_PHASES: ReadonlyMap<string, StatusPhase> = new Map();
const NO_STATUS_TYPES: BoardStatusTypes = new Map();
import { stepTrail, type ItemOpenVia } from '@/components/plan/item-trail';
import type {
  ItemTypeEditing,
  PlanCardPresence,
  PlanContextValue,
} from '@/components/plan/PlanContext';
import { titleCaseType, track } from '@/lib/telemetry';
import type { PlanItems } from './usePlanItems';
import type { ItemTypesSlice } from './useItemTypes';
import { planBoardTarget } from './plan-board-targets';
import { useTypeForBoard } from './useTypeForBoard';
import { usePlanPeople } from './usePlanPeople';
import { useRequiredFieldsGate } from './useRequiredFieldsGate';
import { tabNamedForBoard, tabNamedForView } from '@/lib/tab-named-plan';
import type { StatusBoard } from './usePlanStatusNames';

const NO_STATUS_BOARDS: readonly StatusBoard[] = [];
import { moveStatusRefusal } from './status-refusal';

// The editor's Plan slice (docs/specs/026-plan/blueprints/plan-board.md "Editor components"): the
// open item panel and board set-up, and the actions boards and cards take, composed into the value
// PlanContext hands every board. Items change through `planItems`; boards and cards are elements,
// changed through `commit` on the active tab.
// Deletes in flight at once while the Trash empties (the store holds at most ITEMS_MAX).
const EMPTY_TRASH_BATCH = 8;

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
  // Add New Card Type from a board's Add a Card menu: the board the new type is for (useTypeForBoard).
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
  // A Gantt chart's Add New Card Type: a new type with Start and Due, so it draws on the chart once saved.
  const createTypeForView = useCallback(
    (viewId: string) => {
      setEditingType('new');
      setTypeTemplateId(null);
      setTypeForBoard({ viewId, fields: ['start', 'due'] });
    },
    [setTypeForBoard],
  );

  // You, your teams' members and the plan's custom assignees (usePlanPeople); a card's current assignee who is
  // not among them still shows in its own picker.
  const people = usePlanPeople(planItems.self, opts.teamPeople, planItems.items);

  const write = planItems.write;

  // A card whose type requires a field it lacks waits for the New {Type} dialog (docs/specs/026-plan/item-types.md
  // "Required fields"); any other is written at once, as before.
  const requiredGate = useRequiredFieldsGate(itemTypes.types);
  const fillRequired = requiredGate.fill;
  const addItem = useCallback(
    (input: {
      type: string;
      fields: Item['fields'];
      status: string;
      after: string | null;
      before?: string | null;
      id?: string;
    }): Promise<boolean> => {
      const made = (fields: Item['fields']) => {
        const done = write({
          kind: 'create',
          creates: [
            {
              ...(input.id ? { id: input.id } : {}),
              type: input.type,
              fields,
              place: {
                status: input.status,
                ...(input.after ? { after: input.after } : {}),
                ...(input.before ? { before: input.before } : {}),
              },
            },
          ],
        });
        track('Plan', 'Added', titleCaseType(input.type));
        return done;
      };
      const fields = fillRequired(input.type, input.fields);
      return fields instanceof Promise
        ? fields.then((filled) => (filled ? made(filled) : false))
        : made(fields);
    },
    [write, fillRequired],
  );

  // Many new cards as one write and one undo step (a board's Import CSV, docs/specs/026-plan/plan-board.md "CSV").
  const addItems = useCallback(
    (creates: readonly ItemCreate[]) =>
      creates.length ? write({ kind: 'create', creates: [...creates] }) : Promise.resolve(true),
    [write],
  );

  const moveItem = useCallback(
    (itemId: string, move: ItemMove) => {
      void write({ kind: 'move', id: itemId, move });
      track('Plan', 'Moved', 'Board');
    },
    [write],
  );

  // Many cards moved together (a group's drag, a selection's Move To): one write and one undo step, a single move for
  // one card.
  const moveItems = useCallback(
    (moves: readonly ItemMoveOf[]) => {
      if (moves.length === 0) return;
      void write(
        moves.length === 1
          ? { kind: 'move', id: moves[0]!.id, move: moves[0]!.move }
          : { kind: 'moves', moves: [...moves] },
      );
    },
    [write],
  );

  const patchItem = useCallback(
    (itemId: string, patch: ItemPatch) => write({ kind: 'patch', id: itemId, patch }),
    [write],
  );

  // A time write to a card's Time Spent field (docs/specs/026-plan/item-types.md "Time Spent"): an undo step only for
  // Add Time and an entry's removal (inverseItemWrites decides).
  const trackTime = useCallback(
    (itemId: string, field: string, op: TimeOp) => {
      if (op.op === 'start') track('Plan', 'Started', 'Timer');
      else if (op.op === 'stop') track('Plan', 'Ended', 'Timer');
      else if (op.op === 'add') track('Plan', 'Added', 'TimeEntry');
      return write({ kind: 'time', id: itemId, field, op });
    },
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
  // Many cards changed as one write and one undo step (Keep Them on a template's example cards).
  const patchItems = useCallback(
    (patches: readonly ItemPatchOf[]) => {
      if (patches.length === 0) return;
      void write(
        patches.length === 1
          ? { kind: 'patch', id: patches[0]!.id, patch: patches[0]!.patch }
          : { kind: 'patches', patches: [...patches] },
      );
    },
    [write],
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
  // Quiet: emptying the Trash cannot be undone (docs/specs/026-plan/items.md), and one undo step per card
  // would crowd the shared history.
  const writeQuiet = planItems.writeQuiet;
  const emptyTrash = useCallback(() => {
    const ids = [...planItems.items.values()].filter(isTrashed).map((it) => it.id);
    if (ids.length === 0) return;
    setOpenItemId((open) => (open && ids.includes(open) ? null : open));
    track('Plan', 'Deleted', 'Trash');
    void (async () => {
      for (let i = 0; i < ids.length; i += EMPTY_TRASH_BATCH)
        await Promise.all(
          ids.slice(i, i + EMPTY_TRASH_BATCH).map((id) => writeQuiet({ kind: 'delete', id })),
        );
    })();
  }, [planItems.items, writeQuiet]);

  const updateBoard = useCallback(
    (boardId: string, setup: PlanBoardSetup) => {
      // The board's title before this change: only a change of title renames the tab, so any other setting (a column,
      // a card type) never takes a tab that has drifted from its board, such as a Duplicate's copy, back.
      let before: string | undefined;
      commitOn(
        boardId,
        (els) =>
          els.map((el) => {
            if (el.id !== boardId || el.type !== 'shape' || el.shape !== 'plan-board') return el;
            before = el.planBoard?.title;
            // Each column flagged as it counts (docs/specs/026-plan/plan-board.md "Done columns"): a column it had
            // counts as it did, a new one by its name.
            return { ...el, planBoard: settleDoneColumns(el.planBoard, setup) };
          }),
        // A Board tab and its board share one name (docs/specs/026-plan/plan-tabs.md "Names"): renamed, the tab follows.
        (tab) => (before === setup.title ? tab : tabNamedForBoard(tab, setup.title)),
      );
    },
    [commitOn],
  );

  // Delete Status (docs/specs/026-plan/plan-board.md "Column settings"): the state's columns come off every other
  // board in the project too, so no board keeps an empty column for a state that is gone.
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
            planBoard: settleDoneColumns(setup, {
              ...setup,
              columns: setup.columns.filter((c) => c.status !== status),
            }),
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
      // The chart's title before this change: only a new title renames the tab (as updateBoard).
      let before: string | undefined;
      commitOn(
        viewId,
        (els) =>
          els.map((el) => {
            if (el.id !== viewId || el.type !== 'shape' || el.shape !== 'plan-view') return el;
            before = el.planView?.title;
            return { ...el, planView: settings };
          }),
        // A Visualisation tab and its chart share one name (plan-tabs.md "Names"): titled, the tab follows.
        (tab) => (before === settings.title ? tab : tabNamedForView(tab, viewId, settings.title)),
      );
    },
    [commitOn],
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
      types: itemTypes.types,
      itemTypes,
      editType,
      createTypeForBoard,
      createTypeForView,
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
      restoreItem,
      emptyTrash,
      statusNames: opts.statusNames,
      statusPhases: opts.statusPhases ?? NO_PHASES,
      statusTypes: opts.statusTypes ?? NO_STATUS_TYPES,
      statusBoards: opts.statusBoards ?? NO_STATUS_BOARDS,
    }),
    [
      planItems.items,
      itemTypes,
      editType,
      createTypeForBoard,
      createTypeForView,
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
    // A write with no undo step, for the card the Plan tour makes and takes away itself.
    writeQuiet,
    editingType,
    // A new card waiting for its required fields (RequiredFieldsDialog), and its answer.
    requiredFields: requiredGate.request,
    settleRequiredFields: requiredGate.settle,
    typeTemplateId,
    typeForBoard: forBoard.typeForBoard,
    addTypeToBoard: forBoard.addTypeToBoard,
    addTypeToView: forBoard.addTypeToView,
    closeTypeEditor: () => {
      setEditingType(null);
      setTypeTemplateId(null);
      setTypeForBoard(null);
    },
    dropPlanCardOnBoard,
  };
}

export type PlanSlice = ReturnType<typeof usePlanSlice>;
