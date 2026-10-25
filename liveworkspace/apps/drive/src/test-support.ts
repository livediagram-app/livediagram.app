// What the service's tests share: node:sqlite behind the object's SQL, an in-memory index acting as one person, the
// apps' doors, a clock and an alarm, and the fake Google, wired into a Mirror exactly as the Durable Object wires the
// real ones. Not a `.test.ts` file, so vitest doesn't collect it.

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import {
  APP_FILE_FORMATS,
  bytesToBase64Url,
  type AppName,
  type MirrorFolder,
  type MirrorItem,
} from '@liveworkspace/drive';
import { fakePngBase64Url, FakeGoogle } from '@liveworkspace/fake-google';
import { IndexError } from '@liveworkspace/index-client';
import type { AppDoors, ImportAnswer } from './app-doors';
import type { IndexApi, PersonIndex, Picture } from './index-api';
import type { Scheduler } from './mirror/context';
import type { Charge } from './mirror/meter';
import { Mirror } from './mirror/mirror';
import { SubrequestMeter } from './mirror/meter';
import { MirrorStore, type Sql } from './mirror/store';

export const ORIGIN = 'https://lw.test';
export const PERSON = 'user_ada';
export const GOOGLE_USER = 'ada-google';
export const TOKEN_KEY = bytesToBase64Url(new Uint8Array(32).fill(7));
export const REDIRECT_URI = `${ORIGIN}/drive/connected`;

export function nodeSql(db = new DatabaseSync(':memory:')): Sql {
  return {
    exec(query, ...bindings) {
      const statement = db.prepare(query);
      const args = bindings.map((b) => (typeof b === 'boolean' ? Number(b) : b) as SQLInputValue);
      if (statement.columns().length === 0) {
        statement.run(...args);
        return { toArray: () => [] };
      }
      const rows = statement.all(...args).map((row) => ({ ...row }));
      return { toArray: () => rows };
    },
  };
}

export class Clock {
  t = Date.parse('2026-10-25T10:00:00Z');
  now = () => this.t;
  advance(ms: number) {
    this.t += ms;
  }
}

export class FakeAlarm implements Scheduler {
  at: number | null = null;
  async getAlarm() {
    return this.at;
  }
  async setAlarm(at: number) {
    this.at = at;
  }
  async deleteAlarm() {
    this.at = null;
  }
}

type IndexItem = MirrorItem & { trashedAt: number | null };

/** The index as one person's own work: items, folders and the Trash, with the index's rules for each write. */
export class FakeIndex implements IndexApi {
  items = new Map<string, IndexItem>();
  folders = new Map<string, MirrorFolder>();
  mirrored = new Set<string>();
  writes: string[] = [];
  // Requests the real index would have answered (each write, each list page).
  requests = 0;
  private readonly clock: Clock;
  private seq = 0;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  addItem(input: Partial<IndexItem> & { name: string; app?: AppName }): IndexItem {
    const now = this.clock.now();
    const item: IndexItem = {
      id: input.id ?? `item${++this.seq}`,
      app: input.app ?? 'livediagram',
      name: input.name,
      folderId: input.folderId ?? null,
      updatedAt: input.updatedAt ?? now,
      createdAt: input.createdAt ?? now + this.seq,
      trashedAt: input.trashedAt ?? null,
    };
    this.items.set(item.id, item);
    return item;
  }

  addFolder(
    name: string,
    parentId: string | null = null,
    id = `folder${++this.seq}`,
  ): MirrorFolder {
    const folder = { id, name, parentId, updatedAt: this.clock.now() };
    this.folders.set(id, folder);
    return folder;
  }

  edit(id: string, patch: Partial<IndexItem>) {
    const item = this.item(id);
    this.items.set(id, { ...item, ...patch, updatedAt: patch.updatedAt ?? this.clock.now() });
  }

  private item(id: string): IndexItem {
    const item = this.items.get(id);
    if (!item) throw new IndexError(404, 'not_found');
    return item;
  }

  private folder(id: string): MirrorFolder {
    const folder = this.folders.get(id);
    if (!folder) throw new IndexError(404, 'not_found');
    return folder;
  }

  picture(): Picture {
    const live = [...this.items.values()].filter((i) => i.trashedAt === null);
    const trashed = [...this.items.values()].filter((i) => i.trashedAt !== null);
    return {
      items: live.map(({ trashedAt: _t, ...i }) => i),
      folders: [...this.folders.values()].map((f) => ({ ...f })),
      trash: trashed.map((i) => ({ id: i.id, app: i.app, name: i.name, trashedAt: i.trashedAt! })),
    };
  }

  // Deleting a folder moves its contents to its parent, as the index does.
  deleteFolderHere(id: string) {
    const folder = this.folder(id);
    for (const item of this.items.values())
      if (item.folderId === id) item.folderId = folder.parentId;
    for (const f of this.folders.values()) if (f.parentId === id) f.parentId = folder.parentId;
    this.folders.delete(id);
  }

  // Each call charged as the real index's requests are: one per write, one per list page (LIST_LIMIT_MAX a page).
  forPerson(personId: string, meter?: Charge): PersonIndex {
    const log = (w: string) => {
      meter?.charge();
      this.requests += 1;
      this.writes.push(w);
    };
    const now = () => this.clock.now();
    void personId;
    return {
      picture: async () => {
        const picture = this.picture();
        const pages = (n: number) => Math.max(1, Math.ceil(n / 200));
        const count =
          pages(picture.items.length) + pages(picture.folders.length) + pages(picture.trash.length);
        meter?.charge(count);
        this.requests += count;
        return picture;
      },
      renameItem: async (id, name) => {
        log(`rename-item ${id} ${name}`);
        this.items.set(id, { ...this.item(id), name, updatedAt: now() });
      },
      moveItem: async (id, folderId) => {
        log(`move-item ${id} ${folderId}`);
        this.items.set(id, { ...this.item(id), folderId });
      },
      trashItem: async (id) => {
        log(`trash-item ${id}`);
        this.items.set(id, { ...this.item(id), trashedAt: now() });
      },
      restoreItem: async (id) => {
        log(`restore-item ${id}`);
        this.items.set(id, { ...this.item(id), trashedAt: null });
      },
      purgeItem: async (id) => {
        log(`purge-item ${id}`);
        if (this.item(id).trashedAt === null) throw new IndexError(409, 'not_in_trash');
        this.items.delete(id);
      },
      createFolder: async (id, name, parentId) => {
        log(`create-folder ${id} ${name}`);
        this.folders.set(id, { id, name, parentId, updatedAt: now() });
      },
      renameFolder: async (id, name) => {
        log(`rename-folder ${id} ${name}`);
        this.folders.set(id, { ...this.folder(id), name, updatedAt: now() });
      },
      moveFolder: async (id, parentId) => {
        log(`move-folder ${id} ${parentId}`);
        this.folders.set(id, { ...this.folder(id), parentId });
      },
      deleteFolder: async (id) => {
        log(`delete-folder ${id}`);
        this.deleteFolderHere(id);
      },
      ownItem: async (id) => {
        meter?.charge();
        const item = this.items.get(id);
        return item && item.trashedAt === null ? { app: item.app } : null;
      },
    };
  }

  async setMirrored(personId: string, mirrored: boolean) {
    if (mirrored) this.mirrored.add(personId);
    else this.mirrored.delete(personId);
  }

  async isMirrored(personId: string): Promise<boolean | null> {
    return this.mirrored.has(personId);
  }
}

export const envelopeOf = (item: { app: AppName; name: string }, version: number) =>
  JSON.stringify({
    kind: APP_FILE_FORMATS[item.app].kind,
    schemaVersion: 1,
    exportedAt: version,
    name: item.name,
  });

/** Each app's doors over the fake index: the file is the item's envelope at its updatedAt. */
export class FakeDoors implements AppDoors {
  exports: string[] = [];
  imports: { app: AppName; owner: string; name: string; file: string }[] = [];
  missing = new Set<string>();
  requests = 0;
  svg: string | null = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
  private readonly index: FakeIndex;

  constructor(index: FakeIndex) {
    this.index = index;
  }

  async exportFile(app: AppName, itemId: string) {
    this.requests += 1;
    this.exports.push(itemId);
    const item = this.index.items.get(itemId);
    if (!item || this.missing.has(itemId)) return null;
    return { body: envelopeOf({ app, name: item.name }, item.updatedAt), version: item.updatedAt };
  }

  async exportSvg() {
    this.requests += 1;
    return this.svg;
  }

  async importFile(
    app: AppName,
    input: { owner: string; name: string; file: string },
  ): Promise<ImportAnswer> {
    this.requests += 1;
    this.imports.push({ app, owner: input.owner, name: input.name, file: input.file });
    return { ok: true, id: this.index.addItem({ name: input.name, app }).id };
  }

  itemUrl(app: AppName, itemId: string) {
    return `https://${app}.test/item/${itemId}`;
  }
}

export function harness(options: { budget?: number } = {}) {
  const clock = new Clock();
  const google = new FakeGoogle({ now: clock.now });
  // Every request the mirror makes, counted at the fakes apart from its own meter, and the meters it made.
  let googleRequests = 0;
  const googleFetch: typeof fetch = (input, init) => {
    googleRequests += 1;
    return google.fetch(input, init);
  };
  const meters: SubrequestMeter[] = [];
  const index = new FakeIndex(clock);
  const doors = new FakeDoors(index);
  const alarm = new FakeAlarm();
  const store = new MirrorStore(nodeSql());
  let ids = 0;
  const mirror = new Mirror({
    store,
    scheduler: alarm,
    google: {
      clientId: 'client',
      clientSecret: 'secret',
      baseUrl: 'https://google.test',
      fetch: googleFetch,
    },
    tokenKey: TOKEN_KEY,
    origin: ORIGIN,
    environment: 'development',
    pushAddress: `${ORIGIN}/api/drive/push`,
    index,
    doors,
    rasterise: async () => fakePngBase64Url(440),
    now: clock.now,
    newId: () => `id${++ids}`,
    newMeter: () => {
      const meter = new SubrequestMeter(options.budget);
      meters.push(meter);
      return meter;
    },
  });
  const requests = () => googleRequests + index.requests + doors.requests;

  async function connect(user = GOOGLE_USER) {
    return mirror.connect(PERSON, google.consent(user), REDIRECT_URI);
  }

  /** Every alarm due by now, in turn (a batched pass continues straight away). */
  // How many alarms ran, and the most requests one of them made, counted at the fakes.
  let alarms = 0;
  let alarmPeak = 0;
  async function runDue(limit = 20) {
    for (let i = 0; i < limit && alarm.at !== null; i++) {
      const wait = alarm.at - clock.now();
      // A batch's continuation runs straight away; anything later waits for the test to move the clock.
      if (wait > 1000) break;
      if (wait > 0) clock.advance(wait);
      alarm.at = null;
      const before = requests();
      await mirror.alarm();
      alarms += 1;
      alarmPeak = Math.max(alarmPeak, requests() - before);
    }
  }

  /** A pass now, whatever the alarm says. */
  async function pass() {
    alarm.at = clock.now();
    await runDue();
  }

  const files = () => google.appFiles(GOOGLE_USER);
  const fileOf = (itemId: string) => files().find((f) => f.appProperties.lwItemId === itemId);
  const folderFileOf = (folderId: string) =>
    files().find((f) => f.appProperties.lwFolderId === folderId);

  return {
    clock,
    google,
    index,
    doors,
    alarm,
    store,
    mirror,
    meters,
    alarmStats: () => ({ alarms, peak: alarmPeak }),
    resetAlarmStats: () => {
      alarms = 0;
      alarmPeak = 0;
    },
    connect,
    runDue,
    pass,
    files,
    fileOf,
    folderFileOf,
  };
}

export type Harness = ReturnType<typeof harness>;
