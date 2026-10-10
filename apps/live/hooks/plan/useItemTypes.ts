'use client';

// The document's item types in the editor (docs/specs/026-plan/item-types.md): the catalogue the
// cards, panels and palette read, and the changes the Card Types panel makes. `stored` is the catalogue
// as the api last had it, with its revision; each change is kept as the catalogue before and after it
// (CatalogueChange) and shown at once over `stored`, while it is saved in turn, naming the revision it
// was made to. When another editor's change landed first (ItemTypesStaleError), it is made again to the
// catalogue now stored (rebaseCatalogueChange) and sent again, so neither change overwrites the other.
// A failed save drops only its own change, and an undo or redo makes the change's inverse (or the change)
// to the catalogue as it then is, so neither takes back anyone's later change. Another editor's save
// arrives as the room's `item-types` op.
import {
  useCallback,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { ItemTypesRoomOp } from '@livediagram/api-schema';
import {
  defaultCatalogue,
  inverseCatalogueChange,
  readItemTypeCatalogue,
  rebaseCatalogueChange,
  typesOf,
  ITEM_TYPE_CATALOGUE_VERSION,
  type CatalogueChange,
  type ItemTypeCatalogue,
  type ItemTypeDef,
  defaultTypesToAdd,
  ITEM_TYPES_MAX,
} from '@livediagram/items';
import { ItemTypesStaleError, saveItemTypes, type SavedItemTypes } from '@/lib/api/item-types';
import { debugLog } from '@/lib/debug-log';
import { useLatest } from '@/hooks/ui/useLatest';
import type { ItemUndoStep } from './item-undo-journal';

// How many times one change is sent: the first, and again after each change of someone else's that landed first.
export const ITEM_TYPES_SAVE_ATTEMPTS = 3;

export type ItemTypesSlice = {
  // The catalogue shown (stored, with this editor's unsaved changes), or null while the document's card types are
  // not chosen (the default types).
  catalogue: ItemTypeCatalogue | null;
  types: readonly ItemTypeDef[];
  // Adds or replaces a type (matched by id), keeping its place.
  saveType: (type: ItemTypeDef) => void;
  deleteType: (typeId: string) => void;
  // Types added together, as one change; any whose id the catalogue already has is skipped, and the catalogue's
  // cap holds.
  addTypes: (defs: readonly ItemTypeDef[]) => void;
  // Any of the five default types the document lacks, after its types (Add Default Types); one change.
  addDefaultTypes: () => void;
  // The whole catalogue a board's types leave (catalogueWithBoardTypes), as one change.
  saveCatalogue: (next: ItemTypeCatalogue) => void;
  receive: (op: ItemTypesRoomOp) => void;
};

type Pending = { id: number; change: CatalogueChange };

const applied = (stored: ItemTypeCatalogue | null, pending: readonly Pending[]) =>
  pending.reduce((c, p) => rebaseCatalogueChange(c, p.change), stored);

export function useItemTypes(opts: {
  documentId: string | null;
  ownerId: string;
  shareCode: string | null;
  // The catalogue as the api last had it, and its setter (seeded on load).
  stored: SavedItemTypes;
  setStored: Dispatch<SetStateAction<SavedItemTypes>>;
  pushUndo: (step: ItemUndoStep) => void;
  onError: (message: string) => void;
}): ItemTypesSlice {
  const { stored, setStored } = opts;
  const latest = useLatest(opts);
  // This editor's changes not yet saved, in the order they were made.
  const [pending, setPending] = useState<readonly Pending[]>([]);
  const pendingRef = useRef<readonly Pending[]>([]);
  const nextId = useRef(0);
  // The stored catalogue at its newest, read by the saves between renders: a save's answer lands here at once, a
  // newer seed or room op on the next commit. A different document's seed always lands.
  const storedRef = useRef<{ documentId: string | null; value: SavedItemTypes }>({
    documentId: opts.documentId,
    value: stored,
  });
  const documentId = opts.documentId;
  useInsertionEffect(() => {
    const held = storedRef.current;
    if (held.documentId !== documentId || stored.itemTypesRev >= held.value.itemTypesRev)
      storedRef.current = { documentId, value: stored };
  }, [documentId, stored]);
  // Saves run one at a time, so each names the revision the one before it left.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const catalogue = useMemo(() => applied(stored.itemTypes, pending), [stored, pending]);
  const types = useMemo(() => typesOf(catalogue), [catalogue]);

  const keepStored = useCallback(
    (next: SavedItemTypes) => {
      if (next.itemTypesRev < storedRef.current.value.itemTypesRev) return;
      storedRef.current = { documentId: storedRef.current.documentId, value: next };
      setStored(next);
    },
    [setStored],
  );
  const setPendingNow = useCallback((next: readonly Pending[]) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  // Sends one change, made again to the stored catalogue each time another change landed first.
  const send = useCallback(
    async (entry: Pending): Promise<void> => {
      const { documentId: doc, ownerId, shareCode, onError } = latest.current;
      const done = () => setPendingNow(pendingRef.current.filter((p) => p.id !== entry.id));
      if (!doc) return done();
      for (let attempt = 1; attempt <= ITEM_TYPES_SAVE_ATTEMPTS; attempt += 1) {
        const base = storedRef.current.value;
        const next = rebaseCatalogueChange(base.itemTypes, entry.change);
        try {
          const saved = await saveItemTypes(
            { ownerId, documentId: doc, shareCode },
            next,
            base.itemTypesRev,
          );
          keepStored(saved);
          done();
          debugLog('[item-types] saved', {
            types: next?.types.length ?? null,
            rev: saved.itemTypesRev,
          });
          return;
        } catch (err) {
          if (err instanceof ItemTypesStaleError) {
            debugLog('[item-types] save stale', { attempt, rev: err.stored.itemTypesRev });
            keepStored(err.stored);
            continue;
          }
          debugLog('[item-types] save failed', { error: String(err) });
          break;
        }
      }
      // Only this change is dropped: any saved since stay.
      done();
      onError('Couldn’t save the card types');
    },
    [latest, keepStored, setPendingNow],
  );

  // Makes `change` now (shown at once), and saves it after any change still on its way.
  const make = useCallback(
    (change: CatalogueChange) => {
      const entry = { id: (nextId.current += 1), change };
      setPendingNow([...pendingRef.current, entry]);
      queue.current = queue.current.then(() => send(entry));
    },
    [send, setPendingNow],
  );

  // A change from the catalogue as shown to `next`, pushed as one undo step.
  const change = useCallback(
    (next: (shown: ItemTypeCatalogue | null) => ItemTypeCatalogue | null) => {
      const before = applied(storedRef.current.value.itemTypes, pendingRef.current);
      const made: CatalogueChange = { before, after: next(before) };
      make(made);
      latest.current.pushUndo({
        undo: () => make(inverseCatalogueChange(made)),
        redo: () => make(made),
      });
    },
    [latest, make],
  );

  const withTypes = useCallback(
    (edit: (types: readonly ItemTypeDef[]) => readonly ItemTypeDef[]) =>
      change((shown) => ({
        version: ITEM_TYPE_CATALOGUE_VERSION,
        types: edit((shown ?? defaultCatalogue()).types),
      })),
    [change],
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
  const addTypes = useCallback(
    (defs: readonly ItemTypeDef[]) =>
      withTypes((ts) => {
        const fresh = defs.filter((d) => !ts.some((t) => t.id === d.id));
        return [...ts, ...fresh].slice(0, Math.max(ts.length, ITEM_TYPES_MAX));
      }),
    [withTypes],
  );
  const addDefaultTypes = useCallback(
    () =>
      withTypes((ts) =>
        [...ts, ...defaultTypesToAdd(ts)].slice(0, Math.max(ts.length, ITEM_TYPES_MAX)),
      ),
    [withTypes],
  );
  const saveCatalogue = useCallback((next: ItemTypeCatalogue) => change(() => next), [change]);
  const receive = useCallback(
    (op: ItemTypesRoomOp) =>
      keepStored({
        itemTypes: readItemTypeCatalogue(op.itemTypes),
        // An op from before revisions is taken as the newest.
        itemTypesRev: op.itemTypesRev ?? storedRef.current.value.itemTypesRev,
      }),
    [keepStored],
  );

  return useMemo(
    () => ({
      catalogue,
      types,
      saveType,
      deleteType,
      addTypes,
      addDefaultTypes,
      saveCatalogue,
      receive,
    }),
    [catalogue, types, saveType, deleteType, addTypes, addDefaultTypes, saveCatalogue, receive],
  );
}
