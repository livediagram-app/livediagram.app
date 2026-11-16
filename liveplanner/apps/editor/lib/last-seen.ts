// The last seen copy a cloud plan warm-opens from (docs/specs/006-project/offline-mode.md "Warm open of a cloud
// project", docs/specs/006-project/blueprints/last-seen-copy.md): the shared copies over this product's own IndexedDB
// database, followed while the plan is open (its name, tab list and first tab's saves, and its cards and first tab's
// sheets, lib/last-seen-plan.ts).
import { createLastSeenCopies } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import { createLastSeenFollower } from '@liveworkspace/workbench/lib/api/last-seen-follower';
import { createLastSeenStore } from '@liveworkspace/workbench/lib/api/last-seen-store';
import type { PlanCopyItem } from './last-seen-plan';

export const LAST_SEEN_DB = 'liveplanner-last-seen';

export const lastSeenCopies = createLastSeenFollower<PlanCopyItem>(
  createLastSeenCopies<PlanCopyItem, unknown>(createLastSeenStore(LAST_SEEN_DB)),
);
