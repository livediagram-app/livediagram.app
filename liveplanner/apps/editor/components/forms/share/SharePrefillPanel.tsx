'use client';

// Share Form's Pre-filled Link (docs/specs/030-forms/forms.md "Publishing and the form link"): every question with the
// control a respondent sees, to pick the answers people start with, and the form link carrying them
// (`prefillSearch`, read back on the form page by `readPrefill`). An answer the form's checks would refuse is left out.
// Other options are not offered: an address never carries typed text.
import { useId, useMemo, type CSSProperties } from 'react';
import { Button, useCopiedFlash } from '@liveplanner/ui';
import {
  prefillSearch,
  promptOf,
  withLocaleNumbers,
  type PublicForm,
  type PublicQuestion,
} from '@liveplanner/forms';
import { track } from '@/lib/telemetry';
import { QuestionControl } from '../QuestionControl';
import { labelsAsOne } from '../QuestionView';

export type PrefillPicks = Readonly<Record<string, unknown>>;

// The respondent controls draw in the form's accent; in the dialog that is liveplanner's own.
const ACCENT = { '--form-accent': 'var(--color-brand-600)' } as CSSProperties;

export function SharePrefillPanel({
  url,
  form,
  picks,
  onPicks,
}: {
  url: string;
  form: PublicForm;
  picks: PrefillPicks;
  onPicks: (next: PrefillPicks) => void;
}) {
  const { copied, flash } = useCopiedFlash(1800);
  const questions = useMemo(
    () => form.sections.flatMap((s) => s.questions.map(({ other: _other, ...q }) => q)),
    [form],
  );
  const search = useMemo(() => {
    const locale = typeof navigator === 'undefined' ? 'en-GB' : navigator.language || 'en-GB';
    return prefillSearch(
      { sections: [{ questions }] },
      withLocaleNumbers(questions, { ...picks }, locale),
    );
  }, [questions, picks]);
  const link = search ? `${url}?${search}` : url;
  const any = Object.values(picks).some(
    (v) => v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && v.length === 0),
  );
  if (questions.length === 0) {
    return (
      <p className="text-[13px] text-slate-600 dark:text-slate-300">
        Add questions to the form to pre-fill their answers.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div
        style={ACCENT}
        className="flex max-h-[min(44dvh,340px)] flex-col gap-4 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40"
      >
        {questions.map((q) => (
          <PrefillQuestion
            key={q.id}
            question={q}
            value={picks[q.id]}
            onChange={(v) => onPicks({ ...picks, [q.id]: v })}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          readOnly
          aria-label="Pre-filled link"
          value={link}
          onFocus={(e) => e.target.select()}
          className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <Button
          size="sm"
          disabled={!search}
          onClick={() => {
            track('Form', 'Shared', 'Prefilled');
            void navigator.clipboard?.writeText(link).then(() => flash());
          }}
        >
          {copied ? 'Copied' : 'Copy Pre-filled Link'}
        </Button>
        <Button size="sm" variant="secondary" disabled={!any} onClick={() => onPicks({})}>
          Clear
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copied ? 'Pre-filled link copied' : ''}
      </span>
      {!search ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Pick answers above to fill them in for whoever opens the link.
        </p>
      ) : (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          People can still change any answer before they submit.
        </p>
      )}
    </div>
  );
}

function PrefillQuestion({
  question,
  value,
  onChange,
}: {
  question: PublicQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const base = useId();
  // A single control is labelled by the prompt as a <label>; a group names itself by it (as QuestionView does).
  const Prompt = labelsAsOne(question) ? 'label' : 'p';
  return (
    <div className="flex flex-col gap-1.5">
      <Prompt
        id={`${base}-prompt`}
        {...(Prompt === 'label' ? { htmlFor: `${base}-control` } : {})}
        className="text-[13px] font-medium text-slate-800 dark:text-slate-100"
      >
        {promptOf(question)}
      </Prompt>
      <QuestionControl
        question={question}
        value={value}
        other=""
        onChange={onChange}
        onOther={() => {}}
        labelledBy={`${base}-prompt`}
        controlId={`${base}-control`}
      />
    </div>
  );
}
