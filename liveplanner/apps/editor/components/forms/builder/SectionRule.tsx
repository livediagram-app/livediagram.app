'use client';

// When a section shows (docs/specs/030-forms/forms.md "Showing a section only sometimes"), under a later section's
// description in the builder: a badge reading the rule back ("Shown when Coming? is Yes"), opening its editor. The
// editor picks an earlier Single Choice, Multiple Choice or Checkbox question and the answers that show the section;
// Always Show clears it. A rule whose question has gone says so, and the section shows until it is chosen again.
import { useState } from 'react';
import {
  promptOf,
  ruleChoices,
  ruleQuestion,
  ruleQuestions,
  type FormQuestion,
  type FormSection,
} from '@liveplanner/forms';
import { Select, lucideGlyph } from '@liveplanner/ui';
import { lucideGitFork } from '@liveworkspace/icons/lucide';
import { updateSection } from '@liveplanner/forms';
import { ChoiceChip } from './ChoiceChip';
import { FormSheet } from './FormSheet';
import { useFormBuilder } from './form-builder-context';

const BranchIcon = lucideGlyph(lucideGitFork, 13);

// "Yes", "Yes or No", "Vegan, Halal or Kosher".
const orList = (xs: readonly string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;

export function SectionRule({ section, index }: { section: FormSection; index: number }) {
  const b = useFormBuilder();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const rule = section.showIf;
  const q = rule ? ruleQuestion(b.form, index, rule) : null;
  const broken = !!rule && !q;
  const label = !rule
    ? 'Always shown'
    : q
      ? `Shown when ${promptOf(q)} is ${orList(rule.anyOf.filter((a) => ruleChoices(q).includes(a)))}`
      : 'Always shown: its question was removed or changed';
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((open) => (open ? null : el));
        }}
        className={`mt-3 inline-flex min-h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5 transition ${
          broken
            ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
            : rule
              ? 'border-[color-mix(in_srgb,var(--form-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--form-accent)_8%,transparent)] text-slate-800 dark:text-slate-100'
              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:border-slate-500'
        }`}
      >
        <BranchIcon aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </button>
      {anchor ? (
        <FormSheet anchor={anchor} name="Show This Section" onClose={() => setAnchor(null)}>
          <RuleEditor section={section} index={index} />
        </FormSheet>
      ) : null}
    </>
  );
}

function RuleEditor({ section, index }: { section: FormSection; index: number }) {
  const b = useFormBuilder();
  const questions = ruleQuestions(b.form, index);
  const rule = section.showIf;
  const q = rule ? (questions.find((x) => x.id === rule.questionId) ?? null) : null;
  const set = (showIf: FormSection['showIf']) =>
    b.actions.changeForm((f) => updateSection(f, section.id, { showIf }));
  const choose = (mode: 'always' | 'when') => {
    if (mode === 'always') return set(undefined);
    const first = q ?? questions[0];
    if (first) set({ questionId: first.id, anyOf: [ruleChoices(first)[0]!] });
  };
  const radio = (on: boolean) =>
    `flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition ${
      on
        ? 'border-brand-400 bg-brand-50 text-brand-900 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-brand-50'
        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
    }`;
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Show this section" className="flex flex-col gap-1.5">
        <button
          type="button"
          role="radio"
          aria-checked={!q}
          onClick={() => choose('always')}
          className={radio(!q)}
        >
          Always
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!!q}
          disabled={questions.length === 0}
          onClick={() => choose('when')}
          className={`${radio(!!q)} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Only when an earlier answer is…
        </button>
      </div>
      {questions.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          Add a Single Choice, Multiple Choice or Checkbox question to an earlier section first.
        </p>
      ) : null}
      {q && rule ? (
        <RulePicker
          questions={questions}
          question={q}
          anyOf={rule.anyOf}
          answersLabel="Show it when the answer is any of:"
          onChange={(questionId, anyOf) => set({ questionId, anyOf })}
        />
      ) : null}
    </div>
  );
}

// A rule's question (a select of the questions that fit) and its answers (toggle chips): a section's Show If and a
// card type rule share it (docs/specs/030-forms/forms.md "Choosing the card type by an answer"). Picking another
// question takes its first answer; unpicking every answer passes an empty list (the caller clears the rule or keeps
// one).
export function RulePicker({
  questions,
  question: q,
  anyOf,
  answersLabel,
  onChange,
  disabled = false,
}: {
  questions: readonly FormQuestion[];
  // Null: its question is gone (a broken rule), so none is chosen until one is picked.
  question: FormQuestion | null;
  anyOf: readonly string[];
  answersLabel: string;
  onChange: (questionId: string, anyOf: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <Select
        aria-label="Question"
        className="w-full"
        selectClassName="text-[13px]"
        value={q?.id ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const next = questions.find((x) => x.id === e.target.value);
          if (next) onChange(next.id, [ruleChoices(next)[0]!]);
        }}
      >
        {q ? null : (
          <option value="" disabled>
            Choose a question…
          </option>
        )}
        {questions.map((x) => (
          <option key={x.id} value={x.id}>
            {promptOf(x)}
          </option>
        ))}
      </Select>
      {q ? (
        <div>
          <p className="mb-1.5 text-[12px] text-slate-500 dark:text-slate-400">{answersLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {ruleChoices(q).map((a) => {
              const on = anyOf.includes(a);
              return (
                <ChoiceChip
                  key={a}
                  on={on}
                  disabled={disabled}
                  onClick={() => onChange(q.id, on ? anyOf.filter((x) => x !== a) : [...anyOf, a])}
                >
                  <span className="text-optical-centre">{a}</span>
                </ChoiceChip>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
