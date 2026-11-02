'use client';

// A text question's answer box in its selected card (docs/specs/030-forms/forms.md "Question types"): the box as
// respondents see it, its placeholder typed straight into it (grey, as it will show), so the field and its placeholder
// are one thing. Emptied, it shows the type's own hint, which is what respondents then see.
import { PLACEHOLDER_MAX, type FormQuestion } from '@liveplanner/forms';
import { updateQuestion } from '@liveplanner/forms';
import { ANSWER_FIELD, placeholderHint } from '../QuestionControl';
import { DraftText } from './DraftText';
import { useFormBuilder } from './form-builder-context';

const PLACEHOLDER_TYPES: ReadonlySet<FormQuestion['type']> = new Set([
  'short',
  'paragraph',
  'number',
  'email',
  'link',
  'phone',
]);

export const takesPlaceholder = (q: FormQuestion): boolean => PLACEHOLDER_TYPES.has(q.type);

export function PlaceholderField({ question: q }: { question: FormQuestion }) {
  const b = useFormBuilder();
  const paragraph = q.type === 'paragraph';
  return (
    <div className="flex flex-col gap-1">
      <div
        className={`${ANSWER_FIELD} cursor-text text-slate-400 focus-within:border-[var(--form-accent)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--form-accent)_30%,transparent)] dark:text-slate-400 ${
          paragraph ? 'min-h-[5.5rem]' : ''
        } ${q.type === 'number' ? 'max-w-xs' : ''}`}
      >
        <DraftText
          value={q.placeholder ?? ''}
          placeholder={placeholderHint(q)}
          maxLength={PLACEHOLDER_MAX}
          multiline={paragraph}
          label="Placeholder"
          className="w-full bg-transparent text-[15px] text-slate-400 dark:text-slate-400"
          onSave={(text) =>
            b.actions.changeForm((f) =>
              updateQuestion(f, q.id, { placeholder: text.trim() || undefined }),
            )
          }
        />
      </div>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Placeholder: shown in the box until someone types.
      </p>
    </div>
  );
}
