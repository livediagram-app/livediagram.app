// The worker's way into a person's Durable Object (person-store/person-store.ts): one typed stub per person id,
// its RPC methods with the person filled in.

import type {
  DriveConnection,
  DriveConnectionStatus,
  DriveItem,
  DriveItemKind,
  DriveLease,
  ShapeLibrary,
  ShapeLibraryItem,
} from '@livediagram/api-schema';
import type { LibraryRecord, NewShapeLibrary } from './person-store/shape-library-store';
import type { Env } from './types';

// The Google Drive mirror's RPCs (person-store/drive-store.ts): the store is the person's, so none names them.
export type DriveStoreRpc = {
  driveConnection(now: number): Promise<DriveConnection | null>;
  driveSealedRefreshToken(): Promise<string | null>;
  driveUpsertBroker(sealedRefreshToken: string, now: number): Promise<void>;
  driveCreateBrowser(now: number): Promise<void>;
  driveUpdateState(
    patch: { rootFolderId?: string | null; pageToken?: string },
    now: number,
  ): Promise<void>;
  driveSetStatus(status: DriveConnectionStatus): Promise<void>;
  driveDisconnect(): Promise<void>;
  driveItems(): Promise<DriveItem[]>;
  drivePutItems(items: DriveItem[]): Promise<'ok' | 'conflict'>;
  driveDeleteItems(items: { kind: DriveItemKind; ldId: string }[]): Promise<void>;
  driveAcquireLease(holder: string, now: number): Promise<DriveLease | null>;
  driveReleaseLease(holder: string): Promise<void>;
  driveAccountId(): Promise<string | null>;
  driveRecordAccount(accountId: string): Promise<void>;
  driveSetPendingSwitch(
    sealedRefreshToken: string,
    accountId: string,
    expiresAt: number,
  ): Promise<void>;
  driveSwitchTokens(): Promise<{ current: string | null; pending: string | null }>;
  driveConfirmSwitch(now: number): Promise<boolean>;
  driveClearSwitch(): Promise<void>;
};

const DRIVE_RPCS = [
  'driveConnection',
  'driveSealedRefreshToken',
  'driveUpsertBroker',
  'driveCreateBrowser',
  'driveUpdateState',
  'driveSetStatus',
  'driveDisconnect',
  'driveItems',
  'drivePutItems',
  'driveDeleteItems',
  'driveAcquireLease',
  'driveReleaseLease',
  'driveAccountId',
  'driveRecordAccount',
  'driveSetPendingSwitch',
  'driveSwitchTokens',
  'driveConfirmSwitch',
  'driveClearSwitch',
] as const satisfies readonly (keyof DriveStoreRpc)[];

export type PersonStoreClient = DriveStoreRpc & {
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
type PersonStoreRpc = DriveStoreRpc & {
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
  const driveRpcs = Object.fromEntries(
    DRIVE_RPCS.map((name) => [
      name,
      (...args: unknown[]) => {
        const target = store();
        return (target[name] as (...a: unknown[]) => Promise<unknown>).apply(target, args);
      },
    ]),
  ) as DriveStoreRpc;
  return {
    ...driveRpcs,
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
