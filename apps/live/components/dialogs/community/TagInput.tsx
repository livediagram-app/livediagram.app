'use client';

import { useId, useRef, useState } from 'react';
import { COMMUNITY_TAG_MAX, COMMUNITY_TAG_MIN, COMMUNITY_TAGS_MAX } from '@livediagram/api-schema';
import { ChipField, type ChipFieldHandle } from '@/components/primitives/ChipField';
import { FieldError } from './FieldError';
import { commitTag, commitTagInput, tagPreview, type TagRejection } from './tag-draft';

// The publish dialog's tag field (docs/specs/025-community/community.md "Tags"): the shared ChipField
// with Community's tag rules. Enter or a comma adds the draft, Backspace in an empty field takes the last chip back, and
// each chip has its own remove button. The draft is shown as it will be stored while typing, and a
// rejected draft stays in the field with a hint saying why. Suggestions (the most used tags) add with
// one click.

const HINTS: Record<TagRejection, string> = {
  invalid: `Tags are ${COMMUNITY_TAG_MIN} to ${COMMUNITY_TAG_MAX} letters, numbers or hyphens.`,
  duplicate: 'That tag is already added.',
  full: `Up to ${COMMUNITY_TAGS_MAX} tags.`,
};

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  disabled = false,
  error,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  // Popular tags to offer; the ones already chosen are left out.
  suggestions?: string[];
  disabled?: boolean;
  // The field's validation message from the dialog's submit, shown under the field.
  error?: string;
}) {
  const [draft, setDraft] = useState('');
  const [rejected, setRejected] = useState<TagRejection | null>(null);
  // A chip's remove button, a Popular suggestion and the field itself (disabled once five tags are in)
  // can all leave the page under the focus that used them: the field puts focus back after each.
  const field = useRef<ChipFieldHandle>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const full = tags.length >= COMMUNITY_TAGS_MAX;
  const preview = tagPreview(draft);
  const offered = suggestions.filter((s) => !tags.includes(s)).slice(0, 8);

  const apply = (next: { tags: string[]; rejected: TagRejection | null }) => {
    if (next.tags !== tags) onChange(next.tags);
    setRejected(next.rejected);
  };

  // Enter and comma keep typing in the field; leaving it (blur) commits without pulling focus back.
  const commitDraft = ({ keepFocus = true }: { keepFocus?: boolean } = {}) => {
    if (keepFocus) field.current?.refocus();
    const result = commitTag(tags, draft);
    apply(result);
    if (!result.rejected) setDraft('');
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ChipField
        ref={field}
        chips={tags}
        chipText={(tag) => `#${tag}`}
        removeLabel={(tag) => `Remove tag ${tag}`}
        draft={draft}
        onDraftChange={(value) => {
          if (value.includes(',')) {
            const result = commitTagInput(tags, value);
            apply(result);
            setDraft(result.draft);
            return;
          }
          setDraft(value);
          setRejected(null);
        }}
        onCommit={() => commitDraft()}
        onRemove={(tag) => {
          onChange(tags.filter((t) => t !== tag));
          setRejected(null);
        }}
        onBlur={() => {
          if (draft.trim()) commitDraft({ keepFocus: false });
        }}
        disabled={disabled}
        inputDisabled={full}
        invalid={rejected !== null || !!error}
        id={inputId}
        placeholder={
          full ? 'That is all five' : tags.length ? 'Add another' : 'e.g. aws, onboarding'
        }
        ariaLabel="Tags"
        ariaDescribedBy={error ? `${errorId} ${hintId}` : hintId}
      />
      <p
        id={hintId}
        aria-live="polite"
        className={`text-xs ${rejected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {rejected
          ? HINTS[rejected]
          : preview && preview !== draft.trim()
            ? `Adds as #${preview}`
            : `Up to ${COMMUNITY_TAGS_MAX}. Press Enter or a comma to add one.`}
      </p>
      <FieldError id={errorId} message={error} />
      {offered.length > 0 && !full ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">Popular:</span>
          {offered.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => {
                field.current?.refocus();
                apply(commitTag(tags, tag));
              }}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
