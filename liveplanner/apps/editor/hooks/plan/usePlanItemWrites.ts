'use client';

// The Plan slice's card writes (usePlanSlice.ts): add, move, change, time, delete, Trash and restore, each one write
// and one undo step through `planItems`, and the New {Type} gate for a type's required fields. Split from the slice,
// which composes them into PlanContext; an open card that goes is closed through `setOpenItemId`.
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  TRASHED_FROM_FIELD,
  TRASH_STATUS,
  isTrashed,
  itemStatus,
  withTypeChangeFields,
  type Item,
  type ItemCreate,
  type ItemMove,
  type ItemPatch,
  type ItemPatchOf,
  type ItemMoveOf,
  type TimeOp,
} from '@liveplanner/items';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { titleCaseType, track } from '@/lib/telemetry';
import type { PlanItems } from './usePlanItems';
import type { ItemTypesSlice } from './useItemTypes';
import type { ItemUndoStep, ValuesWrite } from './item-undo-journal';
import { useRequiredFieldsGate } from './useRequiredFieldsGate';

// Deletes in flight at once while the Trash empties (the store holds at most ITEMS_MAX).
const EMPTY_TRASH_BATCH = 8;

export function usePlanItemWrites(
  planItems: PlanItems,
  itemTypes: ItemTypesSlice,
  // The slice's open-card state setter: stable, so the callbacks that list it keep their identity.
  setOpenItemId: Dispatch<SetStateAction<string | null>>,
) {
  const write = planItems.write;
  const capturesPractice = planItems.capturesPractice;

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
        const create: ItemCreate = {
          ...(input.id ? { id: input.id } : {}),
          type: input.type,
          fields,
          place: {
            status: input.status,
            ...(input.after ? { after: input.after } : {}),
            ...(input.before ? { before: input.before } : {}),
          },
        };
        const practiceAdd = capturesPractice(create);
        const done = write({ kind: 'create', creates: [create] });
        // A practice card is the tour's, not the person's work (docs/specs/026-plan/plan-tour.md "Telemetry").
        if (!practiceAdd) track('Plan', 'Added', titleCaseType(input.type));
        return done;
      };
      const fields = fillRequired(input.type, input.fields);
      return fields instanceof Promise
        ? fields.then((filled) => (filled ? made(filled) : false))
        : made(fields);
    },
    [write, fillRequired, capturesPractice],
  );

  // Many new cards as one write and one undo step (a board's Import CSV, docs/specs/026-plan/plan-board.md "CSV").
  const addItems = useCallback(
    (creates: readonly ItemCreate[]) =>
      creates.length ? write({ kind: 'create', creates: [...creates] }) : Promise.resolve(true),
    [write],
  );

  // A write that changes a card's type carries its custom fields mapped into the new type's, in the same write and
  // undo step (docs/specs/026-plan/item-types.md "Changing a card's type"). Any other write goes as it was. The cards
  // and types are read at their newest, so the write callbacks keep their identity as cards change.
  const latest = useLatest({ items: planItems.items, types: itemTypes.types });
  const typed = useCallback(
    <W extends ItemPatch | ItemMove>(itemId: string, w: W): W => {
      const { items, types } = latest.current;
      const item = w.type === undefined ? undefined : items.get(itemId);
      return item ? withTypeChangeFields(item, w, types) : w;
    },
    [latest],
  );

  const moveItem = useCallback(
    (itemId: string, move: ItemMove) => {
      void write({ kind: 'move', id: itemId, move: typed(itemId, move) });
      // A practice card's move is the tour's, not the person's work (docs/specs/026-plan/plan-tour.md "Telemetry").
      if (!planItems.practiceIds.has(itemId)) track('Plan', 'Moved', 'Board');
    },
    [write, typed, planItems.practiceIds],
  );

  // Many cards moved together (a group's drag, a selection's Move To): one write and one undo step, a single move for
  // one card.
  const moveItems = useCallback(
    (moves: readonly ItemMoveOf[]) => {
      if (moves.length === 0) return;
      const all = moves.map((m) => ({ id: m.id, move: typed(m.id, m.move) }));
      void write(
        all.length === 1
          ? { kind: 'move', id: all[0]!.id, move: all[0]!.move }
          : { kind: 'moves', moves: all },
      );
    },
    [write, typed],
  );

  const patchItem = useCallback(
    (itemId: string, patch: ItemPatch) =>
      write({ kind: 'patch', id: itemId, patch: typed(itemId, patch) }),
    [write, typed],
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
    [write, planItems.items, setOpenItemId],
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
    [write, planItems.items, setOpenItemId],
  );
  // Many cards changed as one write and one undo step (Keep Them on a template's example cards).
  const patchItems = useCallback(
    (patches: readonly ItemPatchOf[]) => {
      if (patches.length === 0) return;
      const all = patches.map((p) => ({ id: p.id, patch: typed(p.id, p.patch) }));
      void write(
        all.length === 1
          ? { kind: 'patch', id: all[0]!.id, patch: all[0]!.patch }
          : { kind: 'patches', patches: all },
      );
    },
    [write, typed],
  );
  // A field's values rewritten for its new type: written as an undo is, so a required field's cleared values are never
  // refused; whether it all landed and the undo of what did are handed back for the type's save, which keeps or puts
  // back all of it (docs/specs/026-plan/item-types.md "Edit Field": Saving the type).
  const reshapeValues = useCallback(
    (patches: readonly ItemPatchOf[]) =>
      new Promise<ValuesWrite>((resolve) => {
        let step: ItemUndoStep | null = null;
        void write(
          { kind: 'patches', patches: [...patches], undo: true },
          {
            onUndo: (s) => {
              step = s;
            },
          },
        ).then(
          (ok) => resolve({ ok, step }),
          () => resolve({ ok: false, step }),
        );
      }),
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
  }, [planItems.items, writeQuiet, setOpenItemId]);

  return {
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
  };
}
