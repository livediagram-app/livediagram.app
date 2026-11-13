'use client';

// Check Your Form, Describe a Form's preview (docs/specs/030-forms/describe-a-form.md "The preview"): the violet Drafted
// by AI note, the form's heading and description, each section's questions drawn as a respondent sees them (the
// builder's picture, disabled) with their type's name, and Responses Go To. Nothing is made here.

import { useId, type CSSProperties } from 'react';
import { QUESTION_TYPE_NAMES, type FormDefinition } from '@liveplanner/forms';
import type { FormDraftTargetOption } from '@liveplanner/templates';
import { Select } from '@liveplanner/ui';
import { AiNote } from '@/components/automations/step-panels/AiStepPanel';
import { QuestionView } from '../QuestionView';

const HEADING =
  'text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

// QuestionView's choices and stars read `--form-accent`; the dialog has no form look, so the brand's.
const ACCENT = { '--form-accent': '#6d28d9' } as CSSProperties;

export function FormDraftPreview({
  form,
  options,
  chosen,
  onChoose,
  typeLabel,
}: {
  form: FormDefinition;
  // The name the new card type would take ("Feedback 2" where Feedback is taken).
  typeLabel: string;
  options: readonly FormDraftTargetOption[];
  chosen: string;
  onChoose: (id: string) => void;
}) {
  const goesId = useId();
  const target = options.find((o) => o.id === chosen)?.target;
  const toBoard = target?.to === 'board' || target?.to === 'new-board';
  return (
    <div className="flex flex-col gap-5" style={ACCENT}>
      <AiNote>
        <strong className="font-semibold">Drafted by AI.</strong> Nothing is made until you press
        Create Form.
      </AiNote>
      <section aria-label="The form" className="flex flex-col gap-3">
        <div>
          <p className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">
            {form.heading}
          </p>
          {form.description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              {form.description}
            </p>
          ) : null}
        </div>
        {form.sections.map((section, s) => (
          <div key={section.id} className="flex flex-col gap-2">
            {s > 0 ? (
              <div className="mt-2">
                <h3 className={HEADING}>{section.title || `Section ${s + 1}`}</h3>
                {section.description ? (
                  <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">
                    {section.description}
                  </p>
                ) : null}
              </div>
            ) : null}
            {section.questions.map((q) => (
              <div key={q.id} data-form-draft-question="" className="relative">
                <span className="absolute right-3 top-3 z-[1] rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {QUESTION_TYPE_NAMES[q.type]}
                </span>
                <QuestionView
                  question={q}
                  value={undefined}
                  other=""
                  onChange={() => {}}
                  onOther={() => {}}
                  disabled
                />
              </div>
            ))}
          </div>
        ))}
      </section>
      <section aria-labelledby={goesId} className="flex flex-col gap-2">
        <h3 id={goesId} className={HEADING}>
          Responses Go To
        </h3>
        <Select aria-labelledby={goesId} value={chosen} onChange={(e) => onChoose(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          {toBoard
            ? `A new card type, “${typeLabel}”, with a field for each question.`
            : 'A column for each question.'}
        </p>
      </section>
    </div>
  );
}
