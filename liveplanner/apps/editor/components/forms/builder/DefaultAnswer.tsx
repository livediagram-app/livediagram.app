'use client';

// A question's Default Answer (docs/specs/030-forms/forms.md "A default answer"): what its answer is when a respondent
// leaves it empty. Only a question that is not Required has one (a Required one is never empty), and never a Checkbox
// (unticked is its answer) or a Date Range. A small toggle at the top right of the selected card's answer area turns
// the area into the question's own control, as respondents answer it, and back. Kept only once it is an answer the
// question accepts. Each change one undo step: a typed one when the field is left.
import { useId, useState, type ReactNode } from 'react';
import { Tooltip } from '@liveplanner/ui';
import { checkAnswer, updateQuestion, type FormQuestion } from '@liveplanner/forms';
import { QuestionControl } from '../QuestionControl';
import { useFormBuilder } from './form-builder-context';

// The types whose answer is picked (saved as it changes) rather than typed (saved when the field is left).
const PICKED = new Set<FormQuestion['type']>(['single', 'multi', 'rating', 'colour']);

export const takesDefault = (q: FormQuestion): boolean =>
  !q.required && q.type !== 'checkbox' && q.type !== 'daterange' && q.type !== 'content';

// The selected card's answer area: the placeholder (or the options, or the control as respondents see it), and for a
// question that takes a default, the Default Answer toggle at its top right. Off each time the card is selected; a dot
// says a default is set.
export function AnswerArea({
  question: q,
  children,
}: {
  question: FormQuestion;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (!takesDefault(q)) return <>{children}</>;
  const set = q.fallback !== undefined;
  return (
    <div className="relative">
      <div className="absolute -top-3 right-2 z-[1]">
        <Tooltip
          label={
            editing
              ? q.type === 'single' || q.type === 'multi'
                ? 'Back to the Options'
                : 'Back to the Question'
              : 'Set an Answer Used When This Is Left Empty'
          }
        >
          <button
            type="button"
            aria-pressed={editing}
            onClick={() => setEditing((e) => !e)}
            className={`flex h-6 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              editing
                ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {set && !editing ? (
              <span aria-hidden className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-300" />
            ) : null}
            <span className="text-optical-centre">Default Answer</span>
            {set && !editing ? <span className="sr-only">(set)</span> : null}
          </button>
        </Tooltip>
      </div>
      {editing ? <DefaultAnswerEditor question={q} /> : children}
    </div>
  );
}

function DefaultAnswerEditor({ question: q }: { question: FormQuestion }) {
  const b = useFormBuilder();
  const id = useId();
  const [draft, setDraft] = useState<unknown>(q.fallback);
  const [bad, setBad] = useState(false);
  // A default changed elsewhere (undo, a peer) replaces the draft, during render rather than in an effect.
  const [seen, setSeen] = useState(q.fallback);
  if (seen !== q.fallback) {
    setSeen(q.fallback);
    setDraft(q.fallback);
    setBad(false);
  }
  // The question as the control draws it here: never required, no Other box, no default of its own.
  const asked: FormQuestion = { ...q, required: undefined, other: undefined, fallback: undefined };
  const save = (value: unknown) => {
    const checked = checkAnswer(asked, value);
    if (checked.error) {
      setBad(true);
      return;
    }
    setBad(false);
    const next =
      typeof checked.value === 'string' ||
      typeof checked.value === 'number' ||
      Array.isArray(checked.value)
        ? checked.value
        : undefined;
    if (JSON.stringify(next) === JSON.stringify(q.fallback)) return;
    b.actions.changeForm((f) => updateQuestion(f, q.id, { fallback: next }));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label id={`${id}-label`} htmlFor={`${id}-control`} className="sr-only">
        Default Answer
      </label>
      <QuestionControl
        question={asked}
        value={draft}
        other=""
        onChange={(v) => {
          setDraft(v);
          if (PICKED.has(q.type)) save(v);
        }}
        onOther={() => {}}
        onBlur={() => {
          if (!PICKED.has(q.type)) save(draft);
        }}
        invalid={bad}
        labelledBy={`${id}-label`}
        describedBy={`${id}-hint`}
        controlId={`${id}-control`}
      />
      <div className="flex items-center gap-2">
        <p
          id={`${id}-hint`}
          className={`flex-1 text-[12px] ${bad ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {bad
            ? 'That isn’t an answer this question accepts.'
            : 'Default Answer: used when someone leaves this question empty.'}
        </p>
        {q.fallback !== undefined ? (
          <button
            type="button"
            onClick={() => {
              setDraft(undefined);
              setBad(false);
              b.actions.changeForm((f) => updateQuestion(f, q.id, { fallback: undefined }));
            }}
            className="cursor-pointer rounded px-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
