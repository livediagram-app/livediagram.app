// The card a failed create on /new shows (docs/specs/007-editor/new-document-route.md "Placement
// rides the create"). A refused placement will not clear on a retry, so it says why and offers
// another place; any other failure keeps the connection copy and Try again.

import { isPlacementRejection, type PlacementRejection } from '@liveknowledge/api-schema';
import { TIER_LIMITS } from '@liveworkspace/subscription';
import { ApiError } from '@/lib/api-client';
import { pagesTierOf } from '@/lib/knowledge-import/import-trim';

export type CreateFailure = {
  // `retry` re-runs the same create; `choose` reopens /new without the refused placement; `explorer` goes back to the
  // Explorer, for a refusal no retry or other place clears.
  action: 'retry' | 'choose' | 'explorer';
  eyebrow: string;
  title: string;
  message: string;
  actionLabel: string;
};

const PLACEMENT_MESSAGES: Record<PlacementRejection, string> = {
  team_forbidden:
    'You’re not a member of that team, so the knowledgebase can’t be filed in its library.',
  folder_not_found: 'That folder no longer exists, or isn’t yours.',
  folder_scope_mismatch: 'That folder belongs to a different space from the one you chose.',
  placement_invalid: 'That isn’t a place a knowledgebase can be filed.',
};

const CONNECTION_FAILURE: CreateFailure = {
  action: 'retry',
  eyebrow: 'Connection error',
  title: 'Couldn’t create the knowledgebase',
  message:
    'We couldn’t reach the server to create your knowledgebase. Check your connection and try again.',
  actionLabel: 'Try again',
};

const count = (n: number) => n.toLocaleString('en-US');

// The owner's Knowledgebase Pages are all held (docs/specs/030-knowledgebase/tiers.md "Knowledgebase Pages"): a new
// knowledgebase starts with a page, so there is no room for it. Never the connection: a retry is refused again.
function pagesFullCopy(body: unknown): CreateFailure {
  const max =
    typeof body === 'object' && body !== null && typeof (body as { max?: unknown }).max === 'number'
      ? (body as { max: number }).max
      : null;
  const tier = max === null ? null : pagesTierOf(max);
  const held = max === null ? 'all the pages your plan holds' : `${count(max)} pages`;
  const pro = tier === 'free' ? ` Pro holds ${count(TIER_LIMITS.pro.knowledgebasePages)}.` : '';
  return {
    action: 'explorer',
    eyebrow: 'Knowledgebases full',
    title: 'No room for another knowledgebase',
    message: `Your Knowledgebases hold ${held}, the most your plan keeps, and a new one starts with a page. Delete pages you no longer need to make room.${pro}`,
    actionLabel: 'Back to Explorer',
  };
}

export function createFailureCopy(error: unknown): CreateFailure {
  const code = error instanceof ApiError ? error.code : null;
  if (code === 'page_limit' && error instanceof ApiError) return pagesFullCopy(error.body);
  if (!isPlacementRejection(code)) return CONNECTION_FAILURE;
  return {
    action: 'choose',
    eyebrow: 'Placement refused',
    title: 'Couldn’t file the knowledgebase there',
    message: PLACEMENT_MESSAGES[code],
    actionLabel: 'Choose another place',
  };
}

// The ids a create writes under. Minted once per attempt and kept for its Retry: a create that
// reached the server but whose answer was lost would, retried under fresh ids, make a second
// document. Retried under the same ids, the api takes it as the re-commit of an id the caller
// already owns (docs/specs/007-editor/new-document-route.md "Retry").
export type CreateIds = { documentId: string; tabId: string };

export function createIdsFor(retrying: CreateIds | null): CreateIds {
  return retrying ?? { documentId: crypto.randomUUID(), tabId: crypto.randomUUID() };
}
