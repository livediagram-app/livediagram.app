// What the service's tests share: an independent zip reader (node:zlib's inflate and CRC-32, never the writer's own
// code), an in-memory R2 that holds a multipart upload to R2's rules, node:sqlite behind the object's SQL, and sources
// that answer like the index, the media service and the apps.

import { DatabaseSync } from 'node:sqlite';
import { crc32 as zlibCrc32, inflateRawSync } from 'node:zlib';
import type { ExportReadyCall, ExportScope } from '@liveworkspace/data-export';
import type { ExportTable, ExportThread } from '@liveworkspace/index-app';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import type { App } from '@liveworkspace/index-client';
import type { MediaImage } from '@liveworkspace/media';
import type { ExportBucket, RunContext } from './job/steps';
import { JobStore, type Sql } from './job/store';
import type { ListedItem, Sources } from './sources';
import type { UploadedPart } from './upload';

// ---------- An independent zip reader ---------------------------------------------------------------------------

export type Unzipped = Map<string, { data: Uint8Array; method: number; utf8: boolean }>;

/** Reads a zip from its end record, checking every size, offset and CRC; throws on anything amiss. */
export function unzip(zip: Uint8Array): Unzipped {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  if (v.getUint32(end, true) !== 0x06054b50) throw new Error('no end record');
  const count = v.getUint16(end + 10, true);
  const dirSize = v.getUint32(end + 12, true);
  const dirOffset = v.getUint32(end + 16, true);
  if (dirOffset + dirSize !== end) throw new Error('directory does not end at the end record');
  const out: Unzipped = new Map();
  let at = dirOffset;
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
  for (let i = 0; i < count; i++) {
    if (v.getUint32(at, true) !== 0x02014b50) throw new Error(`bad directory entry ${i}`);
    const flags = v.getUint16(at + 8, true);
    const method = v.getUint16(at + 10, true);
    const crc = v.getUint32(at + 16, true);
    const csize = v.getUint32(at + 20, true);
    const size = v.getUint32(at + 24, true);
    const nameLength = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLength));
    if (v.getUint32(local, true) !== 0x04034b50) throw new Error(`bad local header for ${name}`);
    const localName = decoder.decode(
      zip.subarray(local + 30, local + 30 + v.getUint16(local + 26, true)),
    );
    if (localName !== name) throw new Error(`local name ${localName} is not ${name}`);
    const start = local + 30 + nameLength + v.getUint16(local + 28, true);
    const raw = zip.subarray(start, start + csize);
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw.slice();
    if (data.length !== size) throw new Error(`size of ${name}`);
    if (zlibCrc32(data) !== crc) throw new Error(`crc of ${name}`);
    if (out.has(name)) throw new Error(`duplicate ${name}`);
    out.set(name, { data, method, utf8: (flags & 0x0800) !== 0 });
    at += 46 + nameLength;
  }
  return out;
}

export const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

// ---------- R2 --------------------------------------------------------------------------------------------------

export type FakeBucket = ExportBucket & {
  objects: Map<string, Uint8Array>;
  uploads: Map<
    string,
    { key: string; parts: Map<number, Uint8Array>; done: boolean; aborted: boolean }
  >;
  deleted: string[];
  failUploads: number;
};

/** R2's multipart rules: every part but the last the same size, and the parts named at completion all present. */
export function fakeBucket(partBytes: number): FakeBucket {
  let n = 0;
  const bucket: FakeBucket = {
    objects: new Map(),
    uploads: new Map(),
    deleted: [],
    failUploads: 0,
    async createMultipartUpload(key) {
      const uploadId = `u${++n}`;
      bucket.uploads.set(uploadId, { key, parts: new Map(), done: false, aborted: false });
      return { uploadId };
    },
    resumeMultipartUpload(key, uploadId) {
      const upload = bucket.uploads.get(uploadId);
      if (!upload || upload.key !== key) throw new Error('no such upload');
      return {
        async uploadPart(partNumber: number, value: Uint8Array): Promise<UploadedPart> {
          if (bucket.failUploads > 0) {
            bucket.failUploads -= 1;
            throw new Error('r2 down');
          }
          upload.parts.set(partNumber, value.slice());
          return { partNumber, etag: `e${partNumber}-${value.length}` };
        },
        async complete(parts: UploadedPart[]) {
          const bodies = parts.map((p) => {
            const body = upload.parts.get(p.partNumber);
            if (!body || p.etag !== `e${p.partNumber}-${body.length}`)
              throw new Error(`part ${p.partNumber}`);
            return body;
          });
          bodies.forEach((b, i) => {
            if (i < bodies.length - 1 && b.length !== partBytes) throw new Error('uneven part');
          });
          const whole = new Uint8Array(bodies.reduce((s, b) => s + b.length, 0));
          let at = 0;
          for (const b of bodies) {
            whole.set(b, at);
            at += b.length;
          }
          bucket.objects.set(key, whole);
          upload.done = true;
        },
        async abort() {
          upload.aborted = true;
        },
      };
    },
    async delete(key) {
      bucket.deleted.push(key);
      bucket.objects.delete(key);
    },
  };
  return bucket;
}

// ---------- SQL -------------------------------------------------------------------------------------------------

export function testStore(): { store: JobStore; sql: Sql; db: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  const sql = nodeItemSql(db) as unknown as Sql;
  return { store: new JobStore(sql), sql, db };
}

// ---------- Sources ---------------------------------------------------------------------------------------------

export type FakeItem = ListedItem & {
  file?: string | null;
  fileFails?: number;
  svg?: Record<string, string | null>;
  tables?: ExportTable[] | 'fail';
  threads?: ExportThread[] | 'fail';
};

export type FakeSources = Sources & {
  items: FakeItem[];
  images: (MediaImage & { bytes: Uint8Array | null })[];
  pageSize: number;
  calls: number;
  readyCalls: ExportReadyCall[];
  readyFails: number;
  listFails: number;
  scopes: { scope: ExportScope; requestedBy: string }[];
};

export function envelope(app: App, name: string, tabs: { id: string; name: string }[]): string {
  return JSON.stringify({
    kind: `${app}.thing`,
    schemaVersion: 1,
    exportedAt: 1,
    thing: { name, tabs },
  });
}

export function fakeSources(): FakeSources {
  const s: FakeSources = {
    items: [],
    images: [],
    pageSize: 2,
    calls: 0,
    readyCalls: [],
    readyFails: 0,
    listFails: 0,
    scopes: [],
    async listItems(scope, requestedBy, cursor) {
      s.calls += 1;
      s.scopes.push({ scope, requestedBy });
      if (s.listFails > 0) {
        s.listFails -= 1;
        throw new Error('index down');
      }
      const from = cursor ? Number(cursor) : 0;
      const page = s.items.slice(from, from + s.pageSize).map(({ id, app, name, updatedAt }) => ({
        id,
        app,
        name,
        updatedAt,
      }));
      const next = from + s.pageSize < s.items.length ? String(from + s.pageSize) : null;
      return { items: page, nextCursor: next };
    },
    async listImages() {
      s.calls += 1;
      return s.images.map(({ bytes: _b, ...image }) => image);
    },
    async imageBytes(id) {
      s.calls += 1;
      return s.images.find((i) => i.id === id)?.bytes ?? null;
    },
    doors: {
      async exportFile(_app, id) {
        s.calls += 1;
        const item = s.items.find((i) => i.id === id);
        if (item?.fileFails) {
          item.fileFails -= 1;
          throw new Error('door down');
        }
        if (!item || item.file === null) return null;
        return { body: item.file ?? envelope(item.app, item.name, []), version: 1 };
      },
      async exportSvg(_app, id, tabId) {
        s.calls += 1;
        const svg = s.items.find((i) => i.id === id)?.svg?.[tabId ?? ''];
        if (svg === 'throw') throw new Error('render');
        return svg ?? null;
      },
      async exportTables(_app, id) {
        s.calls += 1;
        const tables = s.items.find((i) => i.id === id)?.tables;
        if (tables === 'fail') throw new Error('csv');
        return tables ?? null;
      },
      async exportComments(_app, id) {
        s.calls += 1;
        const threads = s.items.find((i) => i.id === id)?.threads;
        if (threads === 'fail') throw new Error('comments');
        return threads ?? [];
      },
    },
    async ready(call) {
      s.calls += 1;
      if (s.readyFails > 0) {
        s.readyFails -= 1;
        throw new Error('accounts down');
      }
      s.readyCalls.push(call);
    },
  };
  return s;
}

/** A run context over the fakes, with a clock the test moves. */
export function testContext(overrides: Partial<RunContext> & { clock?: { now: number } } = {}) {
  const { store, db } = testStore();
  const sources = fakeSources();
  const bucket = fakeBucket(8 * 1024 * 1024);
  const clock = overrides.clock ?? { now: Date.UTC(2026, 10, 1, 12) };
  const logs: { event: string; fields: Record<string, unknown> }[] = [];
  const ctx: RunContext = {
    store,
    sources,
    bucket,
    rasterise: async (svg) => (svg === 'blank' ? null : new TextEncoder().encode(`PNG:${svg}`)),
    now: () => clock.now,
    requests: () => sources.calls,
    transaction: (fn) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    log: (event, fields) => logs.push({ event, fields }),
    ...overrides,
  };
  return { ctx, store, sources, bucket, clock, logs, db };
}
