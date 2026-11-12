'use client';

// The answer control a respondent sees for each question type (docs/specs/030-forms/forms.md "Question types"):
// shared by the form link's page, Preview and the builder (where it is drawn disabled), so a form looks the same
// wherever it is seen. Carries no editor code: the form page imports it. The form colour arrives as the CSS variable
// `--form-accent` on an ancestor.
import { useLayoutEffect, useRef } from 'react';
import {
  DROPDOWN_AFTER,
  PARAGRAPH_MAX,
  RATING_SCALE_DEFAULT,
  SHORT_ANSWER_MAX,
  type PublicQuestion,
} from '@liveplanner/forms';
import { fromLocalInput, localInputValue } from '@liveplanner/items';
import { RatingInput } from './RatingInput';
import { FIELD, FIELD_BAD, FIELD_OK } from './answer-field';
import { Choices, Dropdown, RangeAnswer } from './question-answers';

// A text answer's box as respondents see it, for the builder's placeholder field to wear the same.
export { ANSWER_FIELD } from './answer-field';

type QuestionControlProps = {
  question: PublicQuestion;
  value: unknown;
  other: string;
  onChange: (value: unknown) => void;
  onOther: (text: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  // The ids of the prompt, the help and the error, for the control's name and description.
  labelledBy: string;
  describedBy?: string;
  // The id the prompt's label points at, for a single control.
  controlId: string;
};

// What a text answer's box says before anything is typed: its own placeholder, else the type's hint.
export function placeholderHint(q: PublicQuestion): string {
  if (q.type === 'number') return numberHint(q);
  if (q.type === 'email') return 'name@example.com';
  if (q.type === 'link') return 'https://';
  if (q.type === 'phone') return '+44 20 7946 0958';
  return 'Your answer';
}

// A text area that grows with what is typed, up to a limit, then scrolls.
function GrowingText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // Its borders are added (a border box), whatever the finish draws them at.
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 360)}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={3} {...props} />;
}

export function QuestionControl({
  question: q,
  value,
  other,
  onChange,
  onOther,
  onBlur,
  disabled = false,
  invalid = false,
  labelledBy,
  describedBy,
  controlId,
}: QuestionControlProps) {
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const field = `${FIELD} ${invalid ? FIELD_BAD : FIELD_OK}`;
  const common = {
    id: controlId,
    disabled,
    onBlur,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    'aria-required': q.required || undefined,
  };
  switch (q.type) {
    case 'short':
      return (
        <input
          {...common}
          type="text"
          className={field}
          value={text}
          maxLength={SHORT_ANSWER_MAX}
          placeholder={q.placeholder ?? placeholderHint(q)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'paragraph':
      return (
        <GrowingText
          {...common}
          className={`${field} resize-none leading-relaxed`}
          value={text}
          maxLength={PARAGRAPH_MAX}
          placeholder={q.placeholder ?? placeholderHint(q)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          {...common}
          type="text"
          inputMode={q.whole ? 'numeric' : 'decimal'}
          className={`${field} max-w-xs tabular-nums`}
          value={text}
          placeholder={q.placeholder ?? placeholderHint(q)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'email':
      return (
        <input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={field}
          value={text}
          placeholder={q.placeholder ?? placeholderHint(q)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'link':
      return (
        <input
          {...common}
          type="url"
          inputMode="url"
          className={field}
          value={text}
          placeholder={q.placeholder ?? placeholderHint(q)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'phone':
      return (
        <input
          {...common}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={`${field} max-w-xs tabular-nums`}
          value={text}
          maxLength={32}
          placeholder={q.placeholder ?? placeholderHint(q)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return (
        <input
          {...common}
          type="date"
          className={`${field} max-w-xs`}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    // A moment in the respondent's own zone, sent as its UTC instant with that zone (forms.md "Question types").
    case 'datetime':
      return (
        <input
          {...common}
          type="datetime-local"
          step={60}
          className={`${field} max-w-xs tabular-nums`}
          value={localInputValue(text)}
          onChange={(e) => onChange(fromLocalInput(e.target.value) ?? '')}
        />
      );
    case 'daterange':
      return (
        <RangeAnswer
          {...{ q, value, onChange, onBlur, disabled, invalid, labelledBy, describedBy, controlId }}
        />
      );
    case 'single':
      return (q.options?.length ?? 0) > DROPDOWN_AFTER || q.dropdown ? (
        <Dropdown
          {...{
            q,
            value: text,
            other,
            onChange,
            onOther,
            onBlur,
            disabled,
            invalid,
            describedBy,
            controlId,
          }}
        />
      ) : (
        <Choices
          {...{
            q,
            multi: false,
            value,
            other,
            onChange,
            onOther,
            onBlur,
            disabled,
            invalid,
            labelledBy,
            describedBy,
          }}
        />
      );
    case 'multi':
      return (
        <Choices
          {...{
            q,
            multi: true,
            value,
            other,
            onChange,
            onOther,
            onBlur,
            disabled,
            invalid,
            labelledBy,
            describedBy,
          }}
        />
      );
    case 'rating':
      return (
        <RatingInput
          label={q.prompt || 'Rating'}
          value={typeof value === 'number' ? value : undefined}
          scale={q.scale ?? RATING_SCALE_DEFAULT}
          style={q.style}
          lowLabel={q.lowLabel}
          highLabel={q.highLabel}
          size="lg"
          disabled={disabled}
          invalid={invalid}
          describedBy={describedBy}
          accent="var(--form-accent)"
          onChange={(n) => {
            onChange(n);
            onBlur?.();
          }}
        />
      );
    case 'checkbox':
      return (
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-slate-800 dark:text-slate-100">
          <input
            {...common}
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--form-accent)] disabled:cursor-not-allowed"
            checked={value === true}
            aria-labelledby={labelledBy}
            onChange={(e) => {
              onChange(e.target.checked);
              onBlur?.();
            }}
          />
          <span className="sr-only">{q.prompt}</span>
          <span aria-hidden className="text-slate-600 dark:text-slate-300">
            {q.required ? 'Required' : 'Tick if it applies'}
          </span>
        </label>
      );
  }
}

function numberHint(q: PublicQuestion): string {
  if (q.min !== undefined && q.max !== undefined) return `${q.min} to ${q.max}`;
  if (q.min !== undefined) return `${q.min} or more`;
  if (q.max !== undefined) return `Up to ${q.max}`;
  return q.whole ? 'A whole number' : 'A number';
}
