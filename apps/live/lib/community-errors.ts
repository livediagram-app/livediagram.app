import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_DESCRIPTION_MIN,
  COMMUNITY_POSTS_PER_AUTHOR,
  COMMUNITY_TAG_MAX,
  COMMUNITY_TAG_MIN,
  COMMUNITY_TAGS_MAX,
  COMMUNITY_TITLE_MAX,
  COMMUNITY_TITLE_MIN,
} from '@livediagram/api-schema';
import { ApiError } from './api/core';

// The words the editor shows for each Community refusal (docs/specs/025-community/blueprints/
// community.md §4 rejections, §6 edge cases, §9 copy). One table for the client-side validation
// (`validateCommunityPostInput`'s codes) and the worker's answers, so the two never word the same rule
// differently.
const MESSAGES: Record<string, string> = {
  sign_in_required: 'Sign in to share your document with the Community.',
  team_document: "Team library documents can't be shared to the Community.",
  share_password_set:
    'This document has a share password. Remove the password to share it to the Community.',
  empty_document: 'Add something to your document before sharing it.',
  post_limit: `You have ${COMMUNITY_POSTS_PER_AUTHOR} documents in the Community already. Remove one to share another.`,
  invalid_title: `The title needs ${COMMUNITY_TITLE_MIN} to ${COMMUNITY_TITLE_MAX} characters.`,
  invalid_description: `The description needs ${COMMUNITY_DESCRIPTION_MIN} to ${COMMUNITY_DESCRIPTION_MAX} characters.`,
  invalid_category: 'Choose a category.',
  invalid_tags: `Tags are ${COMMUNITY_TAG_MIN} to ${COMMUNITY_TAG_MAX} letters, numbers or hyphens, up to ${COMMUNITY_TAGS_MAX} of them.`,
  community_published: 'Remove it from the Community to set a password.',
  operator_only: 'Only operators can moderate Community.',
};

const RATE_LIMITED = 'That was a lot at once. Try again in a minute.';
const FALLBACK = "We couldn't reach the Community. Try again.";

// The message for a refusal code (from validation or the worker), or the fallback.
export function communityCodeMessage(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK;
}

// The message for whatever a Community call threw: the worker's code when it sent one, a rate limit
// as such, anything else (network, 5xx) as the fallback.
export function communityErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && MESSAGES[err.code]) return MESSAGES[err.code]!;
    if (err.status === 429) return RATE_LIMITED;
  }
  return FALLBACK;
}
