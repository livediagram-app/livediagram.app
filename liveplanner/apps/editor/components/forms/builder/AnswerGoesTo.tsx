'use client';

// Answer Goes To (docs/specs/030-forms/forms.md "Mapping: where an answer goes"): where this question's answer lands
// on each response's card. On the Card (Description, the default, and Title), the destination card type's fields
// whose kind takes the answer (each with its kind's icon; one another question uses says so, and choosing it moves it
// here), and a New Field named as the person types it (the question's words to start), of the kind the answer needs.
import { useId, useMemo, useState } from 'react';
import {
  NEW_FIELD_LABEL_MAX,
  canGoToTitle,
  effectiveTarget,
  fieldChoices,
  newFieldFor,
  promptOf,
  setTarget,
  titleTakenBy,
  type AnswerTarget,
  type FormQuestion,
} from '@liveplanner/forms';
import { CUSTOM_KIND_LABELS } from '@/components/plan/ItemTypeFieldForms';
import { CUSTOM_KIND_ICONS } from '@/components/plan/CustomFieldKindParts';
import { Chip, PlusIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideHeading1, lucideTextQuote } from '@liveworkspace/icons/lucide';
import { useFormBuilder } from './form-builder-context';
import { Callout } from '@liveworkspace/ui/callout';

const TitleIcon = lucideGlyph(lucideHeading1, 16);
const DescriptionIcon = lucideGlyph(lucideTextQuote, 16);
// A card type holds this many custom fields at most.
const CUSTOM_MAX = 12;

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
  const atLimit = (b.type?.custom?.length ?? 0) >= CUSTOM_MAX;
  const isOn = (t: AnswerTarget) =>
    !target.broken &&
    target.to === t.to &&
    (t.to !== 'field' || (target.to === 'field' && target.fieldId === t.fieldId));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
          Answer Goes To
        </p>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
          Where “{promptOf(q)}” lands on each response’s{' '}
          {b.type ? <strong className="font-semibold">{b.type.label}</strong> : null} card.
        </p>
      </div>
      {/* Card type rules map their own types' fields (forms.md "Choosing the card type by an answer"). */}
      {b.type && b.form.destination?.typeRules?.length ? (
        <Callout tone="info">
          For {b.type.label} cards. Rules map their own types’ fields under Responses Go To.
        </Callout>
      ) : null}
      {target.broken ? (
        <Callout tone="warning">
          Goes to Description: its field was removed or no longer fits this question. Choose again
          below.
        </Callout>
      ) : null}
      <div role="radiogroup" aria-label="Answer goes to" className="flex flex-col gap-4">
        <Group title="On the Card">
          <div className={`grid gap-2 ${canGoToTitle(q) ? 'grid-cols-2 max-sm:grid-cols-1' : ''}`}>
            <Choice
              on={isOn({ to: 'description' })}
              onPick={() => choose({ to: 'description' })}
              icon={<DescriptionIcon aria-hidden />}
              name="Description"
              detail="Under its question in the card’s body"
            />
            {canGoToTitle(q) ? (
              <Choice
                on={isOn({ to: 'title' })}
                onPick={() => choose({ to: 'title' })}
                icon={<TitleIcon aria-hidden />}
                name="Title"
                detail={
                  titleBy ? `Now used by “${promptOf(titleBy)}”` : 'The card’s name on the board'
                }
              />
            ) : null}
          </div>
        </Group>
        {b.type && fields.length ? (
          <Group title={`${b.type.label} Fields`}>
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              {fields.map(({ field, takenBy }) => {
                const t: AnswerTarget = { to: 'field', fieldId: field.id };
                return (
                  <Choice
                    key={field.id}
                    on={isOn(t)}
                    onPick={() => choose(t)}
                    icon={CUSTOM_KIND_ICONS[field.kind]}
                    name={field.label}
                    detail={
                      takenBy
                        ? `Now used by “${promptOf(takenBy)}”`
                        : `${CUSTOM_KIND_LABELS[field.kind]} field`
                    }
                  />
                );
              })}
            </div>
          </Group>
        ) : null}
      </div>
      {b.type ? (
        atLimit ? (
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            {b.type.label} has as many custom fields as a card type can ({CUSTOM_MAX}).
          </p>
        ) : (
          <NewField question={q} onMade={(id) => choose({ to: 'field', fieldId: id })} />
        )
      ) : (
        <button
          type="button"
          onClick={() => b.openSettings('destination')}
          className="cursor-pointer text-left text-[13px] font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
        >
          Choose where responses go to map answers to card fields.
        </button>
      )}
      {!titleBy && q.goesTo?.to !== 'title' && canGoToTitle(q) ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Tip: map one question to Title so cards read well on the board.
        </p>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function Choice({
  on,
  onPick,
  icon,
  name,
  detail,
}: {
  on: boolean;
  onPick: () => void;
  icon: React.ReactNode;
  name: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
        on
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/10 dark:ring-brand-400'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800'
      }`}
    >
      <span
        aria-hidden
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${
          on
            ? 'bg-brand-700 text-white dark:bg-brand-600'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate text-[13px] font-semibold ${on ? 'text-brand-900 dark:text-brand-50' : 'text-slate-800 dark:text-slate-100'}`}
        >
          {name}
        </span>
        <span className="block text-[12px] leading-snug text-slate-500 dark:text-slate-400">
          {detail}
        </span>
      </span>
    </button>
  );
}

// New Field: a field of the kind this answer needs, named as typed (the question's words to start). A name a field of
// the type already has is refused, as the card type editor refuses it.
function NewField({
  question: q,
  onMade,
}: {
  question: FormQuestion;
  onMade: (id: string) => void;
}) {
  const b = useFormBuilder();
  const id = useId();
  const [name, setName] = useState(() => promptOf(q).slice(0, NEW_FIELD_LABEL_MAX));
  const kind = useMemo(() => newFieldFor(q, 'f', 'f').kind, [q]);
  const trimmed = name.trim();
  const clash = (b.type?.custom ?? []).some((f) => f.label.toLowerCase() === trimmed.toLowerCase());
  const make = () => {
    if (!trimmed || clash || !b.type) return;
    const made = b.actions.addFieldFor(q, b.type, trimmed);
    if (made) onMade(made);
  };
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
      >
        New Field
        <Chip
          icon={
            <span aria-hidden className="[&_svg]:size-3">
              {CUSTOM_KIND_ICONS[kind]}
            </span>
          }
          className="bg-slate-100 px-2 py-0.5 text-[11px] font-medium tracking-normal normal-case text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {CUSTOM_KIND_LABELS[kind]}
        </Chip>
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={name}
          maxLength={NEW_FIELD_LABEL_MAX}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              make();
            }
          }}
          placeholder="Field name"
          aria-invalid={clash || undefined}
          aria-describedby={clash ? `${id}-clash` : undefined}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
        />
        <button
          type="button"
          disabled={!trimmed || clash}
          onClick={make}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
        >
          <PlusIcon size={13} />
          Create
        </button>
      </div>
      {clash ? (
        <p id={`${id}-clash`} className="mt-1.5 text-[12px] text-amber-700 dark:text-amber-300">
          {b.type?.label} already has a field called “{trimmed}”. Pick it above, or name this one
          differently.
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">
          Added to {b.type?.label} cards, and this answer goes to it.
        </p>
      )}
    </div>
  );
}
