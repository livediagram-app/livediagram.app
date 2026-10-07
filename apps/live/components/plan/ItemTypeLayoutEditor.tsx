'use client';

// The type editor's fields and tabs as one list (docs/specs/026-plan/item-types.md "Editing a type"),
// grouped the way the card's panel shows them: On the Card (Title, Votes), Details (the panel's side
// column, renamed in place) and each tab (renamed, moved and removed in its header). A field moves within
// its group with ↑ ↓, to another group with Move To, and comes off with ×; Title and Status stay. Each
// group adds a field into itself. Edits a draft; the type editor saves it.
import { useState } from 'react';
import {
  BUILT_IN_FIELD_IDS,
  DETAILS_LABEL_DEFAULT,
  ITEM_TYPE_CUSTOM_MAX,
  ITEM_TYPE_FIELDS_MAX,
  ITEM_TYPE_TAB_LABEL_MAX,
  ITEM_TYPE_TABS_MAX,
  REQUIRED_TYPE_FIELDS,
  requiredFieldsOf,
  newCustomFieldId,
  type ItemFieldId,
} from '@livediagram/items';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloseIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  Select,
} from '@livediagram/ui';
import {
  BUILT_IN_FIELD_LABELS,
  CUSTOM_KIND_LABELS,
  CustomFieldForm,
  ICON_BUTTON,
  NewFieldForm,
} from './ItemTypeFieldForms';
import {
  addField,
  addTab,
  cardFields,
  fileField,
  groupFields,
  isKeptTab,
  movableIn,
  moveField,
  moveTab,
  orderedFields,
  removeField,
  type GroupId,
  type LayoutDraft,
} from './item-type-layout';

const ADD_BUTTON =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/10';
const NAME_INPUT =
  'min-w-0 flex-1 rounded-md border bg-transparent px-1.5 py-0.5 text-[13px] font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none dark:text-slate-50 dark:hover:border-slate-600 dark:focus:bg-slate-900';
// Details' value in Move To, whose empty value is its prompt.
const DETAILS = '__details__';
const isRequired = (f: string) => (REQUIRED_TYPE_FIELDS as readonly string[]).includes(f);

export function ItemTypeLayoutEditor({
  typeId,
  draft,
  onChange,
  detailsLabel,
  onDetailsLabel,
  removedSome,
}: {
  // The type being edited (undefined for a new one): a Project always keeps its Start and Due.
  typeId?: string | undefined;
  draft: LayoutDraft;
  onChange: (next: LayoutDraft) => void;
  // What this type calls Details: renamed here, never moved or removed.
  detailsLabel: string;
  onDetailsLabel: (label: string) => void;
  // A field has come off since the editor opened: say what happens to its values.
  removedSome: boolean;
}) {
  // The group whose Add Field form is open (Details is `null`), and the custom field being edited.
  const [adding, setAdding] = useState<GroupId | undefined>(undefined);
  const [editing, setEditing] = useState<string | null>(null);
  const fields = orderedFields(draft.fields);
  const kept = requiredFieldsOf(typeId);
  const customOf = (id: string) => draft.custom.find((f) => f.id === id);
  const labelOf = (id: string) =>
    customOf(id)?.label || BUILT_IN_FIELD_LABELS[id as ItemFieldId] || id;
  const full = fields.length >= ITEM_TYPE_FIELDS_MAX;
  const groups: { id: GroupId; label: string }[] = [
    ...draft.tabs.map((t) => ({ id: t.id, label: t.label.trim() || 'Untitled tab' })),
    { id: null, label: detailsLabel.trim() || DETAILS_LABEL_DEFAULT },
  ];

  const rowsOf = (group: GroupId | 'card', list: readonly string[]) => {
    const movable = group === 'card' ? [] : movableIn(draft, group);
    return list.map((id) => {
      const c = customOf(id);
      const at = movable.indexOf(id);
      return (
        <FieldRow
          key={id}
          label={labelOf(id)}
          kind={c ? CUSTOM_KIND_LABELS[c.kind] : null}
          required={isRequired(id)}
          removable={!kept.includes(id)}
          editing={editing === id}
          onEdit={c ? () => setEditing(editing === id ? null : id) : undefined}
          moveTargets={group === 'card' ? [] : groups.filter((g) => g.id !== group)}
          onMoveTo={(to) => onChange({ ...draft, tabs: fileField(draft.tabs, id, to) })}
          canUp={at > 0}
          canDown={at >= 0 && at < movable.length - 1}
          onMove={group === 'card' ? undefined : (by) => onChange(moveField(draft, group, id, by))}
          onRemove={() => onChange(removeField(draft, id))}
        >
          {c && editing === id ? (
            <CustomFieldForm
              field={c}
              className="mt-2"
              onChange={(patch) =>
                onChange({
                  ...draft,
                  custom: draft.custom.map((f) => (f.id === id ? { ...f, ...patch } : f)),
                })
              }
            />
          ) : null}
        </FieldRow>
      );
    });
  };

  const addForm = (group: GroupId) =>
    adding === group ? (
      <NewFieldForm
        missing={BUILT_IN_FIELD_IDS.filter((f) => !fields.includes(f))}
        canAddCustom={draft.custom.length < ITEM_TYPE_CUSTOM_MAX}
        onAddBuiltIn={(id) => {
          onChange(addField(draft, id, group));
          setAdding(undefined);
        }}
        onAddCustom={(field) => {
          const id = newCustomFieldId(field.label, [...fields, ...draft.custom.map((f) => f.id)]);
          onChange(addField(draft, id, group, { ...field, id }));
          setAdding(undefined);
        }}
        onCancel={() => setAdding(undefined)}
      />
    ) : (
      <button type="button" disabled={full} className={ADD_BUTTON} onClick={() => setAdding(group)}>
        <PlusIcon size={12} />
        Add Field
      </button>
    );

  return (
    <div className="flex flex-col gap-2.5">
      <LayoutGroup title={<span className="px-1.5">On the Card</span>} tag="Always shown">
        {rowsOf('card', cardFields(draft))}
      </LayoutGroup>
      {draft.tabs.map((t, i) => (
        <LayoutGroup
          key={t.id}
          title={
            <input
              aria-label={`Tab ${i + 1} name`}
              autoFocus={!t.label && t.fields.length === 0}
              className={`${NAME_INPUT} ${
                !t.label.trim() && t.fields.length > 0
                  ? 'border-rose-400 dark:border-rose-500'
                  : 'border-transparent'
              }`}
              value={t.label}
              maxLength={ITEM_TYPE_TAB_LABEL_MAX}
              placeholder="Name this tab"
              onChange={(e) =>
                onChange({
                  ...draft,
                  tabs: draft.tabs.map((x) =>
                    x.id === t.id ? { ...x, label: e.target.value } : x,
                  ),
                })
              }
            />
          }
          tag="Tab"
          actions={
            <>
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label={`Move ${t.label || 'tab'} up`}
                disabled={i === 0}
                onClick={() => onChange({ ...draft, tabs: moveTab(draft.tabs, i, -1) })}
              >
                <ArrowUpIcon size={14} />
              </button>
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label={`Move ${t.label || 'tab'} down`}
                disabled={i === draft.tabs.length - 1}
                onClick={() => onChange({ ...draft, tabs: moveTab(draft.tabs, i, 1) })}
              >
                <ArrowDownIcon size={14} />
              </button>
              {isKeptTab(t) ? (
                // Overview stays: the slot keeps the headers' controls lined up.
                <span aria-hidden className="h-7 w-7 shrink-0" />
              ) : (
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Remove ${t.label || 'tab'}`}
                  onClick={() =>
                    onChange({ ...draft, tabs: draft.tabs.filter((x) => x.id !== t.id) })
                  }
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </>
          }
          footer={addForm(t.id)}
          empty={
            isKeptTab(t)
              ? 'No fields yet. Add one, or move one here.'
              : 'No fields yet. Add one, or move one here; an empty tab is dropped when you save.'
          }
        >
          {rowsOf(t.id, t.fields)}
        </LayoutGroup>
      ))}
      {/* Details, the panel's side column, after the tabs: the main column (Overview first) reads first. */}
      <LayoutGroup
        title={
          <input
            aria-label="Details name"
            className={`${NAME_INPUT} border-transparent`}
            value={detailsLabel}
            maxLength={ITEM_TYPE_TAB_LABEL_MAX}
            placeholder={DETAILS_LABEL_DEFAULT}
            onChange={(e) => onDetailsLabel(e.target.value)}
          />
        }
        tag="Side column"
        footer={addForm(null)}
        empty="No fields here."
      >
        {rowsOf(null, groupFields(draft, null))}
      </LayoutGroup>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={draft.tabs.length >= ITEM_TYPE_TABS_MAX}
          className={ADD_BUTTON}
          onClick={() => onChange({ ...draft, tabs: addTab(draft.tabs) })}
        >
          <PlusIcon size={12} />
          Add Tab
        </button>
        {removedSome ? (
          <p className="text-right text-[12px] text-slate-500 dark:text-slate-400">
            Items keep what they hold in a removed field.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// One group: a header (its name, what it is, how many fields, its controls), its fields, and Add Field.
function LayoutGroup({
  title,
  tag,
  actions,
  footer,
  empty,
  children,
}: {
  title: React.ReactNode;
  tag: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  empty?: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
      <header className="flex min-h-10 items-center gap-2 px-2 py-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-50">
        {title}
        <span className="shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {tag}
        </span>
        {actions ? <div className="ml-auto flex shrink-0 items-center">{actions}</div> : null}
      </header>
      <div className="flex flex-col gap-1 px-2 pb-2">
        {children.length > 0 ? (
          <ul className="flex flex-col gap-1">{children}</ul>
        ) : empty ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-center text-[12px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
            {empty}
          </p>
        ) : null}
        {footer ? <div>{footer}</div> : null}
      </div>
    </section>
  );
}

// One field: its name and kind, Edit (a custom field), Move To, ↑ ↓ and ×; Title and Status stay put, and a
// field the type always keeps (a Project's Start and Due) moves but never comes off.
function FieldRow({
  label,
  kind,
  required,
  removable,
  editing,
  onEdit,
  moveTargets,
  onMoveTo,
  canUp,
  canDown,
  onMove,
  onRemove,
  children,
}: {
  label: string;
  kind: string | null;
  // Pinned first and fixed (Title, Status).
  required: boolean;
  // False for a field the type always keeps: no ×, and the lock says so.
  removable: boolean;
  editing: boolean;
  onEdit?: () => void;
  moveTargets: readonly { id: GroupId; label: string }[];
  onMoveTo: (to: GroupId) => void;
  canUp: boolean;
  canDown: boolean;
  onMove?: (by: -1 | 1) => void;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex min-h-8 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {label}
          {kind ? (
            <span className="ml-1.5 text-[11px] font-normal text-slate-500 dark:text-slate-400">
              {kind}
            </span>
          ) : null}
        </span>
        {!removable ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <LockIcon size={11} />
            Always
          </span>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            className={`${ICON_BUTTON} ${editing ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : ''}`}
            aria-label={editing ? `Done editing ${label}` : `Edit ${label}`}
            aria-expanded={editing}
            onClick={onEdit}
          >
            <PencilIcon size={13} />
          </button>
        ) : null}
        {moveTargets.length > 0 ? (
          <Select
            aria-label={`Move ${label} to`}
            className="w-28 shrink-0"
            size="sm"
            selectClassName="text-[12px]"
            value=""
            onChange={(e) => onMoveTo(e.target.value === DETAILS ? null : e.target.value)}
          >
            <option value="" disabled hidden>
              Move to…
            </option>
            {moveTargets.map((g) => (
              <option key={g.id ?? DETAILS} value={g.id ?? DETAILS}>
                {g.label}
              </option>
            ))}
          </Select>
        ) : null}
        {required || !onMove ? (
          // Title, Status and Votes keep the slots of the controls they lack, so every row lines up.
          <>
            <span aria-hidden className="h-7 w-7 shrink-0" />
            <span aria-hidden className="h-7 w-7 shrink-0" />
          </>
        ) : (
          <>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Move ${label} up`}
              disabled={!canUp}
              onClick={() => onMove(-1)}
            >
              <ArrowUpIcon size={14} />
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Move ${label} down`}
              disabled={!canDown}
              onClick={() => onMove(1)}
            >
              <ArrowDownIcon size={14} />
            </button>
          </>
        )}
        {!removable ? (
          <span aria-hidden className="h-7 w-7 shrink-0" />
        ) : (
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label={`Remove ${label}`}
            onClick={onRemove}
          >
            <CloseIcon size={12} />
          </button>
        )}
      </div>
      {children}
    </li>
  );
}
