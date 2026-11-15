// The last seen copy a cloud document warm-opens from (docs/specs/006-document/offline-mode.md "Warm open of a cloud document",
// docs/specs/006-document/blueprints/last-seen-copy.md): the shared copies over this product's own IndexedDB database.
import { createLastSeenCopies } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import { createLastSeenStore } from '@liveworkspace/workbench/lib/api/last-seen-store';

export const LAST_SEEN_DB = 'livedocuments-last-seen';

export const lastSeenCopies = createLastSeenCopies(createLastSeenStore(LAST_SEEN_DB));
