import { COMMUNITY_TAGS_MAX, normaliseCommunityTag } from '@livediagram/api-schema';

// The pure half of the publish dialog's tag field (docs/specs/025-community/community.md "Tags"):
// what typing, a comma, Enter or a paste does to the chips. The same `normaliseCommunityTag` the worker
// runs decides what a tag is, so a chip the dialog accepts is one the worker accepts.

// Why a draft did not become a chip, for the hint under the field.
export type TagRejection = 'invalid' | 'duplicate' | 'full';

export type TagCommit = { tags: string[]; rejected: TagRejection | null };

// Add one typed tag. Blank drafts are ignored silently (Enter on an empty field is not a mistake).
export function commitTag(tags: string[], draft: string): TagCommit {
  if (!draft.trim()) return { tags, rejected: null };
  const tag = normaliseCommunityTag(draft);
  if (!tag) return { tags, rejected: 'invalid' };
  if (tags.includes(tag)) return { tags, rejected: 'duplicate' };
  if (tags.length >= COMMUNITY_TAGS_MAX) return { tags, rejected: 'full' };
  return { tags: [...tags, tag], rejected: null };
}

// A field value that may hold commas (typed or pasted): every complete piece before the last comma is
// committed in turn, and what follows it stays in the field. The first rejection is the one reported.
export function commitTagInput(
  tags: string[],
  value: string,
): { tags: string[]; draft: string; rejected: TagRejection | null } {
  const pieces = value.split(',');
  const draft = pieces.pop() ?? '';
  let next = tags;
  let rejected: TagRejection | null = null;
  for (const piece of pieces) {
    const result = commitTag(next, piece);
    next = result.tags;
    rejected ??= result.rejected;
  }
  return { tags: next, draft, rejected };
}

// What a draft would be added as, shown live beside the field so the normalising is no surprise;
// null when it would be rejected or is blank.
export function tagPreview(draft: string): string | null {
  return draft.trim() ? normaliseCommunityTag(draft) : null;
}
