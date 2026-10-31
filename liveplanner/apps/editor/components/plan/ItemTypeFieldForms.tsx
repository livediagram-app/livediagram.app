'use client';

// The type editor's field forms (docs/specs/026-plan/item-types.md "Editing a type"): a custom field's
// name, options (Choice, Multiple Choice) and scale (Rating), and the settings Add Field's Shape step shares with it
// (NewFieldForm). The grouped field list is ItemTypeLayoutEditor.
import { useId, useState } from 'react';
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
  isFormulaField,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
  linkTypesOf,
  withLinkTypes,
} from '@liveplanner/items';
import { Select, SwitchRow, TextArea, TextInput } from '@liveplanner/ui';
import { hasOptions, type PickKind } from './add-field-kinds';
import { optionsFrom } from './ChoiceOptionsEditor';
import { LinksToPicker } from './LinksToPicker';
import { FormulaEditor, type FormulaDraft } from './FormulaEditor';
import { track } from '@/lib/telemetry';

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
  attachments: 'Attachments',
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
  person: 'Person',
  labels: 'Labels',
  colour: 'Colour',
  checklist: 'Checklist',
  image: 'Image',
  comments: 'Comments',
  votes: 'Votes',
};

// Add Field's kinds by name: every custom kind's, and the one-to-a-type built-in fields' (Comments, Votes).
export const PICK_KIND_LABELS: Record<PickKind, string> = {
  ...CUSTOM_KIND_LABELS,
  comments: 'Comments',
  votes: 'Votes',
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

// What each calculation works out from, under the menu.
const CALCULATION_LINES: Record<Calculation, string> = {
  childCount:
    'Worked out from the cards that link here with a Link to Card field. It can\u2019t be typed.',
  childrenDone:
    'Worked out from the cards that link here with a Link to Card field. Done means in a done column. It can\u2019t be typed.',
  formula: 'Worked out from this card\u2019s own fields by a formula. It can\u2019t be typed.',
};

// The patch picking a calculation makes: a Formula's settings go with any other (item-types.md "Formula fields").
export function calculationPatch(calculation: Calculation): Partial<CustomFieldDef> {
  if (calculation === 'formula') {
    track('Plan', 'Changed', 'FieldFormula');
    return { calculation };
  }
  return { calculation, formula: undefined, result: undefined, currency: undefined };
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
  const lineId = useId();
  return (
    <div className="flex flex-col gap-1">
      <Select
        aria-label="Calculation"
        aria-describedby={lineId}
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
      <p id={lineId} className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {CALCULATION_LINES[value ?? CALCULATIONS[0]]}
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

// Notifies (docs/specs/026-plan/item-types.md "Notifies"): what the switch on a Person field, and on the Assignee's
// row menu, says it does.
export const NOTIFIES_LINE =
  'Tell the person when a card is theirs: the Inbox, emails and Only Mine.';

// A Person field's Notifies switch, as Required's, with its line under it (the switch's description); none for any
// other kind. Off is stored as absent.
export function NotifiesSwitch({
  field,
  onChange,
}: {
  field: Pick<CustomFieldDef, 'kind' | 'notifies'>;
  onChange: (notifies: boolean | undefined) => void;
}) {
  const lineId = useId();
  if (field.kind !== 'person') return null;
  return (
    <div className="flex flex-col">
      <SwitchRow
        checked={field.notifies === true}
        aria-describedby={lineId}
        onChange={() => {
          track('Plan', 'Changed', 'FieldNotifies');
          onChange(field.notifies ? undefined : true);
        }}
        layout="flex min-h-8 items-center gap-2 rounded-md pointer-coarse:min-h-11"
        className="px-1 text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Notifies
      </SwitchRow>
      <p id={lineId} className="px-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {NOTIFIES_LINE}
      </p>
    </div>
  );
}

// Holds Several (docs/specs/026-plan/item-types.md "Holds Several"): what the switch on a Person or Card field says.
export const HOLDS_SEVERAL_LINES: Partial<Record<CustomFieldDef['kind'], string>> = {
  person: 'Hold more than one person, such as reviewers or a pair.',
  card: 'Link more than one card, such as related work.',
};

// A Person or Card field's Holds Several switch, as Notifies', with its line under it; none for any other kind. Off is
// stored as absent, and turning it either way leaves every card's value as it is.
export function HoldsSeveralSwitch({
  field,
  onChange,
}: {
  field: Pick<CustomFieldDef, 'kind' | 'multiple'>;
  onChange: (multiple: boolean | undefined) => void;
}) {
  const lineId = useId();
  const line = HOLDS_SEVERAL_LINES[field.kind];
  if (!line) return null;
  return (
    <div className="flex flex-col">
      <SwitchRow
        checked={field.multiple === true}
        aria-describedby={lineId}
        onChange={() => {
          track('Plan', 'Changed', 'FieldHoldsSeveral');
          onChange(field.multiple ? undefined : true);
        }}
        layout="flex min-h-8 items-center gap-2 rounded-md pointer-coarse:min-h-11"
        className="px-1 text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Holds Several
      </SwitchRow>
      <p id={lineId} className="px-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {line}
      </p>
    </div>
  );
}

// A custom field's name, options (Choice), the types it links to (Card) and its calculation (Calculated); where it
// shows on a card is the Display tab's.
export function CustomFieldForm({
  field,
  onChange,
  formulaDraft,
  className = '',
}: {
  field: Omit<CustomFieldDef, 'id'> & Partial<Pick<CustomFieldDef, 'id'>>;
  onChange: (patch: Partial<CustomFieldDef>) => void;
  // The type as drafted, for a Formula's names and preview (item-types.md "Formula fields").
  formulaDraft?: FormulaDraft;
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
          onChange={(calculation) => onChange(calculationPatch(calculation))}
        />
      ) : null}
      {isFormulaField(field) && formulaDraft ? (
        <FormulaEditor
          field={field}
          draft={formulaDraft}
          keepLastWorking
          onChange={onChange}
          currencySelect={
            <CurrencySelect
              value={field.currency}
              onChange={(currency) => onChange({ currency })}
            />
          }
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
      <HoldsSeveralSwitch field={field} onChange={(multiple) => onChange({ multiple })} />
      <RequiredSwitch field={field} onChange={(required) => onChange({ required })} />
      <NotifiesSwitch field={field} onChange={(notifies) => onChange({ notifies })} />
      {/* Where it shows on a card is the Display tab's: drag it onto the card there. */}
    </div>
  );
}
