'use client';

// A question's Default Answer (docs/specs/030-forms/forms.md "A default answer"): what its answer is when a respondent
// leaves it empty. Only a question that is not Required has one (a Required one is never empty), and never a Checkbox
// (unticked is its answer) or a Date Range. Set with the question's own control, as respondents answer it; kept only
// once it is an answer the question accepts. Each change one undo step: a typed one when the field is left.
import { useId, useState } from 'react';
import { checkAnswer, updateQuestion, type FormQuestion } from '@liveplanner/forms';
import { QuestionControl } from '../QuestionControl';
import { useFormBuilder } from './form-builder-context';

// The types whose answer is picked (saved as it changes) rather than typed (saved when the field is left).
const PICKED = new Set<FormQuestion['type']>(['single', 'multi', 'rating', 'colour']);

export const takesDefault = (q: FormQuestion): boolean =>
  !q.required && q.type !== 'checkbox' && q.type !== 'daterange' && q.type !== 'content';

export function DefaultAnswer({ question: q }: { question: FormQuestion }) {
  const b = useFormBuilder();
  const id = useId();
  const [open, setOpen] = useState(q.fallback !== undefined);
  const [draft, setDraft] = useState<unknown>(q.fallback);
  const [bad, setBad] = useState(false);
  // A default changed elsewhere (undo, a peer) replaces the draft, during render rather than in an effect.
  const [seen, setSeen] = useState(q.fallback);
  if (seen !== q.fallback) {
    setSeen(q.fallback);
    setDraft(q.fallback);
    setBad(false);
    if (q.fallback !== undefined) setOpen(true);
  }
  // The question as the control draws it here: never required, no Other box, no default of its own.
  const asked: FormQuestion = { ...q, required: undefined, other: undefined, fallback: undefined };
  const save = (value: unknown) => {
    const checked = checkAnswer(asked, value);
    const empty = checked.value === undefined;
    if (checked.error) {
      setBad(true);
      return;
    }
    setBad(false);
    const next =
      empty ||
      !(
        typeof checked.value === 'string' ||
        typeof checked.value === 'number' ||
        Array.isArray(checked.value)
      )
        ? undefined
        : checked.value;
    if (JSON.stringify(next) === JSON.stringify(q.fallback)) return;
    b.actions.changeForm((f) => updateQuestion(f, q.id, { fallback: next }));
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer self-start text-[13px] font-medium text-brand-700 hover:underline dark:text-brand-300"
      >
        + Default Answer
      </button>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          id={`${id}-label`}
          className="text-[12px] font-semibold text-slate-600 dark:text-slate-300"
        >
          Default Answer
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDraft(undefined);
            if (q.fallback !== undefined)
              b.actions.changeForm((f) => updateQuestion(f, q.id, { fallback: undefined }));
          }}
          className="cursor-pointer rounded px-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          Remove
        </button>
      </div>
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
      <p
        id={`${id}-hint`}
        className={`text-[12px] ${bad ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {bad
          ? 'That isn’t an answer this question accepts.'
          : 'Used as the answer when someone leaves this question empty.'}
      </p>
    </div>
  );
}
