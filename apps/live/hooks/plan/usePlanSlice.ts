'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { createShape, hasPlanInput, type EditorMode, type Element } from '@livediagram/document';
import {
  TRASHED_FROM_FIELD,
  TRASH_STATUS,
  isTrashed,
  itemStatus,
  type Item,
  type ItemMove,
  type ItemPatch,
  type ItemPerson,
  type PlanBoardSetup,
  type StatusPhase,
} from '@livediagram/items';

const NO_PHASES: ReadonlyMap<string, StatusPhase> = new Map();
import type { PlanCardPresence, PlanContextValue } from '@/components/plan/PlanContext';
import { titleCaseType, track } from '@/lib/telemetry';
import type { PlanItems } from './usePlanItems';
import type { ItemTypesSlice } from './useItemTypes';

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
  select: (elementId: string | null) => void;
  announce: (message: string) => void;
  addItemSlide?: (itemId: string) => void;
  statusNames: ReadonlyMap<string, string>;
  // The phase the tab's boards give each status (the plan views).
  statusPhases?: ReadonlyMap<string, StatusPhase>;
  // Tells the room which card this person is dragging or reading (usePlanPresence).
  publishPresence?: (itemId: string | null, state: 'drag' | 'view') => void;
}) {
  const { planItems, itemTypes, editorMode, canEdit, canVote, presence } = opts;
  // The editor hands these over fresh each render; read through refs, so the callbacks built on them,
  // and the context value, keep their identity and boards re-render only when Plan state changes.
  const commitRef = useLatest(opts.commit);
  const selectRef = useLatest(opts.select);
  const announceRef = useLatest(opts.announce);
  const publishRef = useLatest(opts.publishPresence);
  const slideRef = useLatest(opts.addItemSlide);
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
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // The type the type editor is open on, or 'new' (docs/specs/026-plan/item-types.md "Editing a type").
  const [editingTypeId, setEditingTypeId] = useState<string | 'new' | null>(null);
  const editType = useCallback((typeId: string | 'new') => setEditingTypeId(typeId), []);

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
      void write({
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
    (itemId: string, patch: ItemPatch) => void write({ kind: 'patch', id: itemId, patch }),
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

  // The Trash (docs/specs/026-plan/items.md "Trash"): a status no board shows, the old one kept to restore.
  const trashItem = useCallback(
    (itemId: string) => {
      const item = planItems.items.get(itemId);
      if (!item || isTrashed(item)) return;
      const from = itemStatus(item);
      void write({
        kind: 'patch',
        id: itemId,
        patch: {
          set: { status: TRASH_STATUS, ...(from ? { [TRASHED_FROM_FIELD]: from } : {}) },
        },
      });
      setOpenItemId((open) => (open === itemId ? null : open));
      track('Plan', 'Moved', 'Trash');
    },
    [write, planItems.items],
  );
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

  const vote = useCallback(
    (itemId: string, delta: 1 | -1) => {
      void write({ kind: 'vote', id: itemId, delta });
      track('Plan', 'Voted', delta === 1 ? 'Up' : 'Down');
    },
    [write],
  );

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

  const openItem = useCallback((itemId: string) => {
    setOpenItemId(itemId);
    track('Plan', 'Opened', 'Item');
  }, []);

  // A Plan card dropped on a board: its item moves into the column under the drop, and the card,
  // now on the board, leaves the canvas (docs/specs/026-plan/plan-board.md "Working on a board").
  const dropPlanCardOnBoard = useCallback(
    (card: Element, status: string) => {
      const itemId = card.type === 'shape' ? card.planCard?.itemId : undefined;
      if (!itemId || !planItems.items.has(itemId)) return;
      moveItem(itemId, { status, before: null });
      removeCard(card.id);
      announce('Card filed on the board');
    },
    [planItems.items, moveItem, removeCard, announce],
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
      status: planItems.status,
      self: planItems.self,
      people,
      planInput: hasPlanInput(editorMode),
      canEdit,
      canVote,
      presence,
      retry: planItems.refetch,
      openItem,
      openItemId,
      addItem,
      moveItem,
      patchItem,
      deleteItem,
      vote,
      updateBoard,
      placeCardOut,
      removeCard,
      announce,
      setDragging,
      draggingItemId,
      trashItem,
      restoreItem,
      emptyTrash,
      statusNames: opts.statusNames,
      statusPhases: opts.statusPhases ?? NO_PHASES,
      ...(hasSlides ? { addItemSlide } : {}),
    }),
    [
      planItems.items,
      itemTypes,
      editType,
      planItems.status,
      planItems.self,
      planItems.refetch,
      people,
      editorMode,
      canEdit,
      canVote,
      presence,
      openItem,
      openItemId,
      addItem,
      moveItem,
      patchItem,
      deleteItem,
      vote,
      updateBoard,
      placeCardOut,
      removeCard,
      announce,
      setDragging,
      draggingItemId,
      trashItem,
      restoreItem,
      emptyTrash,
      addItemSlide,
      hasSlides,
      opts.statusNames,
      opts.statusPhases,
    ],
  );

  return {
    context,
    openItemId,
    closeItem: () => setOpenItemId(null),
    editingTypeId,
    closeTypeEditor: () => setEditingTypeId(null),
    dropPlanCardOnBoard,
  };
}

export type PlanSlice = ReturnType<typeof usePlanSlice>;
