// The last seen copy a cloud design warm-opens from (docs/specs/006-design/offline-mode.md "Warm open of a cloud design",
// docs/specs/006-design/blueprints/last-seen-copy.md): the shared copies over this product's own IndexedDB database, followed
// while the design is open (the follower keeps the copy up with its name, tab list and first tab's saves).
import type { LiveDoc } from '@livedesign/api-schema';
import { createLastSeenCopies } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import { createLastSeenFollower } from '@liveworkspace/workbench/lib/api/last-seen-follower';
import { createLastSeenStore } from '@liveworkspace/workbench/lib/api/last-seen-store';

export const LAST_SEEN_DB = 'livedesign-last-seen';

export const lastSeenCopies = createLastSeenFollower<LiveDoc>(
  createLastSeenCopies<LiveDoc, unknown>(createLastSeenStore(LAST_SEEN_DB)),
);
