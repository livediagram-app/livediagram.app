// The `placement:` and `placement-defaults:` fingerprints (docs/specs/013-workspace/folders.md
// "Placement on create", docs/specs/013-workspace/default-folders.md "Observability"): one line per
// decision a create makes about where its document is filed, and per change to a default folder.

import type {
  DocumentPlacement,
  INTENT_INVALID,
  PlacementDefaultKey,
  PlacementDefaultRejection,
  PlacementRejection,
} from '@livediagram/api-schema';
import type { DefaultSkip, PlacementDecision } from './placement-types';

export type PlacementScope = 'personal' | 'team';

/** The space a raw or resolved `teamId` names, for the log line. */
export function placementScope(teamId: unknown): PlacementScope {
  return teamId === undefined || teamId === null ? 'personal' : 'team';
}

export function logPlacementResolved(
  placement: DocumentPlacement,
  decision: PlacementDecision,
): void {
  const folder = placement.folderId === null ? 'root' : 'set';
  const key = decision.via === 'default' ? ` key=${decision.key}` : '';
  console.info(
    `placement: resolved scope=${placementScope(placement.teamId)} folder=${folder} via=${decision.via}${key}`,
  );
}

/** A dangling default passed over on the way to the placement. */
export function logDefaultSkipped(skip: DefaultSkip): void {
  console.info(`placement: default-skipped key=${skip.key} reason=${skip.reason}`);
}

export function logPlacementRejected(
  rejection: PlacementRejection | typeof INTENT_INVALID,
  scope: PlacementScope,
): void {
  console.warn(`placement: rejected reason=${rejection} scope=${scope}`);
}

/** A re-commit of an id the caller already owns: its stored placement stands. */
export function logPlacementSkipped(): void {
  console.info('placement: skipped reason=existing');
}

export function logDefaultSet(key: PlacementDefaultKey, scope: PlacementScope): void {
  console.info(`placement-defaults: set key=${key} scope=${scope}`);
}

export function logDefaultCleared(key: PlacementDefaultKey): void {
  console.info(`placement-defaults: cleared key=${key}`);
}

export function logDefaultRejected(reason: PlacementDefaultRejection | 'folder_not_found'): void {
  console.warn(`placement-defaults: rejected reason=${reason}`);
}
