// The worker's way into a person's Durable Object (person-store/person-store.ts): one typed stub per person id,
// its RPC methods with the person filled in.

import type { ShapeLibrary, ShapeLibraryItem } from '@livediagram/api-schema';
import type { LibraryRecord, NewShapeLibrary } from './person-store/shape-library-store';
import type { Env } from './types';

export type PersonStoreClient = {
  shapeLibraries(): Promise<ShapeLibrary[]>;
  shapeLibrary(id: string): Promise<ShapeLibrary | null>;
  createShapeLibrary(lib: NewShapeLibrary, cap: number): Promise<ShapeLibrary | 'cap' | 'exists'>;
  updateShapeLibrary(
    id: string,
    patch: { name?: string; items?: ShapeLibraryItem[] },
  ): Promise<ShapeLibrary | 'not_found' | 'name_taken'>;
  deleteShapeLibrary(id: string): Promise<boolean>;
  exportShapeLibraries(): Promise<LibraryRecord[]>;
  adoptShapeLibraries(records: LibraryRecord[]): Promise<{ moved: number; renamed: number }>;
  purge(): Promise<void>;
};

// The PersonStore RPC surface as the class declares it.
type PersonStoreRpc = {
  shapeLibraries(ownerId: string): Promise<ShapeLibrary[]>;
  shapeLibrary(ownerId: string, id: string): Promise<ShapeLibrary | null>;
  createShapeLibrary(
    ownerId: string,
    lib: NewShapeLibrary,
    cap: number,
  ): Promise<ShapeLibrary | 'cap' | 'exists'>;
  updateShapeLibrary(
    ownerId: string,
    id: string,
    patch: { name?: string; items?: ShapeLibraryItem[] },
  ): Promise<ShapeLibrary | 'not_found' | 'name_taken'>;
  deleteShapeLibrary(id: string): Promise<boolean>;
  exportShapeLibraries(): Promise<LibraryRecord[]>;
  adoptShapeLibraries(records: LibraryRecord[]): Promise<{ moved: number; renamed: number }>;
  purge(): Promise<void>;
};

export function personStore(env: Pick<Env, 'PERSON_STORE'>, personId: string): PersonStoreClient {
  // The stub is made on the first call, so a client nobody calls costs nothing. Its RPC types wrap every answer for
  // the wire; the shapes here are the class's own.
  let stub: PersonStoreRpc | null = null;
  const store = (): PersonStoreRpc => {
    if (!stub) {
      const ns = env.PERSON_STORE;
      stub = ns.get(ns.idFromName(personId)) as unknown as PersonStoreRpc;
    }
    return stub;
  };
  return {
    shapeLibraries: () => store().shapeLibraries(personId),
    shapeLibrary: (id) => store().shapeLibrary(personId, id),
    createShapeLibrary: (lib, cap) => store().createShapeLibrary(personId, lib, cap),
    updateShapeLibrary: (id, patch) => store().updateShapeLibrary(personId, id, patch),
    deleteShapeLibrary: (id) => store().deleteShapeLibrary(id),
    exportShapeLibraries: () => store().exportShapeLibraries(),
    adoptShapeLibraries: (records) => store().adoptShapeLibraries(records),
    purge: () => store().purge(),
  };
}
