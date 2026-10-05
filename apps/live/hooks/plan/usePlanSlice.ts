'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createShape, hasPlanInput, type EditorMode, type Element } from '@livediagram/document';
import {
  itemAssignee,
  itemPersonId,
  type Item,
  type ItemMove,
  type ItemPatch,
  type ItemPerson,
  type PlanBoardSetup,
} from '@livediagram/items';
import type { PlanCardPresence, PlanContextValue } from '@/components/plan/PlanContext';
import { titleCaseType, track } from '@/lib/telemetry';
import type { PlanItems } from './usePlanItems';
import type { ItemTypesSlice } from './useItemTypes';

type Participant = { id: string; name: string; color: string };

// The editor's Plan slice (docs/specs/025-plan/blueprints/plan-board.md "Editor components"): the
// open item panel and board set-up, and the actions boards and cards take, composed into the value
// PlanContext hands every board. Items change through `planItems`; boards and cards are elements,
// changed through `commit` on the active tab.
export function usePlanSlice(opts: {
  planItems: PlanItems;
  // The document's item types (docs/specs/025-plan/item-types.md).
  itemTypes: ItemTypesSlice;
  editorMode: EditorMode;
  canEdit: boolean;
  // Participate access: anyone who may read may vote.
  canVote: boolean;
  participants: readonly Participant[];
  presence: ReadonlyMap<string, PlanCardPresence>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  select: (elementId: string | null) => void;
  announce: (message: string) => void;
  // Tells the room which card this person is dragging or reading (usePlanPresence).
  publishPresence?: (itemId: string | null, state: 'drag' | 'view') => void;
}) {
  const { planItems, itemTypes, editorMode, canEdit, canVote, participants, presence } = opts;
  const { commit, select } = opts;
  const { announce, publishPresence } = opts;
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // The type the type editor is open on, or 'new' (docs/specs/025-plan/item-types.md "Editing a type").
  const [editingTypeId, setEditingTypeId] = useState<string | 'new' | null>(null);
  const editType = useCallback((typeId: string | 'new') => setEditingTypeId(typeId), []);

  // The room's people as items name them (hashed ids, docs/specs/025-plan/blueprints/item-store.md
  // "Security and trust"), so an assignee picked here is the same person the api signs writes as.
  const [roomPeople, setRoomPeople] = useState<ItemPerson[]>([]);
  const roster = participants.map((p) => `${p.id}|${p.name}|${p.color}`).join(',');
  useEffect(() => {
    let live = true;
    void Promise.all(
      participants.map(async (p) => ({
        id: await itemPersonId(p.id),
        name: p.name,
        color: p.color,
      })),
    ).then((people) => live && setRoomPeople(people));
    return () => {
      live = false;
    };
    // The roster string is the dependency: a new array with the same people changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  const people = useMemo(() => {
    const byId = new Map<string, ItemPerson>();
    const self = planItems.self;
    if (self) byId.set(self.id, self);
    for (const p of roomPeople) byId.set(p.id, p);
    for (const item of planItems.items.values()) {
      const a = itemAssignee(item);
      if (a && !byId.has(a.id)) byId.set(a.id, a);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [planItems.self, planItems.items, roomPeople]);

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
  // now on the board, leaves the canvas (docs/specs/025-plan/plan-board.md "Working on a board").
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
  const setDragging = useCallback(
    (itemId: string | null) =>
      itemId ? publishPresence?.(itemId, 'drag') : publishPresence?.(openItemId, 'view'),
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
