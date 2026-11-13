'use client';

// Set Automatically (docs/specs/030-forms/forms.md "Filled in automatically"): under Responses Go To, the card fields
// every response's card gets without a question (a fixed value, or the submitted day plus some days). A closed
// accordion; the api fills them, never the respondent's browser.
import { useState } from 'react';
import {
  FIXED_TEXT_MAX,
  OPTION_MAX,
  effectiveTarget,
  fixedFieldsOf,
  fixedValueOf,
  questionsOf,
  withFixed,
  type FixedField,
  type FixedValue,
} from '@liveplanner/forms';
import { PRIORITIES, PRIORITY_LABELS, RISKS, RISK_LABELS } from '@liveplanner/items';
import { Select } from '@liveplanner/ui';
import { DraftText } from './DraftText';
import { useFormBuilder } from './form-builder-context';
import {
  BOX,
  Row,
  Shell,
  SubmittedDays,
  readLabels,
  readNumber,
  submittedAfter,
} from './fixed-value-parts';

const KIND_HINT: Readonly<Record<FixedField['kind'], string>> = {
  choice: 'Choice',
  multichoice: 'Multiple Choice',
  labels: 'Labels',
  text: 'Text',
  number: 'Number',
  priority: 'Priority',
  risk: 'Risk',
  date: 'Date',
};

// A set field's value, edited as its kind takes one.
function FieldValue({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FixedField;
  value: FixedValue | undefined;
  onChange: (value: FixedValue) => void;
  disabled: boolean;
}) {
  const given = value && 'value' in value ? value.value : undefined;
  switch (field.kind) {
    case 'date':
      return (
        <SubmittedDays
          label={field.label}
          days={value && 'submitted' in value ? value.submitted.days : 0}
          onDays={(d) => onChange(submittedAfter(d))}
          disabled={disabled}
        />
      );
    case 'priority':
    case 'risk':
    case 'choice': {
      // Priority's and Risk's fixed levels by id, named; a Choice's options as they are.
      const options =
        field.kind === 'priority'
          ? PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))
          : field.kind === 'risk'
            ? RISKS.map((r) => ({ value: r, label: RISK_LABELS[r] }))
            : (field.options ?? []).map((o) => ({ value: o, label: o }));
      const current = typeof given === 'string' ? given : '';
      const known = options.some((o) => o.value.toLowerCase() === current.toLowerCase());
      return (
        <Select
          className="w-full"
          selectClassName="text-[13px]"
          aria-label={field.label}
          value={
            known ? options.find((o) => o.value.toLowerCase() === current.toLowerCase())!.value : ''
          }
          disabled={disabled}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          <option value="" disabled>
            {current && !known ? `${current} (removed)` : 'Choose…'}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    }
    case 'multichoice': {
      const picked = new Set(
        (Array.isArray(given) ? given : []).map((p) => String(p).toLowerCase()),
      );
      return (
        <div role="group" aria-label={field.label} className="flex flex-wrap gap-1.5">
          {(field.options ?? []).map((o) => {
            const on = picked.has(o.toLowerCase());
            return (
              <button
                key={o}
                type="button"
                role="checkbox"
                aria-checked={on}
                // The last pick stays: a field set to nothing is no longer set (remove it instead).
                disabled={disabled || (on && picked.size === 1)}
                onClick={() => {
                  const next = (field.options ?? []).filter((x) =>
                    x === o ? !on : picked.has(x.toLowerCase()),
                  );
                  if (next.length) onChange({ value: next });
                }}
                className={`flex h-7 cursor-pointer items-center rounded-full border px-2.5 text-[12px] font-medium transition disabled:cursor-default ${
                  on
                    ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <span className="text-optical-centre">{o}</span>
              </button>
            );
          })}
        </div>
      );
    }
    case 'labels':
    case 'text':
    case 'number': {
      const text = Array.isArray(given)
        ? given.join(', ')
        : given === undefined
          ? ''
          : String(given);
      return (
        <div className={BOX}>
          <DraftText
            label={field.label}
            value={text}
            maxLength={field.kind === 'labels' ? OPTION_MAX * 12 : FIXED_TEXT_MAX}
            disabled={disabled}
            placeholder={
              field.kind === 'labels'
                ? 'Labels, split by commas'
                : field.kind === 'number'
                  ? 'A number'
                  : 'Text every card gets'
            }
            onSave={(t) => {
              if (field.kind === 'labels') {
                const labels = readLabels(t);
                if (labels.length) onChange({ value: labels });
              } else if (field.kind === 'number') {
                const n = readNumber(t);
                if (n !== null) onChange({ value: n });
              } else if (t.trim()) onChange({ value: t.trim() });
            }}
          />
        </div>
      );
    }
  }
}

// A new set field's first value: one that already holds where there is an obvious one; else none until typed.
function firstValue(field: FixedField): FixedValue | null {
  if (field.kind === 'date') return submittedAfter(0);
  if (field.kind === 'priority' || field.kind === 'risk') return { value: 'medium' };
  if (field.kind === 'choice' && field.options?.length) return { value: field.options[0]! };
  if (field.kind === 'multichoice' && field.options?.length) return { value: [field.options[0]!] };
  return null;
}

// Set Automatically: the card fields every response's card gets without a question.
export function SetAutomatically() {
  const b = useFormBuilder();
  const dest = b.form.destination;
  const [pending, setPending] = useState<string | null>(null);
  if (!dest || !b.type) return null;
  const type = b.type;
  const fixed = dest.fixed ?? {};
  const fields = fixedFieldsOf(type);
  const byId = new Map(fields.map((f) => [f.id, f]));
  // One source per field: a field a question goes to is not offered.
  const asked = new Set(
    questionsOf(b.form).flatMap((q) => {
      const t = effectiveTarget(q, type);
      return t.to === 'field' ? [t.fieldId] : [];
    }),
  );
  const ids = [...Object.keys(fixed), ...(pending && !(pending in fixed) ? [pending] : [])];
  const free = fields.filter((f) => !asked.has(f.id) && !(f.id in fixed) && f.id !== pending);
  const set = (id: string, value: FixedValue | null) => {
    b.actions.changeForm((f) => withFixed(f, id, value));
    if (pending === id) setPending(null);
  };
  const broken = Object.entries(fixed).some(([id, v]) => {
    const f = byId.get(id);
    return !f || fixedValueOf(v, f, 0) === undefined;
  });
  return (
    <Shell
      title="Set Automatically"
      count={Object.keys(fixed).length}
      hint={`Fields every ${type.label} card gets without a question.`}
      startOpen={broken}
    >
      {ids.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {ids.map((id) => {
            const field = byId.get(id);
            const value = fixed[id];
            const remove = () => (id in fixed ? set(id, null) : setPending(null));
            if (!field)
              return (
                <Row
                  key={id}
                  name="A removed field"
                  onRemove={remove}
                  removeLabel="Stop Setting It"
                  disabled={!b.canEdit}
                >
                  <p className="text-[12px] text-amber-800 dark:text-amber-200">
                    Its field is no longer on {type.label} cards.
                  </p>
                </Row>
              );
            const stale = value !== undefined && fixedValueOf(value, field, 0) === undefined;
            return (
              <Row
                key={id}
                name={field.label}
                hint={KIND_HINT[field.kind]}
                onRemove={remove}
                removeLabel={`Stop Setting ${field.label}`}
                disabled={!b.canEdit}
              >
                <FieldValue
                  field={field}
                  value={value}
                  disabled={!b.canEdit}
                  onChange={(v) => set(id, v)}
                />
                {stale ? (
                  <p className="text-[12px] text-amber-800 dark:text-amber-200">
                    Its value is no longer one this field has: choose again.
                  </p>
                ) : value === undefined ? (
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    Type a value to set it.
                  </p>
                ) : null}
              </Row>
            );
          })}
        </ul>
      ) : null}
      {free.length ? (
        <Select
          className="w-full"
          selectClassName="text-[13px]"
          aria-label="Set a Field"
          value=""
          disabled={!b.canEdit}
          onChange={(e) => {
            const field = byId.get(e.target.value);
            if (!field) return;
            const first = firstValue(field);
            if (first) set(field.id, first);
            else setPending(field.id);
          }}
        >
          <option value="" disabled>
            + Set a Field…
          </option>
          {free.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
      ) : !ids.length ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          {type.label} has no field left to set: each is asked by a question, or is of a kind a form
          can’t set.
        </p>
      ) : null}
    </Shell>
  );
}
