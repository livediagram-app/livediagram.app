import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_DESCRIPTION_MIN,
  COMMUNITY_POSTS_PER_AUTHOR,
  COMMUNITY_TAG_MAX,
  COMMUNITY_TAG_MIN,
  COMMUNITY_TAGS_MAX,
  COMMUNITY_TITLE_MAX,
  COMMUNITY_TITLE_MIN,
} from '@liveworkspace/community';
import type { CommunityWords } from './host';

// The words the editor shows for each Community refusal (docs/specs/025-community/blueprints/
// community.md §4 rejections, §6 edge cases, §9 copy). One table for the client-side validation
// (`validateCommunityPostInput`'s codes) and the worker's answers, so the two never word the same rule
// differently.
function messages(words: CommunityWords): Record<string, string> {
  const { noun, nouns } = words;
  return {
    sign_in_required: `Sign in to share your ${noun} with the Community.`,
    team_document: `Team library ${nouns} can't be shared to the Community.`,
    share_password_set: `This ${noun} has a share password. Remove the password to share it to the Community.`,
    empty_document:
      'Add something to your first tab before sharing: it is the picture on your Community card.',
    post_limit: `You have ${COMMUNITY_POSTS_PER_AUTHOR} ${nouns} in the Community already, counting any hidden after reports. Remove a listed one to share another.`,
    already_published: `This ${noun} is already in the Community. Reopen Share to see it.`,
    post_hidden: 'This post was hidden after reports, so it can no longer be changed or removed.',
    invalid_title: `The title needs ${COMMUNITY_TITLE_MIN} to ${COMMUNITY_TITLE_MAX} characters.`,
    invalid_description: `The description needs ${COMMUNITY_DESCRIPTION_MIN} to ${COMMUNITY_DESCRIPTION_MAX} characters.`,
    invalid_category: 'Choose the category that fits best.',
    invalid_tags: `Tags are ${COMMUNITY_TAG_MIN} to ${COMMUNITY_TAG_MAX} letters, numbers or hyphens, up to ${COMMUNITY_TAGS_MAX} of them.`,
    community_published: 'Remove it from the Community to set a password.',
  };
}

const RATE_LIMITED = 'That was a lot at once. Try again in a minute.';
const FALLBACK = "We couldn't reach the Community. Try again.";

// The message for a refusal code (from validation or the worker), or the fallback.
export function communityCodeMessage(
  code: string | null | undefined,
  words: CommunityWords,
): string {
  return (code && messages(words)[code]) || FALLBACK;
}

// What a refusal carries: the app's ApiError (or any error) with the HTTP status and the worker's code.
export function communityErrorCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

function communityErrorStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

// The message for whatever a Community call threw: the worker's code when it sent one, a rate limit
// as such, anything else (network, 5xx) as the fallback.
export function communityErrorMessage(err: unknown, words: CommunityWords): string {
  const status = communityErrorStatus(err);
  if (status !== null) {
    const code = communityErrorCode(err);
    const message = code ? messages(words)[code] : undefined;
    if (message) return message;
    if (status === 429) return RATE_LIMITED;
  }
  return FALLBACK;
}
