// Shared arrangement for the image tests (db/image-grants.test.ts, media.test.ts, routes/images.test.ts): a started
// document (its own `document` row, as a create writes it), the media service's images, and tab builders. Not a
// `.test.ts` file, so vitest doesn't collect it as a suite.

import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livedocuments/document';
import type { TestMediaService } from '../test-media-service';

// A started document, as its create writes it (test-sqlite-d1.ts `test_documents`).
export function liveDoc(
  sql: DatabaseSync,
  id: string,
  ownerId = 'owner',
  name = id,
  teamId: string | null = null,
) {
  sql
    .prepare('INSERT INTO test_documents (id, owner_id, name, team_id, saved_at, created_at) VALUES (?, ?, ?, ?, 0, 1)')
    .run(id, ownerId, name, teamId);
}

// Images in the media service, owned by `owner` as the service names owners (an account's id, a guest's hash:
// src/media.ts mediaOwner), with bytes to serve.
export function mediaImages(
  media: TestMediaService,
  owner: string,
  ids: string[],
  app = 'livedocuments.app',
) {
  const stmt = media.sql.prepare(
    `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
     VALUES (?, ?, ?, 'image/png', 4, 1, 1, ?, 1)`,
  );
  for (const id of ids) {
    stmt.run(id, owner, app, `sha-${id}`);
    media.objects.set(id, { bytes: new Uint8Array([1, 2, 3, 4]), contentType: 'image/png' });
  }
}

export const tabWith = (id: string, ...imageIds: string[]): Tab =>
  ({
    id,
    name: id,
    elements: imageIds.map((imageId, i) => ({ id: `e${i}`, type: 'image', imageId })),
  }) as unknown as Tab;
