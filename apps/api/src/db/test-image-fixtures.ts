// Shared arrangement for the image reference index readers' tests
// (db/image-retention.test.ts, db/images.test.ts): a real SQLite with every
// migration, an R2 stub, and row builders. Not a `.test.ts` file, so vitest
// doesn't collect it as a suite.

import { vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { insertDocumentRow } from './legacy-test-schema';
import type { Runtime } from '../types';

export const DAY = 86_400_000;
export const NOW = 1_800_000_000_000;
export const CUTOFF = NOW - 30 * DAY;
export const OLD = CUTOFF - DAY;
export const YOUNG = CUTOFF + DAY;

export type Bucket = { delete: ReturnType<typeof vi.fn> };

export function setup(opts: { before0050?: boolean } = {}): SqliteD1 & { bucket: Bucket } {
  const bucket: Bucket = { delete: vi.fn(async () => {}) };
  const db = sqliteD1(
    { objects: bucket } as unknown as Partial<Runtime>,
    opts.before0050 ? { before: '0050' } : {},
  );
  return { ...db, bucket };
}

export function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner', name = id) {
  insertDocumentRow(sql, id, ownerId, name);
}

export function images(sql: DatabaseSync, createdAt: number, ...ids: string[]) {
  const stmt = sql.prepare(
    "INSERT INTO images (id, owner_id, content_type, byte_size, width, height, sha256, created_at) VALUES (?, 'owner', 'image/png', 1, 1, 1, ?, ?)",
  );
  for (const id of ids) stmt.run(id, id, createdAt);
}

export const tabWith = (id: string, ...imageIds: string[]): Tab =>
  ({
    id,
    name: id,
    elements: imageIds.map((imageId, i) => ({ id: `e${i}`, type: 'image', imageId })),
  }) as unknown as Tab;

export function imageIds(sql: DatabaseSync): string[] {
  return sql
    .prepare('SELECT id FROM images ORDER BY id')
    .all()
    .map((r) => r.id as string);
}

export function refsFor(sql: DatabaseSync, imageId: string): number {
  return Number(
    sql.prepare('SELECT COUNT(*) AS n FROM image_refs WHERE image_id = ?').get(imageId)!.n,
  );
}

export const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(5, '0')}`);
