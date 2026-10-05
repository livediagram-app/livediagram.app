'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { COMMUNITY_TAG_MAX, COMMUNITY_TAG_MIN, COMMUNITY_TAGS_MAX } from '@livediagram/api-schema';
import { CloseIcon } from '@livediagram/ui';
import { FieldError } from './FieldError';
import { commitTag, commitTagInput, tagPreview, type TagRejection } from './tag-draft';

// The publish dialog's tag field (docs/specs/025-community/community.md "Tags"): chips typed into one
// field. Enter or a comma adds the draft, Backspace in an empty field takes the last chip back, and
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
  // A chip's own remove button, a Popular suggestion and the input itself (disabled once five tags are in) can all
  // leave the page under the focus that used them: after each, focus comes back to the input, or to the last chip's
  // remove button while the input is full, rather than falling out of the dialog.
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const input = inputRef.current;
    if (input && !input.disabled) {
      input.focus();
      return;
    }
    const removers = boxRef.current?.querySelectorAll<HTMLButtonElement>('button[data-remove-tag]');
    removers?.[removers.length - 1]?.focus();
  });
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
    refocus.current = keepFocus;
    const result = commitTag(tags, draft);
    apply(result);
    if (!result.rejected) setDraft('');
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={boxRef}
        className={`flex flex-wrap items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:bg-slate-900 ${
          rejected || error
            ? 'border-rose-400 ring-2 ring-rose-100 dark:border-rose-400/70 dark:ring-rose-500/20'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
          >
            #{tag}
            <button
              type="button"
              onClick={() => {
                refocus.current = true;
                onChange(tags.filter((t) => t !== tag));
                setRejected(null);
              }}
              disabled={disabled}
              data-remove-tag
              aria-label={`Remove tag ${tag}`}
              className="flex h-4 w-4 items-center justify-center rounded-full text-brand-500 transition hover:bg-brand-100 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-brand-500/25 dark:hover:text-brand-100"
            >
              <CloseIcon size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          disabled={disabled || full}
          onChange={(e) => {
            const value = e.target.value;
            if (value.includes(',')) {
              const result = commitTagInput(tags, value);
              apply(result);
              setDraft(result.draft);
              return;
            }
            setDraft(value);
            setRejected(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Never submits the dialog's form: Enter here means "add this tag".
              e.preventDefault();
              commitDraft();
            } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
              e.preventDefault();
              onChange(tags.slice(0, -1));
              setRejected(null);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commitDraft({ keepFocus: false });
          }}
          placeholder={
            full ? 'That is all five' : tags.length ? 'Add another' : 'e.g. aws, onboarding'
          }
          aria-label="Tags"
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          aria-invalid={rejected !== null || !!error}
          autoComplete="off"
          spellCheck={false}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100"
        />
      </div>
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
                refocus.current = true;
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
