'use client';

// The type editor's field forms (docs/specs/026-plan/item-types.md "Editing a type"): a custom field's
// name, options (Choice) and Show on card, and Add Field, which offers the built-in fields the type lacks
// and a new custom field. The grouped field list is ItemTypeLayoutEditor.
import { useState } from 'react';
import {
  CUSTOM_CHOICE_OPTIONS_MAX,
  CUSTOM_CHOICE_OPTION_MAX,
  CUSTOM_FIELD_KINDS,
  CUSTOM_FIELD_LABEL_MAX,
  ITEM_TYPES,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
} from '@livediagram/items';
import { Button, CloseIcon, PlusIcon, Select, TextArea, TextInput } from '@livediagram/ui';
import { usePlan } from './PlanContext';

export const BUILT_IN_FIELD_LABELS: Record<ItemFieldId, string> = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  color: 'Colour',
  labels: 'Labels',
  estimate: 'Estimate',
  start: 'Start date',
  due: 'Due date',
  checklist: 'Checklist',
  parent: 'Parent',
  votes: 'Votes',
  comments: 'Comments',
  archived: 'Archived',
  flagged: 'Flagged',
};

export const CUSTOM_KIND_LABELS: Record<CustomFieldKind, string> = {
  text: 'Text',
  longtext: 'Long text',
  number: 'Number',
  date: 'Date',
  checkbox: 'Checkbox',
  link: 'Link',
  choice: 'Choice',
  card: 'Card',
};

export const ICON_BUTTON =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-800 disabled:opacity-30 dark:text-slate-400 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-100';

// Choice's options as typed, one a line, read back trimmed and without blanks or repeats.
export function optionsFrom(text: string): string[] {
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
function LinksToSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (linkType: string) => void;
}) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  return (
    <Select
      aria-label="Links To"
      className="w-full"
      selectClassName="text-[13px]"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        Links To a Card Type…
      </option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>
          Links To {t.label}
        </option>
      ))}
    </Select>
  );
}

// A custom field's name, options (Choice), the type it links to (Card) and Show on card.
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
        <LinksToSelect value={field.linkType} onChange={(linkType) => onChange({ linkType })} />
      ) : null}
      {field.kind === 'choice' ? (
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
      <label className="flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-600"
          checked={field.onCard === true}
          onChange={(e) => onChange({ onCard: e.target.checked || undefined })}
        />
        Show on card
      </label>
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
  const ready =
    custom.label.trim().length > 0 &&
    (custom.kind !== 'choice' || (custom.options?.length ?? 0) > 0) &&
    (custom.kind !== 'card' || !!custom.linkType);
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
          <div className="flex gap-2">
            <TextInput
              aria-label="New field's name"
              placeholder="Name"
              compact
              value={custom.label}
              maxLength={CUSTOM_FIELD_LABEL_MAX}
              onChange={(e) => setCustom({ ...custom, label: e.target.value })}
            />
            <Select
              aria-label="New field's kind"
              className="w-36 shrink-0"
              selectClassName="text-[13px]"
              value={custom.kind}
              onChange={(e) => setCustom({ ...custom, kind: e.target.value as CustomFieldKind })}
            >
              {CUSTOM_FIELD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CUSTOM_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </div>
          {custom.kind === 'choice' ? (
            <TextArea
              aria-label="Options, one a line"
              placeholder="Options, one a line"
              compact
              className="min-h-20"
              onChange={(e) => setCustom({ ...custom, options: optionsFrom(e.target.value) })}
            />
          ) : null}
          {custom.kind === 'card' ? (
            <LinksToSelect
              value={custom.linkType}
              onChange={(linkType) => setCustom({ ...custom, linkType })}
            />
          ) : null}
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
                ...(custom.kind === 'choice' ? {} : { options: undefined }),
                ...(custom.kind === 'card' ? {} : { linkType: undefined }),
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
