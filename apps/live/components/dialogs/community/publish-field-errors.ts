import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_DESCRIPTION_MIN,
  COMMUNITY_TAG_MAX,
  COMMUNITY_TAG_MIN,
  COMMUNITY_TAGS_MAX,
  COMMUNITY_TITLE_MAX,
  COMMUNITY_TITLE_MIN,
  communityInputErrorField,
  communityPostInputErrors,
  type CommunityInputField,
} from '@livediagram/api-schema';

// The publish dialog's per-field messages (docs/specs/025-community/blueprints/community.md §9): what is
// wrong with each field, said where the field is and specific enough to fix it ("Add 7 more
// characters"), from the same validator the worker runs.

export type PublishFieldErrors = Partial<Record<CommunityInputField, string>>;

export type PublishDraft = {
  title: string;
  description: string;
  category: string | null;
  tags: string[];
};

function titleMessage(title: string): string {
  const length = title.trim().replace(/\s+/g, ' ').length;
  if (length === 0) return 'Give your document a title.';
  if (length < COMMUNITY_TITLE_MIN) return `Use at least ${COMMUNITY_TITLE_MIN} characters.`;
  return `Keep it to ${COMMUNITY_TITLE_MAX} characters.`;
}

function descriptionMessage(description: string): string {
  const length = description.trim().length;
  if (length === 0) {
    return `Describe your document in at least ${COMMUNITY_DESCRIPTION_MIN} characters.`;
  }
  if (length < COMMUNITY_DESCRIPTION_MIN) {
    const more = COMMUNITY_DESCRIPTION_MIN - length;
    return `Add ${more} more character${more === 1 ? '' : 's'} (at least ${COMMUNITY_DESCRIPTION_MIN}).`;
  }
  return `Keep it to ${COMMUNITY_DESCRIPTION_MAX} characters.`;
}

const CATEGORY_MESSAGE = 'Choose the category that fits best.';
const TAGS_MESSAGE = `Tags are ${COMMUNITY_TAG_MIN} to ${COMMUNITY_TAG_MAX} letters, numbers or hyphens, up to ${COMMUNITY_TAGS_MAX} of them.`;

// Every failing field's message, keyed by field; empty when the draft is valid.
export function publishFieldErrors(draft: PublishDraft): PublishFieldErrors {
  const errors: PublishFieldErrors = {};
  for (const code of communityPostInputErrors(draft)) {
    const field = communityInputErrorField(code);
    if (field === 'title') errors.title = titleMessage(draft.title);
    if (field === 'description') errors.description = descriptionMessage(draft.description);
    if (field === 'category') errors.category = CATEGORY_MESSAGE;
    if (field === 'tags') errors.tags = TAGS_MESSAGE;
  }
  return errors;
}

// A worker refusal about one field, worded like the dialog's own check of that field; null when the
// code is not about a field.
export function publishServerFieldError(
  code: string | null | undefined,
  draft: PublishDraft,
): { field: CommunityInputField; message: string } | null {
  const field = communityInputErrorField(code);
  if (!field) return null;
  const message =
    field === 'title'
      ? titleMessage(draft.title)
      : field === 'description'
        ? descriptionMessage(draft.description)
        : field === 'category'
          ? CATEGORY_MESSAGE
          : TAGS_MESSAGE;
  return { field, message };
}
