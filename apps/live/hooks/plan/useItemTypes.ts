'use client';

// The document's item types in the editor (docs/specs/026-plan/item-types.md): the catalogue the
// cards, panels and palette read, and the changes the Card Types panel makes. A change shows at
// once, is saved whole (the api answers with the stored, normalised catalogue, which is kept), and
// is one undo step in the editor's timeline; a failed save puts the last catalogue back. Another
// editor's save arrives as the room's `item-types` op.
import { useCallback, useMemo } from 'react';
import type { ItemTypesRoomOp } from '@livediagram/api-schema';
import {
  builtInCatalogue,
  readItemTypeCatalogue,
  typesOf,
  ITEM_TYPE_CATALOGUE_VERSION,
  type ItemTypeCatalogue,
  type ItemTypeDef,
} from '@livediagram/items';
import { saveItemTypes } from '@/lib/api/item-types';
import { debugLog } from '@/lib/debug-log';
import { useLatest } from '@/hooks/ui/useLatest';
import type { ItemUndoStep } from './item-undo-journal';

export type ItemTypesSlice = {
  // The stored catalogue, or null for the built-in types.
  catalogue: ItemTypeCatalogue | null;
  types: readonly ItemTypeDef[];
  // Adds or replaces a type (matched by id), keeping its place.
  saveType: (type: ItemTypeDef) => void;
  deleteType: (typeId: string) => void;
  reorder: (typeIds: readonly string[]) => void;
  restoreBuiltIns: () => void;
  receive: (op: ItemTypesRoomOp) => void;
};

export function useItemTypes(opts: {
  documentId: string | null;
  ownerId: string;
  shareCode: string | null;
  catalogue: ItemTypeCatalogue | null;
  setCatalogue: (next: ItemTypeCatalogue | null) => void;
  pushUndo: (step: ItemUndoStep) => void;
  onError: (message: string) => void;
}): ItemTypesSlice {
  const { catalogue, setCatalogue } = opts;
  const latest = useLatest(opts);
  const types = useMemo(() => typesOf(catalogue), [catalogue]);

  // Saves `next` (null: the built-ins). `undoable` is false for an undo or redo replaying a step.
  const save = useCallback(
    (first: ItemTypeCatalogue | null, firstUndoable: boolean) => {
      // Recursive: an undo step replays a save, which pushes no step of its own.
      async function run(next: ItemTypeCatalogue | null, undoable: boolean): Promise<void> {
        const { documentId, ownerId, shareCode, pushUndo, onError } = latest.current;
        if (!documentId) return;
        const prev = latest.current.catalogue;
        setCatalogue(next);
        if (undoable) {
          pushUndo({
            undo: () => void run(prev, false),
            redo: () => void run(next, false),
          });
        }
        try {
          setCatalogue(await saveItemTypes({ ownerId, documentId, shareCode }, next));
          debugLog('[item-types] saved', { types: next?.types.length ?? null });
        } catch (err) {
          debugLog('[item-types] save failed', { error: String(err) });
          setCatalogue(prev);
          onError('Couldn’t save the card types');
        }
      }
      return run(first, firstUndoable);
    },
    [latest, setCatalogue],
  );

  const withTypes = useCallback(
    (change: (types: readonly ItemTypeDef[]) => readonly ItemTypeDef[]) => {
      const base = latest.current.catalogue ?? builtInCatalogue();
      void save({ version: ITEM_TYPE_CATALOGUE_VERSION, types: change(base.types) }, true);
    },
    [latest, save],
  );

  const saveType = useCallback(
    (type: ItemTypeDef) =>
      withTypes((ts) =>
        ts.some((t) => t.id === type.id)
          ? ts.map((t) => (t.id === type.id ? type : t))
          : [...ts, type],
      ),
    [withTypes],
  );
  const deleteType = useCallback(
    (typeId: string) => withTypes((ts) => (ts.length > 1 ? ts.filter((t) => t.id !== typeId) : ts)),
    [withTypes],
  );
  const reorder = useCallback(
    (typeIds: readonly string[]) =>
      withTypes((ts) => {
        const byId = new Map(ts.map((t) => [t.id, t]));
        const ordered = typeIds.flatMap((id) => byId.get(id) ?? []);
        return [...ordered, ...ts.filter((t) => !typeIds.includes(t.id))];
      }),
    [withTypes],
  );
  const restoreBuiltIns = useCallback(() => void save(null, true), [save]);
  const receive = useCallback(
    (op: ItemTypesRoomOp) => setCatalogue(readItemTypeCatalogue(op.itemTypes)),
    [setCatalogue],
  );

  return useMemo(
    () => ({ catalogue, types, saveType, deleteType, reorder, restoreBuiltIns, receive }),
    [catalogue, types, saveType, deleteType, reorder, restoreBuiltIns, receive],
  );
}
