// The migration door's write into a design's own SQLite (docs/specs/015-api/api.md "Internal", docs/migration.md
// "The apps' migration door"): an old livediagram.app document's livedesign part (its logo and wireframe pages),
// with its own times, creation intent, deck, changesets, image owners and grants, in one transaction. The rules
// (what is written, replaced or left as edited) are the kit's (@liveworkspace/index-app migration-room.ts); this
// names the design's tables and its own stats and image references. The old site never had photo pages, so no
// photo blob reference comes with it.

import {
  writeMigratedRoom,
  type ItemDb,
  type MigrationRoomShape,
} from '@liveworkspace/index-app';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import { tabStatsOfData } from '../db/tab-stats';
import { imageRefIdsFromData } from '../image-refs/extract';

export const DESIGN_MIGRATION_SHAPE: MigrationRoomShape = {
  itemTable: 'design',
  linkTable: 'design_tabs',
  itemColumn: 'design_id',
  presentation: true,
  opensIn: true,
  tabKind: true,
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

export function importMigratedDesign(
  db: ItemDb,
  payload: MigrationRoomPayload,
  now = Date.now(),
): MigrationDoorAnswer {
  return db.transact((sql) => writeMigratedRoom(sql, DESIGN_MIGRATION_SHAPE, payload, now));
}
