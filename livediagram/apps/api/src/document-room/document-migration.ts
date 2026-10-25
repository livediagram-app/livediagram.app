// The migration door's write into a canvas's own SQLite (docs/specs/015-api/api.md "Internal", docs/migration.md
// "The apps' migration door"): an old livediagram.app document's livediagram part, with its own times, changesets,
// image owners and grants, in one transaction. The rules (what is written, replaced or left as edited) are the kit's
// (@liveworkspace/index-app migration-room.ts); this names the canvas's tables and its own stats and image
// references.

import {
  writeMigratedRoom,
  type ItemDb,
  type MigrationRoomShape,
} from '@liveworkspace/index-app';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import { tabStatsOfData } from '../db/tab-stats';
import { imageRefIdsFromData } from '../image-refs/extract';

export const DOCUMENT_MIGRATION_SHAPE: MigrationRoomShape = {
  itemTable: 'document',
  linkTable: 'document_tabs',
  itemColumn: 'document_id',
  presentation: true,
  opensIn: false,
  tabKind: false,
  images: true,
  tabStats: (data) => {
    const { stats } = tabStatsOfData(data);
    return {
      mode: stats.mode,
      element_count: stats.elementCount,
      comment_count: stats.commentCount,
      data_bytes: stats.dataBytes,
    };
  },
  imageRefs: imageRefIdsFromData,
};

export function importMigratedDocument(
  db: ItemDb,
  payload: MigrationRoomPayload,
  now = Date.now(),
): MigrationDoorAnswer {
  return db.transact((sql) => writeMigratedRoom(sql, DOCUMENT_MIGRATION_SHAPE, payload, now));
}
