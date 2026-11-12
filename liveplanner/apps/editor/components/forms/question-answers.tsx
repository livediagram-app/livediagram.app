'use client';

// The answers QuestionControl draws with more than one box (docs/specs/030-forms/forms.md "Question types"): the
// radio buttons or checkboxes of a choice with Other and its text, the dropdown, and a Date Range's From and To.

import { useId } from 'react';
import { OTHER_ANSWER, OTHER_MAX, type PublicQuestion } from '@liveplanner/forms';
import { fromLocalInput, localInputValue } from '@liveplanner/items';
import { FIELD, FIELD_BAD, FIELD_OK } from './answer-field';

// Radio buttons or checkboxes, each option a row the whole width can be clicked on, with Other and its text.
export function Choices({
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
    `form-box flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[15px] transition ${
      on
        ? 'border-[var(--form-accent)] bg-[color-mix(in_srgb,var(--form-accent)_8%,transparent)] text-slate-900 dark:text-slate-50'
        : `${invalid ? 'border-red-300 dark:border-red-500/50' : 'form-ink border-slate-200 dark:border-slate-700'} text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800/60`
    } ${disabled ? 'pointer-events-none opacity-70' : ''}`;
  const input = 'h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--form-accent)]';
  const otherOn = picks.includes(OTHER_ANSWER);
  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      // A radiogroup may say it is required; a group of checkboxes may not (ARIA), and its prompt already says
      // "(required)" to a screen reader.
      aria-required={(!multi && q.required) || undefined}
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

export function Dropdown({
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

// A Date Range question's From and To: two date boxes, or two date-and-time boxes when it includes times. Sends the
// two ends as a list, or nothing when both are empty; checking the answer says when one is missing or out of order.
export function RangeAnswer({
  q,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  labelledBy,
  describedBy,
  controlId,
}: {
  q: PublicQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  disabled: boolean;
  invalid: boolean;
  labelledBy: string;
  describedBy?: string;
  controlId: string;
}) {
  const ends: unknown[] = Array.isArray(value) ? value : [];
  const end = (i: number): string => {
    const v = ends[i];
    return typeof v === 'string' ? v : '';
  };
  const timed = q.withTime === true;
  const field = `${FIELD} ${invalid ? FIELD_BAD : FIELD_OK} tabular-nums`;
  const set = (i: number, raw: string) => {
    const v = timed ? (fromLocalInput(raw) ?? '') : raw;
    const next = i === 0 ? [v, end(1)] : [end(0), v];
    onChange(next[0] === '' && next[1] === '' ? [] : next);
  };
  const box = (i: number, word: string) => (
    <label className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
      <span className="form-ink text-[13px] font-medium text-slate-600 dark:text-slate-300">
        {word}
      </span>
      <input
        id={i === 0 ? controlId : `${controlId}-to`}
        type={timed ? 'datetime-local' : 'date'}
        step={timed ? 60 : undefined}
        disabled={disabled}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={q.required || undefined}
        className={field}
        value={timed ? localInputValue(end(i)) : end(i)}
        onChange={(e) => set(i, e.target.value)}
      />
    </label>
  );
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex max-w-lg flex-wrap gap-3">
      {box(0, 'From')}
      {box(1, 'To')}
    </div>
  );
}
