'use client';

// The answer control a respondent sees for each question type (docs/specs/030-forms/forms.md "Question types"):
// shared by the form link's page, Preview and the builder (where it is drawn disabled), so a form looks the same
// wherever it is seen. Carries no editor code: the form page imports it. The form colour arrives as the CSS variable
// `--form-accent` on an ancestor.
import { useId, useLayoutEffect, useRef } from 'react';
import {
  DROPDOWN_AFTER,
  OTHER_ANSWER,
  OTHER_MAX,
  PARAGRAPH_MAX,
  RATING_SCALE_DEFAULT,
  SHORT_ANSWER_MAX,
  type PublicQuestion,
} from '@livediagram/forms';
import { RatingInput } from './RatingInput';

export type QuestionControlProps = {
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

const FIELD =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--form-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--form-accent)_30%,transparent)] disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:disabled:bg-slate-900/60';
const FIELD_OK = 'border-slate-300 dark:border-slate-600';
const FIELD_BAD = 'border-red-500 dark:border-red-400';

// A text area that grows with what is typed, up to a limit, then scrolls.
function GrowingText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 360)}px`;
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
          placeholder={q.placeholder ?? 'Your answer'}
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
          placeholder={q.placeholder ?? 'Your answer'}
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
          placeholder={q.placeholder ?? numberHint(q)}
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
          placeholder={q.placeholder ?? 'name@example.com'}
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
          placeholder={q.placeholder ?? 'https://'}
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

// Radio buttons or checkboxes, each option a row the whole width can be clicked on, with Other and its text.
function Choices({
  q,
  multi,
  value,
  other,
  onChange,
  onOther,
  onBlur,
  disabled,
  invalid,
  labelledBy,
  describedBy,
}: {
  q: PublicQuestion;
  multi: boolean;
  value: unknown;
  other: string;
  onChange: (v: unknown) => void;
  onOther: (t: string) => void;
  onBlur?: () => void;
  disabled: boolean;
  invalid: boolean;
  labelledBy: string;
  describedBy?: string;
}) {
  const name = useId();
  const picks = multi
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : typeof value === 'string' && value
      ? [value]
      : [];
  const options = [...(q.options ?? [])];
  const pick = (o: string, on: boolean) => {
    if (!multi) {
      onChange(on ? o : '');
      onBlur?.();
      return;
    }
    const next = on ? [...picks.filter((p) => p !== o), o] : picks.filter((p) => p !== o);
    // Kept in option order, Other last.
    const order = [...options, OTHER_ANSWER];
    onChange(order.filter((x) => next.includes(x)));
  };
  const hint =
    multi && (q.min !== undefined || q.max !== undefined)
      ? q.min !== undefined && q.max !== undefined
        ? q.min === q.max
          ? `Pick ${q.min}`
          : `Pick ${q.min} to ${q.max}`
        : q.min !== undefined
          ? `Pick at least ${q.min}`
          : `Pick up to ${q.max}`
      : null;
  const row = (on: boolean) =>
    `flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[15px] transition ${
      on
        ? 'border-[var(--form-accent)] bg-[color-mix(in_srgb,var(--form-accent)_8%,transparent)] text-slate-900 dark:text-slate-50'
        : `${invalid ? 'border-red-300 dark:border-red-500/50' : 'border-slate-200 dark:border-slate-700'} text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800/60`
    } ${disabled ? 'pointer-events-none opacity-70' : ''}`;
  const input = 'h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--form-accent)]';
  const otherOn = picks.includes(OTHER_ANSWER);
  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required={q.required || undefined}
      className="flex flex-col gap-2"
    >
      {hint ? <p className="text-[13px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {options.map((o) => {
        const on = picks.includes(o);
        return (
          <label key={o} className={row(on)}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={name}
              className={input}
              checked={on}
              disabled={disabled}
              onChange={(e) => pick(o, e.target.checked)}
            />
            <span className="min-w-0 break-words">{o}</span>
          </label>
        );
      })}
      {q.other ? (
        <label className={row(otherOn)}>
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={name}
            className={input}
            checked={otherOn}
            disabled={disabled}
            onChange={(e) => pick(OTHER_ANSWER, e.target.checked)}
          />
          <span className="shrink-0">Other:</span>
          <input
            type="text"
            aria-label="Other, your answer"
            className="min-w-0 flex-1 border-b border-slate-300 bg-transparent py-0.5 text-[15px] outline-none focus:border-[var(--form-accent)] dark:border-slate-600"
            value={other}
            maxLength={OTHER_MAX}
            disabled={disabled}
            onChange={(e) => {
              onOther(e.target.value);
              // Typing an Other answer picks Other.
              if (e.target.value && !otherOn) pick(OTHER_ANSWER, true);
            }}
            onBlur={onBlur}
          />
        </label>
      ) : null}
    </div>
  );
}

function Dropdown({
  q,
  value,
  other,
  onChange,
  onOther,
  onBlur,
  disabled,
  invalid,
  describedBy,
  controlId,
}: {
  q: PublicQuestion;
  value: string;
  other: string;
  onChange: (v: unknown) => void;
  onOther: (t: string) => void;
  onBlur?: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  controlId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <select
        id={controlId}
        className={`${FIELD} ${invalid ? FIELD_BAD : FIELD_OK} max-w-md cursor-pointer`}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={q.required || undefined}
        onChange={(e) => {
          onChange(e.target.value);
          onBlur?.();
        }}
      >
        <option value="">Choose…</option>
        {(q.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {q.other ? <option value={OTHER_ANSWER}>Other…</option> : null}
      </select>
      {value === OTHER_ANSWER ? (
        <input
          type="text"
          aria-label="Other, your answer"
          className={`${FIELD} ${FIELD_OK} max-w-md`}
          value={other}
          maxLength={OTHER_MAX}
          disabled={disabled}
          onChange={(e) => onOther(e.target.value)}
          onBlur={onBlur}
        />
      ) : null}
    </div>
  );
}
