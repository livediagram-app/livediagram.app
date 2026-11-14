'use client';

// The project's item types in the editor (docs/specs/026-plan/item-types.md): the catalogue the
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
import type { ItemTypesRoomOp } from '@liveplanner/api-schema';
import {
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
  withInheritance,
} from '@liveplanner/items';
import { ItemTypesStaleError, saveItemTypes, type SavedItemTypes } from '@/lib/api/item-types';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { ItemUndoStep } from './item-undo-journal';
import { settleRetype, type SaveAlong } from './retype-settle';

// How many times one change is sent: the first, and again after each change of someone else's that landed first.
const ITEM_TYPES_SAVE_ATTEMPTS = 3;

export type ItemTypesSlice = {
  // The catalogue shown (stored, with this editor's unsaved changes), or null while the project's card types are
  // not chosen (none).
  catalogue: ItemTypeCatalogue | null;
  types: readonly ItemTypeDef[];
  // Adds or replaces a type (matched by id), keeping its place. `along`: what comes with a field's type change (its
  // cards' values and its filters, docs/specs/026-plan/item-types.md "Edit Field"), saved with it all or none and
  // made one undo step with it (retype-settle.ts).
  saveType: (type: ItemTypeDef, along?: SaveAlong) => void;
  deleteType: (typeId: string) => void;
  // Types added together, as one change; any whose id the catalogue already has is skipped, and the catalogue's
  // cap holds.
  addTypes: (defs: readonly ItemTypeDef[]) => void;
  // Any of the five default types the project lacks, after its types (Add Default Types); one change.
  addDefaultTypes: () => void;
  // The whole catalogue a board's types leave (catalogueWithBoardTypes), as one change.
  saveCatalogue: (next: ItemTypeCatalogue) => void;
  // A change that follows another (docs/specs/026-plan/item-types.md "The statuses a type uses": statuses joining
  // types): `remake` is made to the catalogue as stored at each send, so it is made again over anyone's later change.
  // No undo step, and no toast when it fails; nothing is sent when it changes nothing (remake answers null).
  quietChange: (remake: (stored: ItemTypeCatalogue | null) => ItemTypeCatalogue | null) => void;
  receive: (op: ItemTypesRoomOp) => void;
};

type Remake = (stored: ItemTypeCatalogue | null) => ItemTypeCatalogue | null;
// `silent`: its failure is said by whoever waits for it (a type change saved with its values), not by this toast.
type Pending = { id: number; change: CatalogueChange; remake?: Remake; silent?: true };

// One pending change made to `current`: a quiet change's remake (unchanged when it answers null), else the change.
const madeTo = (current: ItemTypeCatalogue | null, p: Pending) =>
  p.remake ? (p.remake(current) ?? current) : rebaseCatalogueChange(current, p.change);

const applied = (stored: ItemTypeCatalogue | null, pending: readonly Pending[]) =>
  pending.reduce(madeTo, stored);

export function useItemTypes(opts: {
  projectId: string | null;
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
  // newer seed or room op on the next commit. A different project's seed always lands.
  const storedRef = useRef<{ projectId: string | null; value: SavedItemTypes }>({
    projectId: opts.projectId,
    value: stored,
  });
  const projectId = opts.projectId;
  useInsertionEffect(() => {
    const held = storedRef.current;
    if (held.projectId !== projectId || stored.itemTypesRev >= held.value.itemTypesRev)
      storedRef.current = { projectId, value: stored };
  }, [projectId, stored]);
  // Saves run one at a time, so each names the revision the one before it left.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const catalogue = useMemo(() => applied(stored.itemTypes, pending), [stored, pending]);
  const types = useMemo(() => typesOf(catalogue), [catalogue]);

  // `refused`: the api's own word on what is stored (a 409), taken even below the revision held: a plan synced from
  // This Browser in place counted its own revisions, and the server's count starts again (item-types.md "Storage and
  // sync").
  const keepStored = useCallback(
    (next: SavedItemTypes, refused = false) => {
      if (!refused && next.itemTypesRev < storedRef.current.value.itemTypesRev) return;
      storedRef.current = { projectId: storedRef.current.projectId, value: next };
      setStored(next);
    },
    [setStored],
  );
  const setPendingNow = useCallback((next: readonly Pending[]) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  // Sends one change, made again to the stored catalogue each time another change landed first. True once stored.
  const send = useCallback(
    async (entry: Pending): Promise<boolean> => {
      const { projectId: doc, ownerId, shareCode, onError } = latest.current;
      const done = () => setPendingNow(pendingRef.current.filter((p) => p.id !== entry.id));
      if (!doc) {
        done();
        return true;
      }
      for (let attempt = 1; attempt <= ITEM_TYPES_SAVE_ATTEMPTS; attempt += 1) {
        const base = storedRef.current.value;
        const next = madeTo(base.itemTypes, entry);
        // A quiet change already made (by someone else first) sends nothing.
        if (entry.remake && next === base.itemTypes) {
          done();
          return true;
        }
        try {
          const saved = await saveItemTypes(
            { ownerId, projectId: doc, shareCode },
            next,
            base.itemTypesRev,
          );
          keepStored(saved);
          done();
          debugLog('[item-types] saved', {
            types: next?.types.length ?? null,
            rev: saved.itemTypesRev,
          });
          return true;
        } catch (err) {
          if (err instanceof ItemTypesStaleError) {
            debugLog('[item-types] save stale', { attempt, rev: err.stored.itemTypesRev });
            keepStored(err.stored, true);
            continue;
          }
          debugLog('[item-types] save failed', { error: String(err) });
          break;
        }
      }
      // Only this change is dropped: any saved since stay. A quiet change fails quietly.
      done();
      if (!entry.remake && !entry.silent) onError('Couldn’t save the card types');
      return false;
    },
    [latest, keepStored, setPendingNow],
  );

  // Makes `change` now (shown at once), and saves it after any change still on its way; true once it is stored.
  const make = useCallback(
    (change: CatalogueChange, remake?: Remake, silent?: true): Promise<boolean> => {
      const entry: Pending = {
        id: (nextId.current += 1),
        change,
        ...(remake ? { remake } : {}),
        ...(silent ? { silent } : {}),
      };
      setPendingNow([...pendingRef.current, entry]);
      const stored = queue.current.then(() => send(entry));
      queue.current = stored.then(() => undefined);
      return stored;
    },
    [send, setPendingNow],
  );

  // A change from the catalogue as shown to `next`, pushed as one undo step. With `along` (a field's type change), it
  // is saved all or none with its values and filters, and pushed with them once both have landed (retype-settle.ts).
  const change = useCallback(
    (next: (shown: ItemTypeCatalogue | null) => ItemTypeCatalogue | null, along?: SaveAlong) => {
      const before = applied(storedRef.current.value.itemTypes, pendingRef.current);
      const made: CatalogueChange = { before, after: next(before) };
      const saved = make(made, undefined, along ? true : undefined);
      const step: ItemUndoStep = {
        undo: () => void make(inverseCatalogueChange(made)),
        redo: () => void make(made),
      };
      if (!along) return latest.current.pushUndo(step);
      void settleRetype({
        saved,
        along,
        typeStep: step,
        rollbackType: () => void make(inverseCatalogueChange(made)),
        push: (s) => latest.current.pushUndo(s),
        onError: (message) => latest.current.onError(message),
      });
    },
    [latest, make],
  );

  const withTypes = useCallback(
    (edit: (types: readonly ItemTypeDef[]) => readonly ItemTypeDef[], along?: SaveAlong) =>
      change(
        (shown) => ({
          version: ITEM_TYPE_CATALOGUE_VERSION,
          // A base saved or deleted reaches the types inheriting from it at once, in the same undo step
          // (docs/specs/026-plan/item-types.md "Inherited types").
          types: withInheritance(edit(typesOf(shown))),
        }),
        along,
      ),
    [change],
  );

  const saveType = useCallback(
    (type: ItemTypeDef, along?: SaveAlong) =>
      withTypes(
        (ts) =>
          ts.some((t) => t.id === type.id)
            ? ts.map((t) => (t.id === type.id ? type : t))
            : [...ts, type],
        along,
      ),
    [withTypes],
  );
  const deleteType = useCallback(
    (typeId: string) => withTypes((ts) => ts.filter((t) => t.id !== typeId)),
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
  const quietChange = useCallback(
    (remake: Remake) => {
      const before = applied(storedRef.current.value.itemTypes, pendingRef.current);
      const after = remake(before);
      if (after) void make({ before, after }, remake);
    },
    [make],
  );
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
      quietChange,
      receive,
    }),
    [
      catalogue,
      types,
      saveType,
      deleteType,
      addTypes,
      addDefaultTypes,
      saveCatalogue,
      quietChange,
      receive,
    ],
  );
}
