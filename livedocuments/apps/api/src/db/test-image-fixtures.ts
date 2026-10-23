// Shared arrangement for the image reference index readers' tests (db/images.test.ts,
// db/image-grants.test.ts): a real SQLite with the baseline migration, and row builders. Not a
// `.test.ts` file, so vitest doesn't collect it as a suite.

import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livedocuments/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';

export function setup(): SqliteD1 {
  return sqliteD1();
}

export function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner', name = id) {
  sql
    .prepare(
      'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 0, 0)',
    )
    .run(id, ownerId, name);
}

// Images owned by 'owner', as the media service's images are known here (src/media.ts).
export function images(sql: DatabaseSync, ...ids: string[]) {
  const stmt = sql.prepare("INSERT INTO media_images (id, owner_id) VALUES (?, 'owner')");
  for (const id of ids) stmt.run(id);
}

export const tabWith = (id: string, ...imageIds: string[]): Tab =>
  ({
    id,
    name: id,
    elements: imageIds.map((imageId, i) => ({ id: `e${i}`, type: 'image', imageId })),
  }) as unknown as Tab;
