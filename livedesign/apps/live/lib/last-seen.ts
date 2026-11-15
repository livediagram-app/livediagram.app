// The last seen copy a cloud design warm-opens from (docs/specs/006-design/offline-mode.md "Warm open of a cloud design",
// docs/specs/006-design/blueprints/last-seen-copy.md): the shared copies over this product's own IndexedDB database.
import { createLastSeenCopies } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import { createLastSeenStore } from '@liveworkspace/workbench/lib/api/last-seen-store';

export const LAST_SEEN_DB = 'livedesign-last-seen';

export const lastSeenCopies = createLastSeenCopies(createLastSeenStore(LAST_SEEN_DB));
