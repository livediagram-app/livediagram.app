'use client';

// The type editor's field forms (docs/specs/026-plan/item-types.md "Editing a type"): a custom field's
// name, options (Choice, Multiple Choice) and scale (Rating), and the settings Add Field's Shape step shares with it
// (NewFieldForm). The grouped field list is ItemTypeLayoutEditor.
import { useState } from 'react';
import {
  COMMON_CURRENCIES,
  CURRENCY_DEFAULT,
  CALCULATIONS,
  CALCULATION_LABELS,
  CUSTOM_FIELD_LABEL_MAX,
  RATING_FIELD_SCALE_DEFAULT,
  RATING_FIELD_SCALE_MAX,
  RATING_FIELD_SCALE_MIN,
  type Calculation,
  canBeRequired,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
  linkTypesOf,
  withLinkTypes,
} from '@liveplanner/items';
import { Select, SwitchRow, TextArea, TextInput } from '@liveplanner/ui';
import { hasOptions } from './add-field-kinds';
import { optionsFrom } from './ChoiceOptionsEditor';
import { LinksToPicker } from './LinksToPicker';

export const BUILT_IN_FIELD_LABELS: Record<ItemFieldId, string> = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  color: 'Colour',
  labels: 'Labels',
  estimate: 'Estimate',
  start: 'Start Date',
  due: 'Due Date',
  checklist: 'Checklist',
  votes: 'Votes',
  comments: 'Comments',
  archived: 'Archived',
  flagged: 'Flagged',
  example: 'Example',
};

export const CUSTOM_KIND_LABELS: Record<CustomFieldKind, string> = {
  text: 'Text',
  longtext: 'Long Text',
  number: 'Number',
  currency: 'Currency',
  date: 'Date',
  checkbox: 'Checkbox',
  link: 'Link',
  email: 'Email',
  choice: 'Choice',
  multichoice: 'Multiple Choice',
  rating: 'Rating',
  card: 'Link to Card',
  calculated: 'Calculated',
};

// A full-width dashed "add" row (Add Type, Add Field, Add Tab): plain to spot, quiet until hovered.
export const DASHED_ADD_BUTTON =
  'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-medium text-slate-600 transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200';

export const ICON_BUTTON =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-800 disabled:opacity-30 dark:text-slate-400 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-100';

// A Currency field's currency: the common codes, GBP first, and the field's own when it is another.
export function CurrencySelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (currency: string | undefined) => void;
}) {
  const code = value ?? CURRENCY_DEFAULT;
  const codes: readonly string[] = COMMON_CURRENCIES.includes(code as never)
    ? COMMON_CURRENCIES
    : [...COMMON_CURRENCIES, code];
  return (
    <Select
      aria-label="Currency"
      className="w-full"
      selectClassName="text-[13px]"
      value={code}
      // GBP is the default, so it stores no code.
      onChange={(e) => onChange(e.target.value === CURRENCY_DEFAULT ? undefined : e.target.value)}
    >
      {codes.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  );
}

// A Rating field's scale: 3 to 10 stars or points, 5 by default (stored as absent).
export function RatingScaleSelect({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (scale: number | undefined) => void;
}) {
  const scale = value ?? RATING_FIELD_SCALE_DEFAULT;
  const scales: number[] = [];
  for (let n = RATING_FIELD_SCALE_MIN; n <= RATING_FIELD_SCALE_MAX; n += 1) scales.push(n);
  return (
    <Select
      aria-label="Scale"
      className="w-full"
      selectClassName="text-[13px]"
      value={scale}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(n === RATING_FIELD_SCALE_DEFAULT ? undefined : n);
      }}
    >
      {scales.map((n) => (
        <option key={n} value={n}>
          Out of {n}
        </option>
      ))}
    </Select>
  );
}

// A Calculated field's calculation (docs/specs/026-plan/item-types.md "Calculated fields"): the fixed menu, with what
// it works out from under it.
export function CalculationSelect({
  value,
  onChange,
}: {
  value: Calculation | undefined;
  onChange: (calculation: Calculation) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Select
        aria-label="Calculation"
        className="w-full"
        selectClassName="text-[13px]"
        value={value ?? CALCULATIONS[0]}
        onChange={(e) => onChange(e.target.value as Calculation)}
      >
        {CALCULATIONS.map((c) => (
          <option key={c} value={c}>
            {CALCULATION_LABELS[c]}
          </option>
        ))}
      </Select>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Worked out from the cards that link here with a Link to Card field. Done means in a done
        column. It can&rsquo;t be typed.
      </p>
    </div>
  );
}

// Required (docs/specs/026-plan/item-types.md "Required fields"): a switch, as a form question's; none for a
// Checkbox, which reads unticked as empty, or a Calculated field, which nobody fills in.
export function RequiredSwitch({
  field,
  onChange,
}: {
  field: Pick<CustomFieldDef, 'kind' | 'required'>;
  onChange: (required: boolean | undefined) => void;
}) {
  if (!canBeRequired(field.kind)) return null;
  return (
    <SwitchRow
      checked={field.required === true}
      onChange={() => onChange(field.required ? undefined : true)}
      layout="flex min-h-8 items-center gap-2 rounded-md pointer-coarse:min-h-11"
      className="px-1 text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      Required
    </SwitchRow>
  );
}

// A custom field's name, options (Choice), the types it links to (Card) and its calculation (Calculated); where it
// shows on a card is the Display tab's.
export function CustomFieldForm({
  field,
  onChange,
  className = '',
}: {
  field: Omit<CustomFieldDef, 'id'>;
  onChange: (patch: Partial<CustomFieldDef>) => void;
  className?: string;
}) {
  const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'));
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <TextInput
        aria-label="Field name"
        compact
        value={field.label}
        maxLength={CUSTOM_FIELD_LABEL_MAX}
        onChange={(e) => onChange({ label: e.target.value })}
      />
      {field.kind === 'card' ? (
        <LinksToPicker
          value={linkTypesOf(field)}
          onChange={(ids) => {
            // Both keys always, so the patch clears a list a single type no longer needs.
            const { linkType, linkTypes } = withLinkTypes(field, ids);
            onChange({ linkType, linkTypes });
          }}
        />
      ) : null}
      {field.kind === 'currency' ? (
        <CurrencySelect value={field.currency} onChange={(currency) => onChange({ currency })} />
      ) : null}
      {field.kind === 'rating' ? (
        <RatingScaleSelect value={field.scale} onChange={(scale) => onChange({ scale })} />
      ) : null}
      {field.kind === 'calculated' ? (
        <CalculationSelect
          value={field.calculation}
          onChange={(calculation) => onChange({ calculation })}
        />
      ) : null}
      {hasOptions(field.kind) ? (
        <TextArea
          aria-label="Options, one a line"
          placeholder="Options, one a line"
          compact
          className="min-h-20"
          value={optionsText}
          onChange={(e) => {
            setOptionsText(e.target.value);
            onChange({ options: optionsFrom(e.target.value.split('\n')) });
          }}
        />
      ) : null}
      <RequiredSwitch field={field} onChange={(required) => onChange({ required })} />
      {/* Where it shows on a card is the Display tab's: drag it onto the card there. */}
    </div>
  );
}
