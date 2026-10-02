// The `placement:` fingerprints (docs/specs/013-workspace/folders.md "Placement on create"): one
// line per decision a create makes about where its document is filed.

import type { DocumentPlacement, PlacementRejection } from '@livediagram/api-schema';
import type { PlacementVia } from './resolve-placement';

export type PlacementScope = 'personal' | 'team';

/** The space a raw or resolved `teamId` names, for the log line. */
export function placementScope(teamId: unknown): PlacementScope {
  return teamId === undefined || teamId === null ? 'personal' : 'team';
}

export function logPlacementResolved(placement: DocumentPlacement, via: PlacementVia): void {
  const folder = placement.folderId === null ? 'root' : 'set';
  console.info(
    `placement: resolved scope=${placementScope(placement.teamId)} folder=${folder} via=${via}`,
  );
}

export function logPlacementRejected(rejection: PlacementRejection, scope: PlacementScope): void {
  console.warn(`placement: rejected reason=${rejection} scope=${scope}`);
}

/** A re-commit of an id the caller already owns: its stored placement stands. */
export function logPlacementSkipped(): void {
  console.info('placement: skipped reason=existing');
}
