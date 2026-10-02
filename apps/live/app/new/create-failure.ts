// The card a failed create on /new shows (docs/specs/007-editor/new-document-route.md "Placement
// rides the create"). A refused placement will not clear on a retry, so it says why and offers
// another place; any other failure keeps the connection copy and Try again.

import { isPlacementRejection, type PlacementRejection } from '@livediagram/api-schema';
import { ApiError } from '@/lib/api-client';

export type CreateFailure = {
  // `retry` re-runs the same create; `choose` reopens /new without the refused placement.
  action: 'retry' | 'choose';
  eyebrow: string;
  title: string;
  message: string;
  actionLabel: string;
};

const PLACEMENT_MESSAGES: Record<PlacementRejection, string> = {
  team_forbidden:
    'You’re not a member of that team, so the document can’t be filed in its library.',
  folder_not_found: 'That folder no longer exists, or isn’t yours.',
  folder_scope_mismatch: 'That folder belongs to a different space from the one you chose.',
  placement_invalid: 'That isn’t a place a document can be filed.',
};

const CONNECTION_FAILURE: CreateFailure = {
  action: 'retry',
  eyebrow: 'Connection error',
  title: 'Couldn’t create the document',
  message:
    'We couldn’t reach the server to create your document. Check your connection and try again.',
  actionLabel: 'Try again',
};

export function createFailureCopy(error: unknown): CreateFailure {
  const code = error instanceof ApiError ? error.code : null;
  if (!isPlacementRejection(code)) return CONNECTION_FAILURE;
  return {
    action: 'choose',
    eyebrow: 'Placement refused',
    title: 'Couldn’t file the document there',
    message: PLACEMENT_MESSAGES[code],
    actionLabel: 'Choose another place',
  };
}
