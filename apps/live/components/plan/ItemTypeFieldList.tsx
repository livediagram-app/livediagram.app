'use client';

// The type editor's fields (docs/specs/026-plan/item-types.md "Editing a type"): the type's fields in
// order, Title and Status first and fixed; each other field moves up or down and comes off; a custom
// field also edits its name, its options (Choice) and Show on card. Add Field offers the built-in
// fields the type lacks and a new custom field.
import { useState } from 'react';
import {
  BUILT_IN_FIELD_IDS,
  CUSTOM_CHOICE_OPTIONS_MAX,
  CUSTOM_CHOICE_OPTION_MAX,
  CUSTOM_FIELD_KINDS,
  CUSTOM_FIELD_LABEL_MAX,
  ITEM_TYPE_CUSTOM_MAX,
  ITEM_TYPE_FIELDS_MAX,
  REQUIRED_TYPE_FIELDS,
  newCustomFieldId,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemFieldId,
} from '@livediagram/items';
import { Button, CloseIcon, Select } from '@livediagram/ui';
import { FIELD_CLASS } from './PlanModal';

export const BUILT_IN_FIELD_LABELS: Record<ItemFieldId, string> = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  labels: 'Labels',
  estimate: 'Estimate',
  start: 'Start date',
  due: 'Due date',
  checklist: 'Checklist',
  parent: 'Parent',
  votes: 'Votes',
  archived: 'Archived',
};

export const CUSTOM_KIND_LABELS: Record<CustomFieldKind, string> = {
  text: 'Text',
  longtext: 'Long text',
  number: 'Number',
  date: 'Date',
  checkbox: 'Checkbox',
  link: 'Link',
  choice: 'Choice',
};

export type FieldDraft = { fields: string[]; custom: CustomFieldDef[] };

const ICON_BUTTON =
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

export function ItemTypeFieldList({
  draft,
  onChange,
  removedSome,
  tabSlot,
}: {
  draft: FieldDraft;
  onChange: (next: FieldDraft) => void;
  // Where a field shows in the item panel (the type editor's TabPicker), beside its name.
  tabSlot?: (fieldId: string, label: string) => React.ReactNode;
  // A field has come off since the editor opened: say what happens to its values.
  removedSome: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { fields, custom } = draft;
  const customOf = (id: string) => custom.find((f) => f.id === id);
  const labelOf = (id: string) =>
    customOf(id)?.label ?? BUILT_IN_FIELD_LABELS[id as ItemFieldId] ?? id;
  const kindOf = (id: string) => {
    const c = customOf(id);
    return c ? CUSTOM_KIND_LABELS[c.kind] : 'Built in';
  };
  const ordered = [
    ...REQUIRED_TYPE_FIELDS,
    ...fields.filter((f) => !(REQUIRED_TYPE_FIELDS as readonly string[]).includes(f)),
  ];
  const movable = ordered.slice(REQUIRED_TYPE_FIELDS.length);
  const missing = BUILT_IN_FIELD_IDS.filter((f) => !ordered.includes(f));
  const full = ordered.length >= ITEM_TYPE_FIELDS_MAX;

  const move = (id: string, by: -1 | 1) => {
    const i = movable.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= movable.length) return;
    const next = [...movable];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ ...draft, fields: [...REQUIRED_TYPE_FIELDS, ...next] });
  };
  const remove = (id: string) =>
    onChange({
      fields: ordered.filter((f) => f !== id),
      custom: custom.filter((f) => f.id !== id),
    });
  const updateCustom = (id: string, patch: Partial<CustomFieldDef>) =>
    onChange({ ...draft, custom: custom.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  return (
    <div>
      <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {ordered.map((id) => {
          const fixed = (REQUIRED_TYPE_FIELDS as readonly string[]).includes(id);
          const c = customOf(id);
          const at = movable.indexOf(id);
          return (
            <li key={id} className="px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {labelOf(id)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {fixed ? 'Always' : kindOf(id)}
                </span>
                {tabSlot?.(id, labelOf(id))}
                {c ? (
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-0.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                    aria-expanded={editing === id}
                    onClick={() => setEditing(editing === id ? null : id)}
                  >
                    {editing === id ? 'Done' : 'Edit'}
                  </button>
                ) : null}
                {fixed ? null : (
                  <>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={`Move ${labelOf(id)} up`}
                      disabled={at <= 0}
                      onClick={() => move(id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={`Move ${labelOf(id)} down`}
                      disabled={at === movable.length - 1}
                      onClick={() => move(id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={`Remove ${labelOf(id)}`}
                      onClick={() => remove(id)}
                    >
                      <CloseIcon size={12} />
                    </button>
                  </>
                )}
              </div>
              {c && editing === id ? (
                <CustomFieldForm
                  field={c}
                  onChange={(patch) => updateCustom(id, patch)}
                  className="mt-2"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {removedSome ? (
        <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">
          Items keep what they hold in a removed field. It shows again if the field comes back.
        </p>
      ) : null}
      {adding ? (
        <NewFieldForm
          missing={missing}
          canAddCustom={custom.length < ITEM_TYPE_CUSTOM_MAX}
          onAddBuiltIn={(id) => {
            onChange({ ...draft, fields: [...ordered, id] });
            setAdding(false);
          }}
          onAddCustom={(field) => {
            const id = newCustomFieldId(field.label, [...ordered, ...custom.map((f) => f.id)]);
            onChange({ fields: [...ordered, id], custom: [...custom, { ...field, id }] });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          disabled={full}
          className="mt-2 rounded-md px-2 py-1 text-[13px] font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/10"
          onClick={() => setAdding(true)}
        >
          + Add Field
        </button>
      )}
    </div>
  );
}

// A custom field's name, options (Choice) and Show on card.
function CustomFieldForm({
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
      <input
        aria-label="Field name"
        className={FIELD_CLASS}
        value={field.label}
        maxLength={CUSTOM_FIELD_LABEL_MAX}
        onChange={(e) => onChange({ label: e.target.value })}
      />
      {field.kind === 'choice' ? (
        <textarea
          aria-label="Options, one a line"
          placeholder="Options, one a line"
          className={`${FIELD_CLASS} min-h-20`}
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
function NewFieldForm({
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
    (custom.kind !== 'choice' || (custom.options?.length ?? 0) > 0);
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
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
            <input
              aria-label="New field's name"
              placeholder="Name"
              className={FIELD_CLASS}
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
            <textarea
              aria-label="Options, one a line"
              placeholder="Options, one a line"
              className={`${FIELD_CLASS} min-h-20`}
              onChange={(e) => setCustom({ ...custom, options: optionsFrom(e.target.value) })}
            />
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
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
              })
            }
          >
            Add Custom Field
          </Button>
        ) : null}
      </div>
    </div>
  );
}
