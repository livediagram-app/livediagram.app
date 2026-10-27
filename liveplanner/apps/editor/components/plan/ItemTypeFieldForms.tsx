'use client';

// The type editor's field forms (docs/specs/026-plan/item-types.md "Editing a type"): a custom field's
// name, options (Choice, Multiple Choice) and scale (Rating), and Add Field, which offers the built-in fields the type lacks
// and a new custom field. The grouped field list is ItemTypeLayoutEditor.
import { useState } from 'react';
import {
  COMMON_CURRENCIES,
  CURRENCY_DEFAULT,
  CALCULATIONS,
  CALCULATION_LABELS,
  CUSTOM_CHOICE_OPTIONS_MAX,
  CUSTOM_CHOICE_OPTION_MAX,
  CUSTOM_FIELD_KINDS,
  CUSTOM_FIELD_LABEL_MAX,
  ITEM_TYPES,
  RATING_FIELD_SCALE_DEFAULT,
  RATING_FIELD_SCALE_MAX,
  RATING_FIELD_SCALE_MIN,
  type Calculation,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
  linkTypesOf,
  withLinkTypes,
} from '@liveplanner/items';
import { Button, CloseIcon, PlusIcon, Select, TextArea, TextInput } from '@liveplanner/ui';
import { CustomFieldKindTiles, CustomFieldPreview } from './CustomFieldKindParts';
import { usePlan } from './PlanContext';
import { LinksToPicker, linkTypeNames } from './LinksToPicker';

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

// The kinds with options (docs/specs/030-forms/forms.md "New card field kinds").
const hasOptions = (kind: CustomFieldKind) => kind === 'choice' || kind === 'multichoice';

// A full-width dashed "add" row (Add Type, Add Field, Add Tab): plain to spot, quiet until hovered.
export const DASHED_ADD_BUTTON =
  'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-medium text-slate-600 transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200';

export const ICON_BUTTON =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-800 disabled:opacity-30 dark:text-slate-400 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-100';

// Choice's options as typed, one a line, read back trimmed and without blanks or repeats.
function optionsFrom(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const o = raw.trim().slice(0, CUSTOM_CHOICE_OPTION_MAX);
    if (o && !seen.has(o.toLowerCase())) {
      seen.add(o.toLowerCase());
      out.push(o);
    }
  }
  return out.slice(0, CUSTOM_CHOICE_OPTIONS_MAX);
}

// A Card field's target (docs/specs/026-plan/item-types.md "Card fields"): which card type its card is.
// A Currency field's currency: the common codes, GBP first, and the field's own when it is another.
function CurrencySelect({
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
function RatingScaleSelect({
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
function CalculationSelect({
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

// A custom field's name, options (Choice), the types it links to (Card) and its calculation (Calculated); where it shows on a card is the
// Display tab's.
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
            onChange({ options: optionsFrom(e.target.value) });
          }}
        />
      ) : null}
      {/* Where it shows on a card is the Display tab's: drag it onto the card there. */}
    </div>
  );
}

// Add Field: a built-in field the type lacks, or a new custom field (a name and a kind).
export function NewFieldForm({
  missing,
  canAddCustom,
  onAddBuiltIn,
  onAddCustom,
  onCancel,
}: {
  missing: readonly ItemFieldId[];
  canAddCustom: boolean;
  onAddBuiltIn: (id: ItemFieldId) => void;
  onAddCustom: (field: Omit<CustomFieldDef, 'id'>) => void;
  onCancel: () => void;
}) {
  const [custom, setCustom] = useState<Omit<CustomFieldDef, 'id'>>({ label: '', kind: 'text' });
  const types = usePlan()?.types ?? ITEM_TYPES;
  const ready =
    custom.label.trim().length > 0 &&
    (!hasOptions(custom.kind) || (custom.options?.length ?? 0) > 0) &&
    (custom.kind !== 'card' || linkTypesOf(custom).length > 0);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
      {missing.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Built-In Fields
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((id) => (
              <button
                key={id}
                type="button"
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[12px] hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
                onClick={() => onAddBuiltIn(id)}
              >
                {BUILT_IN_FIELD_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {canAddCustom ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            New Custom Field
          </p>
          <TextInput
            aria-label="New field's name"
            placeholder="Name"
            compact
            value={custom.label}
            maxLength={CUSTOM_FIELD_LABEL_MAX}
            onChange={(e) => setCustom({ ...custom, label: e.target.value })}
          />
          <CustomFieldKindTiles
            kinds={CUSTOM_FIELD_KINDS}
            value={custom.kind}
            onChange={(kind) =>
              setCustom({
                ...custom,
                kind,
                ...(kind === 'calculated' && !custom.calculation
                  ? { calculation: CALCULATIONS[0] }
                  : {}),
              })
            }
          />
          {custom.kind === 'calculated' ? (
            <CalculationSelect
              value={custom.calculation}
              onChange={(calculation) => setCustom({ ...custom, calculation })}
            />
          ) : null}
          {custom.kind === 'rating' ? (
            <RatingScaleSelect
              value={custom.scale}
              onChange={(scale) => setCustom({ ...custom, scale })}
            />
          ) : null}
          {hasOptions(custom.kind) ? (
            <TextArea
              aria-label="Options, one a line"
              placeholder="Options, one a line"
              compact
              className="min-h-20"
              onChange={(e) => setCustom({ ...custom, options: optionsFrom(e.target.value) })}
            />
          ) : null}
          {custom.kind === 'currency' ? (
            <CurrencySelect
              value={custom.currency}
              onChange={(currency) => setCustom({ ...custom, currency })}
            />
          ) : null}
          {custom.kind === 'card' ? (
            <LinksToPicker
              value={linkTypesOf(custom)}
              onChange={(ids) => setCustom(withLinkTypes(custom, ids))}
            />
          ) : null}
          <CustomFieldPreview
            label={custom.label}
            kind={custom.kind}
            options={custom.options ?? []}
            linkLabel={
              linkTypeNames(
                linkTypesOf(custom).map((id) => types.find((t) => t.id === id)?.label ?? id),
              ) || undefined
            }
            currency={custom.currency}
            scale={custom.scale}
            calculation={custom.calculation}
          />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          <CloseIcon size={12} />
          Cancel
        </Button>
        {canAddCustom ? (
          <Button
            size="sm"
            disabled={!ready}
            onClick={() =>
              onAddCustom({
                ...custom,
                label: custom.label.trim(),
                ...(hasOptions(custom.kind) ? {} : { options: undefined }),
                ...(custom.kind === 'rating' ? {} : { scale: undefined }),
                ...(custom.kind === 'card' ? {} : { linkType: undefined, linkTypes: undefined }),
                ...(custom.kind === 'currency' ? {} : { currency: undefined }),
                ...(custom.kind === 'calculated' ? {} : { calculation: undefined }),
              })
            }
          >
            <PlusIcon size={12} />
            Add Custom Field
          </Button>
        ) : null}
      </div>
    </div>
  );
}
