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
  type FormSection,
} from '@livediagram/forms';
import { Select, lucideGlyph } from '@livediagram/ui';
import { lucideGitFork } from '@livediagram/icons/lucide';
import { updateSection } from '@/hooks/forms/form-edits';
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
        <>
          <Select
            aria-label="Question"
            className="w-full"
            selectClassName="text-[13px]"
            value={q.id}
            onChange={(e) => {
              const next = questions.find((x) => x.id === e.target.value);
              if (next) set({ questionId: next.id, anyOf: [ruleChoices(next)[0]!] });
            }}
          >
            {questions.map((x) => (
              <option key={x.id} value={x.id}>
                {promptOf(x)}
              </option>
            ))}
          </Select>
          <div>
            <p className="mb-1.5 text-[12px] text-slate-500 dark:text-slate-400">
              Show it when the answer is any of:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ruleChoices(q).map((a) => {
                const on = rule.anyOf.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        questionId: q.id,
                        anyOf: on ? rule.anyOf.filter((x) => x !== a) : [...rule.anyOf, a],
                      })
                    }
                    className={`flex h-8 cursor-pointer items-center rounded-full border px-3 text-[12px] font-medium transition ${
                      on
                        ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="text-optical-centre">{a}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
