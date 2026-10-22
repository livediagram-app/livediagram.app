'use client';

// One question as a respondent sees it (docs/specs/030-forms/forms.md "Filling in a form"): its prompt (a red
// asterisk when required), help text, the answer control and, when its answer is wrong, the reason under it with a red
// edge on the card. The builder draws an unselected question with this too, disabled.
import { useId } from 'react';
import {
  DROPDOWN_AFTER,
  answerErrorMessage,
  promptOf,
  type AnswerError,
  type PublicQuestion,
} from '@livepages/forms';
import { lucideGlyph } from '@livepages/ui';
import { lucideCircleAlert } from '@livepages/icons/lucide';
import { QuestionControl } from './QuestionControl';

const AlertIcon = lucideGlyph(lucideCircleAlert, 16);

export function QuestionView({
  question,
  value,
  other,
  error,
  onChange,
  onOther,
  onBlur,
  disabled = false,
  domId,
}: {
  question: PublicQuestion;
  value: unknown;
  other: string;
  error?: AnswerError | undefined;
  onChange: (value: unknown) => void;
  onOther: (text: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  // The card's id, for the error summary's links.
  domId?: string;
}) {
  const base = useId();
  const promptId = `${base}-prompt`;
  const helpId = `${base}-help`;
  const errorId = `${base}-error`;
  const controlId = `${base}-control`;
  const describedBy =
    [question.help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  // A single control is labelled by its prompt as a <label>; a group (choices, a rating) names itself by the prompt.
  const single =
    !['single', 'multi', 'rating', 'checkbox'].includes(question.type) ||
    (question.type === 'single' &&
      (question.dropdown || (question.options?.length ?? 0) > DROPDOWN_AFTER));
  const Prompt = single ? 'label' : 'p';
  return (
    <div
      id={domId}
      tabIndex={-1}
      className={`form-box rounded-xl border bg-white p-5 outline-none transition-colors max-sm:p-4 dark:bg-slate-900 ${
        error
          ? 'border-red-400 dark:border-red-500/70'
          : 'form-ink border-slate-200 dark:border-slate-700/80'
      }`}
    >
      <Prompt
        id={promptId}
        {...(single ? { htmlFor: controlId } : {})}
        className="block text-[16px] font-medium leading-snug text-slate-900 dark:text-slate-50"
      >
        {promptOf(question)}
        {question.required ? (
          <span className="ml-1 text-red-600 dark:text-red-400" aria-hidden>
            *
          </span>
        ) : null}
        {question.required ? <span className="sr-only"> (required)</span> : null}
      </Prompt>
      {question.help ? (
        <p
          id={helpId}
          className="mt-1 whitespace-pre-line text-[14px] text-slate-500 dark:text-slate-400"
        >
          {question.help}
        </p>
      ) : null}
      {/* Drawn disabled (the builder's picture of a question), the control shows it can't be filled in here: a press
          on it passes to what holds it (selecting the question). */}
      <div className={`mt-3.5 ${disabled ? 'cursor-not-allowed [&>*]:pointer-events-none' : ''}`}>
        <QuestionControl
          question={question}
          value={value}
          other={other}
          onChange={onChange}
          onOther={onOther}
          onBlur={onBlur}
          disabled={disabled}
          invalid={!!error}
          labelledBy={promptId}
          describedBy={describedBy}
          controlId={controlId}
        />
      </div>
      {error ? (
        <p
          id={errorId}
          className="mt-2.5 flex items-center gap-1.5 text-[14px] font-medium text-red-700 dark:text-red-400"
        >
          <AlertIcon aria-hidden className="shrink-0" />
          {answerErrorMessage(question, error)}
        </p>
      ) : null}
    </div>
  );
}
