'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ShapeLibrary, ShapeLibraryItem, ShapeLibrarySource } from '@livediagram/api-schema';
import {
  SHAPE_LIBRARY_SAVE_FAILED,
  apiCreateShapeLibrary,
  apiDeleteShapeLibrary,
  apiListShapeLibraries,
  apiUpdateShapeLibrary,
  shapeLibraryErrorCopy,
} from '@/lib/api/shape-libraries';
import { ApiError } from '@/lib/api/core';
import { track } from '@/lib/telemetry';

// The owner's shape libraries (docs/specs/013-workspace/shape-libraries.md), shared by the palette's
// My shapes, the Explorer's Shape libraries page and the draw.io import, so one list is the truth
// everywhere. Modelled on CustomThemeProvider: loaded once per owner, changes written through the
// api and reflected here. A null owner (auth still bootstrapping) loads nothing and changes nothing.

export type ShapeLibraryChange = { ok: true; library: ShapeLibrary } | { ok: false; error: string };

export type ShapeLibrariesValue = {
  libraries: ShapeLibrary[];
  status: 'loading' | 'ready' | 'error';
  reload: () => Promise<void>;
  createLibrary: (input: {
    name: string;
    source: ShapeLibrarySource;
    items: ShapeLibraryItem[];
  }) => Promise<ShapeLibraryChange>;
  renameLibrary: (id: string, name: string) => Promise<ShapeLibraryChange>;
  deleteLibrary: (id: string) => Promise<void>;
  deleteItem: (libraryId: string, itemId: string) => Promise<ShapeLibraryChange>;
};

const NOT_READY: ShapeLibraryChange = { ok: false, error: SHAPE_LIBRARY_SAVE_FAILED };

const INERT: ShapeLibrariesValue = {
  libraries: [],
  status: 'ready',
  reload: async () => {},
  createLibrary: async () => NOT_READY,
  renameLibrary: async () => NOT_READY,
  deleteLibrary: async () => {},
  deleteItem: async () => NOT_READY,
};

const ShapeLibraryContext = createContext<ShapeLibrariesValue | null>(null);

/** The owner's libraries; an inert empty value where no provider is mounted. */
export function useShapeLibraries(): ShapeLibrariesValue {
  return useContext(ShapeLibraryContext) ?? INERT;
}

const statusOf = (error: unknown) => (error instanceof ApiError ? error.status : null);

export function ShapeLibraryProvider({
  ownerId,
  children,
}: {
  ownerId: string | null;
  children: ReactNode;
}) {
  const [libraries, setLibraries] = useState<ShapeLibrary[]>([]);
  const [loaded, setLoaded] = useState<{ owner: string; ok: boolean } | null>(null);
  const status: ShapeLibrariesValue['status'] = !ownerId
    ? 'ready'
    : loaded?.owner !== ownerId
      ? 'loading'
      : loaded.ok
        ? 'ready'
        : 'error';

  const load = useCallback(async (owner: string, alive: () => boolean = () => true) => {
    try {
      const list = await apiListShapeLibraries(owner);
      if (!alive()) return;
      setLibraries(list);
      setLoaded({ owner, ok: true });
    } catch (error) {
      console.warn('[shape-libraries] list failed', { status: statusOf(error) });
      if (alive()) setLoaded({ owner, ok: false });
    }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    void (async () => {
      await load(ownerId, () => alive);
    })();
    return () => {
      alive = false;
    };
  }, [ownerId, load]);

  const reload = useCallback(async () => {
    if (ownerId) await load(ownerId);
  }, [ownerId, load]);

  // One change against the api: the library it returns replaces (or joins) the list.
  const change = useCallback(
    async (
      action: string,
      call: (owner: string) => Promise<ShapeLibrary>,
      place: (library: ShapeLibrary) => void,
    ): Promise<ShapeLibraryChange> => {
      if (!ownerId) return NOT_READY;
      try {
        const library = await call(ownerId);
        place(library);
        return { ok: true, library };
      } catch (error) {
        console.warn('[shape-libraries] save failed', { action, status: statusOf(error) });
        return { ok: false, error: shapeLibraryErrorCopy(error) };
      }
    },
    [ownerId],
  );
  const replace = (library: ShapeLibrary) =>
    setLibraries((prev) => prev.map((l) => (l.id === library.id ? library : l)));

  const createLibrary = useCallback<ShapeLibrariesValue['createLibrary']>(
    (input) =>
      change(
        'create',
        (owner) => apiCreateShapeLibrary(owner, { id: crypto.randomUUID(), ...input }),
        (library) => setLibraries((prev) => [library, ...prev]),
      ),
    [change],
  );

  const renameLibrary = useCallback<ShapeLibrariesValue['renameLibrary']>(
    (id, name) => change('rename', (owner) => apiUpdateShapeLibrary(owner, id, { name }), replace),
    [change],
  );

  const deleteItem = useCallback<ShapeLibrariesValue['deleteItem']>(
    (libraryId, itemId) => {
      const library = libraries.find((l) => l.id === libraryId);
      if (!library) return Promise.resolve(NOT_READY);
      const items = library.items.filter((i) => i.id !== itemId);
      return change(
        'delete-item',
        (owner) => apiUpdateShapeLibrary(owner, libraryId, { items }),
        replace,
      );
    },
    [change, libraries],
  );

  const deleteLibrary = useCallback<ShapeLibrariesValue['deleteLibrary']>(
    async (id) => {
      if (!ownerId) return;
      // Gone at once; a refused delete brings it back with the next load.
      setLibraries((prev) => prev.filter((l) => l.id !== id));
      try {
        await apiDeleteShapeLibrary(ownerId, id);
        track('Element', 'Deleted', 'ShapeLibrary');
      } catch (error) {
        console.warn('[shape-libraries] save failed', {
          action: 'delete',
          status: statusOf(error),
        });
        await load(ownerId);
      }
    },
    [ownerId, load],
  );

  const value = useMemo<ShapeLibrariesValue>(
    () => ({
      libraries,
      status,
      reload,
      createLibrary,
      renameLibrary,
      deleteLibrary,
      deleteItem,
    }),
    [libraries, status, reload, createLibrary, renameLibrary, deleteLibrary, deleteItem],
  );
  return <ShapeLibraryContext.Provider value={value}>{children}</ShapeLibraryContext.Provider>;
}
