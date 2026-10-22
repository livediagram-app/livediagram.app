'use client';

// Answer Goes To (docs/specs/030-forms/forms.md "Mapping: where an answer goes"): Description (the default), Title,
// a field of the destination's card type whose kind takes the answer, or New Field "<Prompt>". A field another
// question already uses says so, and choosing it moves it here.
import {
  canGoToTitle,
  effectiveTarget,
  fieldChoices,
  promptOf,
  titleTakenBy,
  type AnswerTarget,
  type FormQuestion,
} from '@livepages/forms';
import { CUSTOM_KIND_LABELS } from '@/components/plan/ItemTypeFieldForms';
import { PlusIcon } from '@livepages/ui';
import { setTarget } from '@livepages/forms';
import { useFormBuilder } from './form-builder-context';

export function AnswerGoesTo({
  question: q,
  onChosen,
}: {
  question: FormQuestion;
  // A target was picked (its popover closes).
  onChosen?: () => void;
}) {
  const b = useFormBuilder();
  const target = effectiveTarget(q, b.type);
  const choose = (t: AnswerTarget) => {
    b.actions.changeForm((f) => setTarget(f, q.id, t));
    onChosen?.();
  };
  const titleBy = titleTakenBy(b.form, q);
  const fields = fieldChoices(b.form, q, b.type);
  const atLimit = (b.type?.custom?.length ?? 0) >= 12;
  const row = (on: boolean) =>
    `flex w-full cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition ${
      on
        ? 'border-brand-400 bg-brand-50 text-brand-900 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-brand-50'
        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-500'
    }`;
  const dot = (on: boolean) => (
    <span
      aria-hidden
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-brand-600 dark:border-brand-400' : 'border-slate-300 dark:border-slate-600'}`}
    >
      {on ? <span className="h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400" /> : null}
    </span>
  );
  const isOn = (t: AnswerTarget) =>
    !target.broken &&
    target.to === t.to &&
    (t.to !== 'field' || (target.to === 'field' && target.fieldId === t.fieldId));
  return (
    <div role="radiogroup" aria-label="Answer goes to" className="flex flex-col gap-1.5">
      {target.broken ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          Goes to Description: its field was removed or no longer fits this question. Choose again
          below.
        </p>
      ) : null}
      <button
        type="button"
        role="radio"
        aria-checked={isOn({ to: 'description' })}
        onClick={() => choose({ to: 'description' })}
        className={row(isOn({ to: 'description' }))}
      >
        {dot(isOn({ to: 'description' }))}
        <span>
          <span className="block font-medium">Description</span>
          <span className="block text-[12px] text-slate-500 dark:text-slate-400">
            Written under its question in the card’s description
          </span>
        </span>
      </button>
      {canGoToTitle(q) ? (
        <button
          type="button"
          role="radio"
          aria-checked={isOn({ to: 'title' })}
          onClick={() => choose({ to: 'title' })}
          className={row(isOn({ to: 'title' }))}
        >
          {dot(isOn({ to: 'title' }))}
          <span>
            <span className="block font-medium">Title</span>
            <span className="block text-[12px] text-slate-500 dark:text-slate-400">
              {titleBy ? `Now used by “${promptOf(titleBy)}”` : 'The card’s name on the board'}
            </span>
          </span>
        </button>
      ) : null}
      {fields.map(({ field, takenBy }) => {
        const t: AnswerTarget = { to: 'field', fieldId: field.id };
        return (
          <button
            key={field.id}
            type="button"
            role="radio"
            aria-checked={isOn(t)}
            onClick={() => choose(t)}
            className={row(isOn(t))}
          >
            {dot(isOn(t))}
            <span>
              <span className="block font-medium">{field.label}</span>
              <span className="block text-[12px] text-slate-500 dark:text-slate-400">
                {CUSTOM_KIND_LABELS[field.kind]} field
                {takenBy ? ` · now used by “${promptOf(takenBy)}”` : ''}
              </span>
            </span>
          </button>
        );
      })}
      {b.type ? (
        <button
          type="button"
          disabled={atLimit}
          onClick={() => {
            const id = b.actions.addFieldFor(q, b.type!);
            if (id) choose({ to: 'field', fieldId: id });
          }}
          className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[13px] font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
        >
          <PlusIcon size={13} />
          <span className="truncate">New Field “{promptOf(q)}”</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => b.openSettings('destination')}
          className="text-left text-[12px] font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
        >
          Choose where responses go to map answers to card fields.
        </button>
      )}
      {atLimit ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          {b.type?.label} has as many custom fields as a card type can (12).
        </p>
      ) : null}
      {!titleBy && q.goesTo?.to !== 'title' && canGoToTitle(q) ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Tip: map one question to Title so cards read well on the board.
        </p>
      ) : null}
    </div>
  );
}
