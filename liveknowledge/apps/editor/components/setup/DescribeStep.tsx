'use client';

// Step 1 of Describe to Set Up (docs/specs/030-knowledgebase/describe-to-set-up.md "The flow"): what the
// knowledgebase is for, in the person's own words, with an example under the field and three chips that fill it.
import { useEffect, useId, useRef } from 'react';
import { TextArea } from '@liveknowledge/ui';
import { SETUP_MAX_DESCRIPTION_CHARS } from '@liveknowledge/knowledge';
import {
  DESCRIBE_CHIPS,
  DESCRIBE_COUNT_FROM,
  DESCRIBE_EXAMPLE,
  DESCRIBE_LABEL,
  describeHint,
} from '@/lib/knowledge-setup/setup-words';

const CHIP =
  'cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 motion-safe:transition-colors motion-safe:duration-micro hover:border-brand-400 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 pointer-coarse:min-h-11 pointer-coarse:px-4 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100';

export function DescribeStep({
  description,
  onChange,
  onSubmit,
  adding,
}: {
  description: string;
  onChange: (text: string) => void;
  /** Cmd or Ctrl and Enter in the field. */
  onSubmit: () => void;
  /** Describe to Add Pages: the words ask what to add. */
  adding: boolean;
}) {
  const fieldId = useId();
  const hintId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  // The dialog opens with the caret in the field.
  useEffect(() => field.current?.focus(), []);
  const length = description.trim().length;
  const hint = describeHint(length);
  const over = length > SETUP_MAX_DESCRIPTION_CHARS;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-setup-step="describe">
      <label htmlFor={fieldId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {adding ? 'What Pages Should Be Added?' : DESCRIBE_LABEL}
      </label>
      <TextArea
        ref={field}
        id={fieldId}
        value={description}
        rows={6}
        invalid={over}
        hintId={hintId}
        data-setup-description=""
        placeholder={adding ? 'What is missing, in your own words.' : 'In your own words.'}
        className="min-h-36 flex-1 resize-none leading-relaxed"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <div id={hintId} className="flex min-h-5 items-start justify-between gap-3 text-xs">
        <p
          className={over ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}
        >
          {hint ?? `For example: "${DESCRIBE_EXAMPLE}"`}
        </p>
        {length >= DESCRIBE_COUNT_FROM ? (
          <p
            aria-live="polite"
            data-setup-count=""
            className={`shrink-0 tabular-nums ${over ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {length.toLocaleString('en')} / {SETUP_MAX_DESCRIPTION_CHARS.toLocaleString('en')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600 dark:text-slate-400">Start From</span>
        {DESCRIBE_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className={CHIP}
            onClick={() => {
              onChange(chip.text);
              field.current?.focus();
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
