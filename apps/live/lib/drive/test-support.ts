// Test support for the Drive mirror engine (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "Testing"): an in-memory livediagram behind LivediagramPort that keeps the
// api's own rules (the Trash, folder deletion moving contents up, mirror rows
// removed with their document or folder, the lease), and a harness wiring
// engines to it and to the fake Google. Not a `.test.ts` file; tests import it.

import {
  documentToEnvelopeText,
  type DocumentEnvelope,
  type EnvelopeTab,
} from '@livediagram/document';
import {
  DRIVE_LEASE_MS,
  type DriveConnection,
  type DriveItem,
  type DriveItemKind,
  type DriveLease,
} from '@livediagram/api-schema';
import { FakeGoogle, fakePngBase64Url } from '@livediagram/fake-google';
import { ApiError } from '../api/core';
import { createDriveRestClient } from './drive-rest-client';
import { DriveMirrorEngine, type DriveMirrorStatus, type Timers } from './engine';
import {
  copyEnvelope,
  type CopyTarget,
  type LivediagramPort,
  type MirrorFolder,
} from './livediagram-port';
import { memorySeenStore } from './tombstones';
import type { TokenSource } from './token-source';

export const HOST = 'livediagram.test';
export const OWNER = 'user_me';
export const T0 = Date.parse('2026-09-28T09:00:00Z');

type StoredDocument = {
  id: string;
  name: string;
  folderId: string | null;
  teamId: string | null;
  savedAt: number;
  createdAt: number;
  trashedAt: number | null;
  tabs: EnvelopeTab[];
  presentation: string | null;
};

export class Clock {
  now = T0;
  tick(ms: number): number {
    this.now += ms;
    return this.now;
  }
}

// Timers the test advances by hand.
export class ManualTimers implements Timers {
  private tasks: { at: number; fn: () => void; id: number }[] = [];
  private seq = 0;
  private readonly clock: Clock;
  constructor(clock: Clock) {
    this.clock = clock;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.tasks.push({ at: this.clock.now + ms, fn, id });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.tasks = this.tasks.filter((t) => t.id !== handle);
  }
  pending(): number[] {
    return this.tasks.map((t) => t.at - this.clock.now).sort((a, b) => a - b);
  }
  // Move the clock forward, firing whatever falls due.
  advance(ms: number): void {
    const until = this.clock.now + ms;
    for (;;) {
      const due = this.tasks.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.tasks = this.tasks.filter((t) => t !== due);
      this.clock.now = Math.max(this.clock.now, due.at);
      due.fn();
    }
    this.clock.now = until;
  }
}

export class FakeLivediagram {
  readonly documents = new Map<string, StoredDocument>();
  readonly folders = new Map<string, MirrorFolder>();
  connection: DriveConnection | null = null;
  readonly items = new Map<string, DriveItem>();
  lease: { holder: string; expiresAt: number } | null = null;
  svg = '<svg viewBox="0 0 800 600"></svg>';
  writes = 0;
  private readonly clock: Clock;
  constructor(clock: Clock) {
    this.clock = clock;
  }

  // ---- the person using livediagram --------------------------------------
  createDocument(id: string, name: string, folderId: string | null = null): void {
    const t = this.clock.now;
    this.documents.set(id, {
      id,
      name,
      folderId,
      teamId: null,
      savedAt: t,
      createdAt: t,
      trashedAt: null,
      tabs: [{ id: `${id}-t1`, name: 'Tab 1', elements: [] }],
      presentation: null,
    });
  }
  edit(id: string): void {
    const d = this.live(id);
    d.tabs = [
      ...d.tabs,
      { id: `${id}-t${d.tabs.length + 1}`, name: `Tab ${d.tabs.length + 1}`, elements: [] },
    ];
    d.savedAt = this.clock.now;
  }
  createFolderAs(id: string, name: string, parentId: string | null = null): void {
    this.folders.set(id, { id, name, parentId, updatedAt: this.clock.now });
  }
  moveIntoTeam(id: string): void {
    this.live(id).teamId = 'team-1';
  }
  moveOutOfTeam(id: string): void {
    this.documents.get(id)!.teamId = null;
  }
  takeOffline(id: string): void {
    this.documents.delete(id);
    this.items.delete(`document:${id}`);
  }
  document(id: string): StoredDocument | undefined {
    return this.documents.get(id);
  }
  private live(id: string): StoredDocument {
    const d = this.documents.get(id);
    if (!d || d.trashedAt !== null)
      throw new ApiError('load', d ? 410 : 404, d ? 'document_trashed' : null);
    return d;
  }
  private personal(d: StoredDocument): boolean {
    return d.teamId === null;
  }

  // ---- LivediagramPort ------------------------------------------------------
  port(): LivediagramPort {
    const write = <T>(fn: () => T): Promise<T> => {
      this.writes += 1;
      try {
        return Promise.resolve(fn());
      } catch (err) {
        return Promise.reject(err);
      }
    };
    return {
      listPersonalDocuments: async () =>
        [...this.documents.values()]
          .filter((d) => d.trashedAt === null && this.personal(d))
          .map((d) => ({
            id: d.id,
            name: d.name,
            folderId: d.folderId,
            savedAt: d.savedAt,
            createdAt: d.createdAt,
          })),
      listPersonalFolders: async () => [...this.folders.values()].map((f) => ({ ...f })),
      listPersonalTrash: async () =>
        [...this.documents.values()]
          .filter((d) => d.trashedAt !== null && this.personal(d))
          .map((d) => ({ id: d.id, name: d.name, trashedAt: d.trashedAt! })),
      loadEnvelope: async (id) => {
        const d = this.documents.get(id);
        if (!d || d.trashedAt !== null) return null;
        return { text: documentToEnvelopeText(d, d.tabs, d.savedAt), savedAt: d.savedAt };
      },
      loadSnapshotSvg: async () => this.svg,
      canOpenDocument: async (id) => {
        const d = this.documents.get(id);
        return !!d && d.trashedAt === null;
      },
      renameDocument: (id, name) =>
        write(() => {
          const d = this.live(id);
          d.name = name;
          d.savedAt = this.clock.now;
        }),
      moveDocument: (id, folderId) =>
        write(() => {
          this.live(id).folderId = folderId;
        }),
      trashDocument: (id) =>
        write(() => {
          this.live(id).trashedAt = this.clock.now;
        }),
      restoreDocument: (id) =>
        write(() => {
          const d = this.documents.get(id);
          if (!d || d.trashedAt === null) throw new ApiError('restore', 404, null);
          d.trashedAt = null;
          if (d.folderId && !this.folders.has(d.folderId)) d.folderId = null;
        }),
      purgeDocument: (id) => write(() => this.purge(id)),
      createFolder: (id, name, parentId) => write(() => this.createFolderAs(id, name, parentId)),
      renameFolder: (id, name) =>
        write(() => {
          const f = this.folders.get(id)!;
          f.name = name;
          f.updatedAt = this.clock.now;
        }),
      moveFolder: (id, parentId) =>
        write(() => {
          let cursor = parentId;
          while (cursor) {
            if (cursor === id) throw new ApiError('update folder', 409, 'cycle');
            cursor = this.folders.get(cursor)?.parentId ?? null;
          }
          this.folders.get(id)!.parentId = parentId;
        }),
      deleteFolder: (id) => write(() => this.deleteFolder(id)),
      importDocumentCopy: (envelope: DocumentEnvelope, target?: CopyTarget) =>
        write(() => {
          const id = target?.id ?? `copy-${this.documents.size + 1}`;
          const { tabs, presentation } = copyEnvelope(envelope);
          this.documents.set(id, {
            id,
            name: target?.name ?? envelope.document.name,
            folderId: target?.folderId ?? null,
            teamId: null,
            savedAt: this.clock.now,
            createdAt: this.clock.now,
            trashedAt: null,
            tabs,
            presentation,
          });
          return id;
        }),
      getConnection: async () => (this.connection ? { ...this.connection } : null),
      putConnection: (patch) =>
        write(() => {
          if (!this.connection)
            throw new ApiError('drive connection update', 404, 'drive_not_connected');
          if (patch.rootFolderId !== undefined) this.connection.rootFolderId = patch.rootFolderId;
          if (patch.pageToken !== undefined) {
            this.connection.pageToken = patch.pageToken;
            this.connection.pageTokenSavedAt = this.clock.now;
          }
          return { ...this.connection };
        }),
      listItems: async () => [...this.items.values()].map((i) => ({ ...i })),
      putItems: (items) =>
        write(() => {
          for (const i of items) {
            const clash = [...this.items.values()].find(
              (o) => o.driveFileId === i.driveFileId && (o.kind !== i.kind || o.ldId !== i.ldId),
            );
            if (clash) throw new ApiError('drive items update', 409, 'drive_item_conflict');
          }
          for (const i of items) this.items.set(`${i.kind}:${i.ldId}`, { ...i });
        }),
      deleteItem: (kind: DriveItemKind, ldId) =>
        write(() => void this.items.delete(`${kind}:${ldId}`)),
      acquireLease: (holder) =>
        write((): DriveLease => {
          const now = this.clock.now;
          if (!this.lease || this.lease.holder === holder || this.lease.expiresAt <= now) {
            this.lease = { holder, expiresAt: now + DRIVE_LEASE_MS };
            return { acquired: true, holder, expiresAt: this.lease.expiresAt };
          }
          return { acquired: false, holder: this.lease.holder, expiresAt: this.lease.expiresAt };
        }),
      releaseLease: (holder) =>
        write(() => {
          if (this.lease?.holder === holder) this.lease = null;
        }),
    };
  }

  // The api's own removals, with the mirror rows in the same batch.
  purge(id: string): void {
    const d = this.documents.get(id);
    if (!d || d.trashedAt === null) throw new ApiError('purge document', 404, null);
    this.documents.delete(id);
    this.items.delete(`document:${id}`);
  }
  // As the api: the contents move up to the deleted folder's parent (docs/specs/013-workspace/folders.md).
  deleteFolder(id: string): void {
    const parentId = this.folders.get(id)?.parentId ?? null;
    for (const f of this.folders.values()) if (f.parentId === id) f.parentId = parentId;
    for (const d of this.documents.values()) if (d.folderId === id) d.folderId = parentId;
    this.items.delete(`folder:${id}`);
    this.folders.delete(id);
  }
  item(kind: DriveItemKind, ldId: string): DriveItem | undefined {
    return this.items.get(`${kind}:${ldId}`);
  }
}

// A token source straight from the fake: always a fresh valid token.
export function fakeTokens(google: FakeGoogle, user = OWNER): TokenSource {
  return { get: async () => google.issueAccessToken(user) };
}

export function makeEngine(opts: {
  google: FakeGoogle;
  ld: FakeLivediagram;
  clock: Clock;
  timers: ManualTimers;
  deviceId?: string;
  tokens?: TokenSource;
  visible?: () => boolean;
  diagnostics?: () => boolean;
  onInboundApplied?: () => void;
}) {
  const statuses: DriveMirrorStatus[] = [];
  const events: string[] = [];
  const firstMirror = new Set<number>();
  const tokens = opts.tokens ?? fakeTokens(opts.google);
  const engine = new DriveMirrorEngine({
    ownerId: OWNER,
    host: HOST,
    deviceId: opts.deviceId ?? 'device-a',
    port: opts.ld.port(),
    drive: createDriveRestClient({
      fetch: opts.google.fetch,
      getAccessToken: (o) => tokens.get(o),
    }),
    tokens,
    rasterise: async () => fakePngBase64Url(400),
    seen: memorySeenStore(),
    now: () => opts.clock.now,
    timers: opts.timers,
    track: (action, type) => events.push(type ? `${action}:${type}` : action),
    firstMirror: { done: (at) => firstMirror.has(at), mark: (at) => void firstMirror.add(at) },
    isVisible: opts.visible ?? (() => true),
    onStatus: (s) => statuses.push(s),
    ...(opts.diagnostics ? { diagnostics: opts.diagnostics } : {}),
    ...(opts.onInboundApplied ? { onInboundApplied: opts.onInboundApplied } : {}),
  });
  return { engine, statuses, events };
}

// A connected user with a clock, timers, the fake Google and livediagram.
export function world() {
  const clock = new Clock();
  const timers = new ManualTimers(clock);
  const google = new FakeGoogle({ now: () => clock.now });
  const ld = new FakeLivediagram(clock);
  ld.connection = {
    status: 'connected',
    hasRefreshToken: true,
    rootFolderId: null,
    pageToken: null,
    pageTokenSavedAt: null,
    connectedAt: T0,
  };
  return { clock, timers, google, ld };
}

// The Drive file mirroring a document or folder.
export function fileOf(google: FakeGoogle, ld: FakeLivediagram, kind: DriveItemKind, ldId: string) {
  const item = ld.item(kind, ldId);
  return item ? google.get(item.driveFileId) : undefined;
}
