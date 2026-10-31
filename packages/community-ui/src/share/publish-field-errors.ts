import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_DESCRIPTION_MIN,
  COMMUNITY_TITLE_MAX,
  COMMUNITY_TITLE_MIN,
  communityInputErrorField,
  communityPostInputErrors,
  type CommunityInputField,
} from '@liveworkspace/community';
import { communityCodeMessage } from './community-errors';
import type { CommunityWords } from './host';

// The publish dialog's per-field messages (docs/specs/025-community/blueprints/community.md §9): what is
// wrong with each field, said where the field is and specific enough to fix it ("Add 7 more
// characters"), from the same validator the worker runs.

export type PublishFieldErrors = Partial<Record<CommunityInputField, string>>;

type PublishDraft = {
  title: string;
  description: string;
  category: string | null;
  tags: string[];
};

function titleMessage(title: string, words: CommunityWords): string {
  const length = title.trim().replace(/\s+/g, ' ').length;
  if (length === 0) return `Give your ${words.noun} a title.`;
  if (length < COMMUNITY_TITLE_MIN) return `Use at least ${COMMUNITY_TITLE_MIN} characters.`;
  return `Keep it to ${COMMUNITY_TITLE_MAX} characters.`;
}

function descriptionMessage(description: string, words: CommunityWords): string {
  const length = description.trim().length;
  if (length === 0) {
    return `Describe your ${words.noun} in at least ${COMMUNITY_DESCRIPTION_MIN} characters.`;
  }
  if (length < COMMUNITY_DESCRIPTION_MIN) {
    const more = COMMUNITY_DESCRIPTION_MIN - length;
    return `Add ${more} more character${more === 1 ? '' : 's'} (at least ${COMMUNITY_DESCRIPTION_MIN}).`;
  }
  return `Keep it to ${COMMUNITY_DESCRIPTION_MAX} characters.`;
}

// The same words as the worker's refusal codes, so the field and a server answer agree.
const fieldMessage = (code: 'invalid_category' | 'invalid_tags', words: CommunityWords) =>
  communityCodeMessage(code, words);

// Every failing field's message, keyed by field; empty when the draft is valid.
export function publishFieldErrors(draft: PublishDraft, words: CommunityWords): PublishFieldErrors {
  const errors: PublishFieldErrors = {};
  for (const code of communityPostInputErrors(draft)) {
    const field = communityInputErrorField(code);
    if (field === 'title') errors.title = titleMessage(draft.title, words);
    if (field === 'description') errors.description = descriptionMessage(draft.description, words);
    if (field === 'category') errors.category = fieldMessage('invalid_category', words);
    if (field === 'tags') errors.tags = fieldMessage('invalid_tags', words);
  }
  return errors;
}

// A worker refusal about one field, worded like the dialog's own check of that field; null when the
// code is not about a field.
export function publishServerFieldError(
  code: string | null | undefined,
  draft: PublishDraft,
  words: CommunityWords,
): { field: CommunityInputField; message: string } | null {
  const field = communityInputErrorField(code);
  if (!field) return null;
  const message =
    field === 'title'
      ? titleMessage(draft.title, words)
      : field === 'description'
        ? descriptionMessage(draft.description, words)
        : field === 'category'
          ? fieldMessage('invalid_category', words)
          : fieldMessage('invalid_tags', words);
  return { field, message };
}
