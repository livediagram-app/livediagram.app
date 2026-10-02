// The response for a refused placement (docs/specs/013-workspace/folders.md "Placement on create"):
// the shared `{ error }` envelope, with the status each refusal carries.

import type { PlacementRejection } from '@livediagram/api-schema';
import { json } from '../responses';

const PLACEMENT_REJECTION_STATUS: Record<PlacementRejection, number> = {
  placement_invalid: 400,
  team_forbidden: 403,
  folder_not_found: 404,
  folder_scope_mismatch: 400,
};

export function placementRejected(rejection: PlacementRejection): Response {
  return json({ error: rejection }, { status: PLACEMENT_REJECTION_STATUS[rejection] });
}
