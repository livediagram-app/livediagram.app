// Shared arrangement for the image tests (db/image-grants.test.ts, media.test.ts, routes/images.test.ts): a started
// design (its own `design` row, as a create writes it), the media service's images, and tab builders. Not a
// `.test.ts` file, so vitest doesn't collect it as a suite.

import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livedesign/design';
import type { TestMediaService } from '../test-media-service';

// A started design, as its create writes it (test-sqlite-d1.ts `test_designs`).
export function liveDesign(
  sql: DatabaseSync,
  id: string,
  ownerId = 'owner',
  teamId: string | null = null,
) {
  sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, team_id, saved_at, created_at) VALUES (?, ?, ?, ?, 0, 1)',
    )
    .run(id, ownerId, id, teamId);
}

// Images in the media service, owned by `owner` as the service names owners (an account's id, a guest's hash:
// src/media.ts mediaOwner).
export function mediaImages(media: TestMediaService, owner: string, ids: string[]) {
  const stmt = media.sql.prepare(
    `INSERT INTO images (id, owner, app, content_type, byte_size, width, height, sha256, created_at)
     VALUES (?, ?, 'livedesign.app', 'image/png', 4, 1, 1, ?, 1)`,
  );
  for (const id of ids) stmt.run(id, owner, `sha-${id}`);
}

export const tabWith = (id: string, ...imageIds: string[]): Tab =>
  ({
    id,
    name: id,
    elements: imageIds.map((imageId, i) => ({ id: `e${i}`, type: 'image', imageId })),
  }) as unknown as Tab;
