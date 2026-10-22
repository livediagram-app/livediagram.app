// The fake Drive's state: files and folders, parents, the bin, per-user app
// access (`drive.file`), and the change log `changes.list` reads.
//
// Modelled choices where Google is unverified (research E-A1, E-A3), each a
// switch on the store so a test can run both ways:
//   - The change log shows a user only files the app can access for them.
//   - Binning or restoring a folder emits a change for each descendant
//     (`emitDescendantChanges`, default true).

import { createHash } from 'node:crypto';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type FakeFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  trashed: boolean;
  explicitlyTrashed: boolean;
  appProperties: Record<string, string>;
  content: string;
  md5Checksum: string | null;
  headRevisionId: string | null;
  version: number;
  createdTime: string;
  modifiedTime: string;
  owner: string;
  sharedWith: Set<string>;
  // Users for whom the app holds `drive.file` access to this file.
  appAccess: Set<string>;
  thumbnail: { mimeType: string; bytes: number } | null;
};

type ChangeEntry = { seq: number; fileId: string; time: string };

// A deleted file's last-known access, so its `removed` change still reaches
// the users who could see it.
type Tombstone = { appAccess: Set<string>; owner: string };

export type StoreOptions = { emitDescendantChanges: boolean };

const md5 = (text: string) => createHash('md5').update(text).digest('hex');

export class DriveStore {
  readonly files = new Map<string, FakeFile>();
  private readonly changes: ChangeEntry[] = [];
  private readonly tombstones = new Map<string, Tombstone>();
  private readonly lostAccess = new Map<string, Set<string>>();
  private seq = 1;
  private idCounter = 0;
  private revCounter = 0;

  private readonly clock: () => number;
  readonly options: StoreOptions;

  constructor(clock: () => number, options: StoreOptions) {
    this.clock = clock;
    this.options = options;
  }

  myDriveRoot(user: string): string {
    return `mydrive-${user}`;
  }

  private nowIso(): string {
    return new Date(this.clock()).toISOString();
  }

  newId(): string {
    this.idCounter += 1;
    return `file${String(this.idCounter).padStart(5, '0')}`;
  }

  private record(fileId: string): void {
    this.changes.push({ seq: this.seq++, fileId, time: this.nowIso() });
  }

  startPageToken(): string {
    return String(this.seq);
  }

  canSee(user: string, file: FakeFile): boolean {
    return file.owner === user || file.sharedWith.has(user);
  }

  appCanAccess(user: string, file: FakeFile): boolean {
    return this.canSee(user, file) && file.appAccess.has(user);
  }

  create(input: {
    user: string;
    name: string;
    mimeType: string;
    parents: string[];
    appProperties?: Record<string, string>;
    content?: string;
    viaApp: boolean;
    thumbnail?: FakeFile['thumbnail'];
  }): FakeFile {
    const now = this.nowIso();
    const isFolder = input.mimeType === FOLDER_MIME;
    const content = input.content ?? '';
    const parentTrashed = input.parents.some((p) => this.files.get(p)?.trashed);
    const file: FakeFile = {
      id: this.newId(),
      name: input.name,
      mimeType: input.mimeType,
      parents: input.parents.map((p) => (p === 'root' ? this.myDriveRoot(input.user) : p)),
      trashed: parentTrashed,
      explicitlyTrashed: false,
      appProperties: { ...(input.appProperties ?? {}) },
      content,
      md5Checksum: isFolder ? null : md5(content),
      headRevisionId: isFolder ? null : `rev${++this.revCounter}`,
      version: 1,
      createdTime: now,
      modifiedTime: now,
      owner: input.user,
      sharedWith: new Set(),
      appAccess: new Set(input.viaApp ? [input.user] : []),
      thumbnail: input.thumbnail ?? null,
    };
    this.files.set(file.id, file);
    this.record(file.id);
    return file;
  }

  rename(file: FakeFile, name: string): void {
    file.name = name;
    this.touch(file);
  }

  move(file: FakeFile, add: string[], remove: string[], user: string): void {
    const resolved = add.map((p) => (p === 'root' ? this.myDriveRoot(user) : p));
    file.parents = [...file.parents.filter((p) => !remove.includes(p)), ...resolved].filter(
      (p, i, all) => all.indexOf(p) === i,
    );
    this.touch(file);
  }

  setAppProperties(file: FakeFile, props: Record<string, string | null>): void {
    for (const [k, v] of Object.entries(props)) {
      if (v === null) delete file.appProperties[k];
      else file.appProperties[k] = v;
    }
    this.touch(file);
  }

  writeContent(file: FakeFile, content: string, thumbnail?: FakeFile['thumbnail']): void {
    file.content = content;
    file.md5Checksum = md5(content);
    file.headRevisionId = `rev${++this.revCounter}`;
    // Drive invalidates the thumbnail on every content change.
    file.thumbnail = thumbnail ?? null;
    this.touch(file);
  }

  private touch(file: FakeFile): void {
    file.version += 1;
    file.modifiedTime = this.nowIso();
    this.record(file.id);
  }

  descendants(folderId: string): FakeFile[] {
    const out: FakeFile[] = [];
    const queue = [folderId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const f of this.files.values()) {
        if (f.parents.includes(id)) {
          out.push(f);
          if (f.mimeType === FOLDER_MIME) queue.push(f.id);
        }
      }
    }
    return out;
  }

  setTrashed(file: FakeFile, trashed: boolean): void {
    file.trashed = trashed;
    file.explicitlyTrashed = trashed;
    this.touch(file);
    if (file.mimeType !== FOLDER_MIME) return;
    for (const child of this.descendants(file.id)) {
      if (child.explicitlyTrashed) continue;
      child.trashed = trashed;
      if (this.options.emitDescendantChanges) this.touch(child);
    }
  }

  // Permanent delete, the folder's descendants with it.
  remove(file: FakeFile): void {
    const doomed = [file, ...(file.mimeType === FOLDER_MIME ? this.descendants(file.id) : [])];
    for (const f of doomed) {
      this.files.delete(f.id);
      this.tombstones.set(f.id, { appAccess: new Set(f.appAccess), owner: f.owner });
      this.record(f.id);
    }
  }

  emptyTrash(user: string): void {
    for (const f of [...this.files.values()]) {
      if (f.owner === user && f.explicitlyTrashed && this.files.has(f.id)) this.remove(f);
    }
  }

  // Drop the app's access for a user (drive.file loss of access): the file
  // then reads as `removed` in that user's change log.
  revokeAppAccess(file: FakeFile, user: string): void {
    this.noteAccessLost(file, user);
    file.appAccess.delete(user);
    this.record(file.id);
  }

  grantAppAccess(file: FakeFile, user: string): void {
    file.appAccess.add(user);
  }

  // The change entries a user's app may see from `token`, and the token to
  // continue from.
  changesSince(
    user: string,
    token: number,
    pageSize: number,
  ): {
    entries: { fileId: string; time: string; file: FakeFile | null }[];
    next: number;
    done: boolean;
  } {
    const entries: { fileId: string; time: string; file: FakeFile | null }[] = [];
    let cursor = token;
    for (const change of this.changes) {
      if (change.seq < token) continue;
      if (entries.length >= pageSize) return { entries, next: change.seq, done: false };
      cursor = change.seq + 1;
      const file = this.files.get(change.fileId) ?? null;
      if (file) {
        if (this.appCanAccess(user, file))
          entries.push({ fileId: file.id, time: change.time, file });
        else if (file.owner === user || file.sharedWith.has(user)) {
          // Access lost (or never had): reported as removed only if the app
          // once had it, which is what a revoked grant looks like.
          const hadAccess = this.lostAccess.get(file.id)?.has(user);
          if (hadAccess) entries.push({ fileId: file.id, time: change.time, file: null });
        }
      } else {
        const tomb = this.tombstones.get(change.fileId);
        if (tomb?.appAccess.has(user))
          entries.push({ fileId: change.fileId, time: change.time, file: null });
      }
    }
    return { entries, next: Math.max(cursor, this.seq), done: true };
  }

  private noteAccessLost(file: FakeFile, user: string): void {
    const set = this.lostAccess.get(file.id) ?? new Set<string>();
    set.add(user);
    this.lostAccess.set(file.id, set);
  }

  isValidPageToken(token: number): boolean {
    return Number.isInteger(token) && token >= 1 && token <= this.seq;
  }
}
