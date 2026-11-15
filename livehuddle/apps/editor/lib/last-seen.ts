// The last seen copy a cloud document warm-opens from (docs/specs/006-document/offline-mode.md "Warm open of a cloud document",
// docs/specs/006-document/blueprints/last-seen-copy.md): the shared copies over this product's own IndexedDB database, followed
// while the document is open (the follower keeps the copy up with its name, tab list and first tab's saves).
import type { LiveDoc } from '@livehuddle/api-schema';
import { createLastSeenCopies } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import { createLastSeenFollower } from '@liveworkspace/workbench/lib/api/last-seen-follower';
import { createLastSeenStore } from '@liveworkspace/workbench/lib/api/last-seen-store';

export const LAST_SEEN_DB = 'livehuddle-last-seen';

export const lastSeenCopies = createLastSeenFollower<LiveDoc>(
  createLastSeenCopies<LiveDoc, unknown>(createLastSeenStore(LAST_SEEN_DB)),
);
