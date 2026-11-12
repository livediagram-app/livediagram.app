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
  isLookupField,
  isRollupField,
  canShowAsPercent,
  type CustomFieldDef,
  type CustomFieldKind,
  BUILT_IN_FIELD_NAMES,
  type ItemFieldId,
  linkTypesOf,
  withLinkTypes,
} from '@liveplanner/items';
import { Select, TextArea, TextInput } from '@liveplanner/ui';
import { SettingsToggleRowView } from '@liveworkspace/settings-ui';
import { hasOptions, pickOf, type PickKind } from './add-field-kinds';
import { optionsFrom } from './ChoiceOptionsEditor';
import { LinksToPicker } from './LinksToPicker';
import { FormulaEditor, type FormulaDraft } from './FormulaEditor';
import { RollupEditor } from './RollupEditor';
import { track } from '@/lib/telemetry';

// The built-ins' own names, Title Case (one table, @liveplanner/items built-in-field-labels.ts); a type's own name for
// one is read through typeFieldLabel.
export const BUILT_IN_FIELD_LABELS: Readonly<Record<ItemFieldId, string>> = BUILT_IN_FIELD_NAMES;

export const CUSTOM_KIND_LABELS: Record<CustomFieldKind, string> = {
  text: 'Text',
  longtext: 'Long Text',
  number: 'Number',
  currency: 'Currency',
  percent: 'Percent',
  duration: 'Duration',
  date: 'Date',
  datetime: 'Date and Time',
  daterange: 'Date Range',
  checkbox: 'Checkbox',
  link: 'Link',
  email: 'Email',
  phone: 'Phone',
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

// Add Field's tiles by name: every custom kind's, the one-to-a-type built-in fields' (Comments, Votes), and each
// variant's (add-field-kinds.ts KIND_VARIANTS).
export const PICK_KIND_LABELS: Record<PickKind, string> = {
  ...CUSTOM_KIND_LABELS,
  comments: 'Comments',
  votes: 'Votes',
  people: 'Several People',
  'time-tracking': 'Time Tracking',
  'datetime-range': 'Date and Time Range',
  cards: 'Several Cards',
  images: 'Several Images',
  'blocked-by': 'Blocked By',
  formula: 'Formula',
  rollup: 'Rollup',
  lookup: 'Lookup',
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
  rollup:
    'Worked out from one field of the cards that link here, totalled, averaged, counted or dated. It can\u2019t be typed.',
  lookup: 'Shows a field of the card a Link to Card field links to. It can\u2019t be typed.',
  formula: 'Worked out from this card\u2019s own fields by a formula. It can\u2019t be typed.',
};

// The patch picking a calculation makes: a Formula's settings go with any other (item-types.md "Formula fields").
export function calculationPatch(calculation: Calculation): Partial<CustomFieldDef> {
  // A new Formula gives a Number until its Result is picked, so it shows no share yet.
  const settingsOff = { through: undefined, aggregate: undefined, source: undefined };
  if (calculation === 'formula') {
    track('Plan', 'Changed', 'FieldFormula');
    return {
      calculation,
      showAs: undefined,
      result: undefined,
      currency: undefined,
      ...settingsOff,
    };
  }
  const off = {
    calculation,
    formula: undefined,
    result: undefined,
    currency: undefined,
    ...settingsOff,
  };
  // A Child Count is no share, so it stops showing as a Percent.
  return canShowAsPercent({ kind: 'calculated', calculation })
    ? off
    : { ...off, showAs: undefined };
}

// A Calculated field's calculation (docs/specs/026-plan/item-types.md "Calculated fields"): the fixed menu, with what
// it works out from under it.
// A Calculated field's own counts: Formula, Rollup and Lookup are field types of their own (Add Field's variants), so
// the menu never turns a field into one, nor one into a count.
export const COUNT_CALCULATIONS = [
  'childCount',
  'childrenDone',
] as const satisfies readonly Calculation[];

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
        {COUNT_CALCULATIONS.map((c) => (
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

// A field's on/off setting as a Settings row (docs/specs/026-plan/item-types.md "Fields and Tabs": a field's
// switches): the shared settings toggle cell, a full-width card whose whole area flips its one switch, its name and a
// one-line description in it. Every switch in a field's form is one, stacked by FieldSwitches with one gap.
function FieldSettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const key = `field-setting-${useId()}`;
  return (
    <SettingsToggleRowView
      row={{ key, label, description }}
      checked={checked}
      onChange={onChange}
    />
  );
}

// Required (docs/specs/026-plan/item-types.md "Required fields"): as a form question's; none for a Checkbox, which
// reads unticked as empty, a Calculated field, which nobody fills in, or a Time Spent field, whose entries are
// recorded, never typed in.
export const REQUIRED_LINE = 'Every card of this type needs a value for it.';
export function RequiredSwitch({
  field,
  onChange,
}: {
  field: Pick<CustomFieldDef, 'kind' | 'required'> & Partial<Pick<CustomFieldDef, 'timeSpent'>>;
  onChange: (required: boolean | undefined) => void;
}) {
  if (!canBeRequired(field.kind) || field.timeSpent) return null;
  return (
    <FieldSettingRow
      label="Required"
      description={REQUIRED_LINE}
      checked={field.required === true}
      onChange={(on) => onChange(on ? true : undefined)}
    />
  );
}

// Show as Percent Bar (docs/specs/026-plan/item-types.md "Percent"): on a worked-out share (a Children Done); none for
// a field whose result is no share. Off is stored as absent.
export const SHOW_AS_PERCENT_LINE = 'Draw the share as a bar, like a Percent field.';
export function ShowAsPercentSwitch({
  field,
  onChange,
}: {
  field: Pick<CustomFieldDef, 'kind' | 'calculation' | 'showAs'> &
    Partial<Pick<CustomFieldDef, 'result'>>;
  onChange: (showAs: 'percent' | undefined) => void;
}) {
  if (!canShowAsPercent(field)) return null;
  return (
    <FieldSettingRow
      label="Show as Percent Bar"
      description={SHOW_AS_PERCENT_LINE}
      checked={field.showAs === 'percent'}
      onChange={(on) => {
        track('Plan', 'Changed', 'FieldShowAsPercent');
        onChange(on ? 'percent' : undefined);
      }}
    />
  );
}

// Notifies (docs/specs/026-plan/item-types.md "Notifies"): what the switch on a Person field, and on the Assignee's
// row menu, says it does.
export const NOTIFIES_LINE =
  'Tell the person when a card is theirs: the Inbox, emails and Only Mine.';

// A Person field's Notifies switch; none for any other kind. Off is stored as absent.
export function NotifiesSwitch({
  field,
  onChange,
}: {
  field: Pick<CustomFieldDef, 'kind' | 'notifies'>;
  onChange: (notifies: boolean | undefined) => void;
}) {
  if (field.kind !== 'person') return null;
  return (
    <FieldSettingRow
      label="Notifies"
      description={NOTIFIES_LINE}
      checked={field.notifies === true}
      onChange={(on) => {
        track('Plan', 'Changed', 'FieldNotifies');
        onChange(on ? true : undefined);
      }}
    />
  );
}

// Every on/off setting a field's form offers (Show as Percent Bar, Required, Notifies), as Settings rows stacked with
// one gap; nothing when the field takes none.
export function FieldSwitches({
  field,
  onChange,
}: {
  field: Pick<CustomFieldDef, 'kind'> &
    Partial<
      Pick<
        CustomFieldDef,
        'calculation' | 'showAs' | 'required' | 'notifies' | 'result' | 'timeSpent'
      >
    >;
  onChange: (patch: Partial<Pick<CustomFieldDef, 'showAs' | 'required' | 'notifies'>>) => void;
}) {
  const percent = canShowAsPercent(field);
  const required = canBeRequired(field.kind) && !field.timeSpent;
  const notifies = field.kind === 'person';
  if (!percent && !required && !notifies) return null;
  return (
    <div data-field-switches className="flex flex-col gap-2">
      <ShowAsPercentSwitch field={field} onChange={(showAs) => onChange({ showAs })} />
      <RequiredSwitch field={field} onChange={(v) => onChange({ required: v })} />
      <NotifiesSwitch field={field} onChange={(v) => onChange({ notifies: v })} />
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
      {pickOf(field) === 'calculated' ? (
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
      {(isRollupField(field) || isLookupField(field)) && formulaDraft ? (
        <RollupEditor field={field} draft={formulaDraft} onChange={onChange} />
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
      <FieldSwitches field={field} onChange={onChange} />
      {/* Where it shows on a card is the Display tab's: drag it onto the card there. */}
    </div>
  );
}
