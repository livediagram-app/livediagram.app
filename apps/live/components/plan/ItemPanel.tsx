'use client';

// The item panel (docs/specs/025-plan/plan-board.md "Working on a board"): every field of the item's
// type, edited in place and saved as it changes, with who made it and who last changed it. It follows
// the item wherever someone moves it, and closes if someone deletes it.
import { useState } from 'react';
import {
  BUILT_IN_FIELD_IDS,
  customFieldOf,
  isBuiltInFieldId,
  itemTitle,
  itemVoteTotal,
  typeIn,
  type Item,
  type ItemFieldId,
  type ItemFieldValue,
  type ItemPerson,
  type ItemTypeDef,
} from '@livediagram/items';
import { relativeSince } from '@livediagram/ui';
import { PlanModal, SheetRow, FIELD_CLASS } from './PlanModal';
import {
  ChecklistEditor,
  DateField,
  DebouncedText,
  LabelsEditor,
  NumberField,
  PersonPicker,
  PriorityPicker,
} from './item-field-editors';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';
import { CustomFieldEditor } from './CustomFieldEditor';

const LABELS: Partial<Record<ItemFieldId, string>> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  labels: 'Labels',
  estimate: 'Estimate',
  due: 'Due',
  checklist: 'Checklist',
  parent: 'Parent',
  description: 'Description',
};

// Drawn on their own: the title above the rows, votes below them.
const NOT_A_ROW = new Set<string>(['title', 'votes']);

export function ItemPanel({
  item,
  types,
  statuses,
  projects,
  people,
  canEdit,
  onSave,
  onType,
  onDelete,
  onClose,
}: {
  item: Item;
  // The document's item types (docs/specs/025-plan/item-types.md).
  types: readonly ItemTypeDef[];
  // The statuses this tab's boards use, by name, for the status picker.
  statuses: readonly { status: string; name: string }[];
  // The projects an item can sit under (its Parent).
  projects: readonly Item[];
  people: readonly ItemPerson[];
  canEdit: boolean;
  onSave: (field: string, value: ItemFieldValue | undefined) => void;
  onType: (type: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // When the panel opened: the footer says how long ago the last change was from here.
  const [now] = useState(() => Date.now());
  const type = typeIn(types, item.type);
  const offered = new Set<string>(type.fields);
  // The type's fields in its order, then any built-in field the item holds a value in that its type
  // does not offer. A custom field's value its type no longer offers stays stored, unshown.
  const rows = [
    ...type.fields.filter((f) => !NOT_A_ROW.has(f)),
    ...BUILT_IN_FIELD_IDS.filter(
      (f) => !NOT_A_ROW.has(f) && !offered.has(f) && item.fields[f] !== undefined,
    ),
  ];
  const id = (f: string) => `item-${item.id}-${f}`;
  const disabled = !canEdit;
  const status = typeof item.fields['status'] === 'string' ? item.fields['status'] : '';
  const statusOptions =
    status && !statuses.some((s) => s.status === status)
      ? [{ status, name: status }, ...statuses]
      : statuses;
  const field = (f: string) => {
    const value = item.fields[f];
    const custom = customFieldOf(type, f);
    if (custom) {
      return (
        <CustomFieldEditor
          id={id(f)}
          field={custom}
          value={value}
          disabled={disabled}
          onSave={(v) => onSave(f, v)}
        />
      );
    }
    if (!isBuiltInFieldId(f)) return null;
    switch (f) {
      case 'status':
        return (
          <select
            id={id(f)}
            className={FIELD_CLASS}
            disabled={disabled}
            value={status}
            onChange={(e) => onSave('status', e.target.value || undefined)}
          >
            <option value="">No status</option>
            {statusOptions.map((s) => (
              <option key={s.status} value={s.status}>
                {s.name}
              </option>
            ))}
          </select>
        );
      case 'assignee':
        return (
          <PersonPicker
            id={id(f)}
            value={value}
            people={people}
            disabled={disabled}
            onSave={(v) => onSave(f, v)}
          />
        );
      case 'priority':
        return (
          <PriorityPicker
            id={id(f)}
            value={value}
            disabled={disabled}
            onSave={(v) => onSave(f, v)}
          />
        );
      case 'labels':
        return (
          <LabelsEditor id={id(f)} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />
        );
      case 'estimate':
        return (
          <NumberField id={id(f)} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />
        );
      case 'due':
        return (
          <DateField id={id(f)} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />
        );
      case 'checklist':
        return <ChecklistEditor value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />;
      case 'parent':
        return (
          <select
            id={id(f)}
            className={FIELD_CLASS}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onSave(f, e.target.value || undefined)}
          >
            <option value="">None</option>
            {projects
              .filter((e) => e.id !== item.id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.key} {itemTitle(e)}
                </option>
              ))}
          </select>
        );
      case 'description':
        return (
          <DebouncedText
            id={id(f)}
            multiline
            value={typeof value === 'string' ? value : ''}
            placeholder="Add a description"
            disabled={disabled}
            onSave={(v) => onSave(f, v)}
          />
        );
      default:
        return null;
    }
  };
  const votes = itemVoteTotal(item);
  return (
    <PlanModal
      label={`Item #${item.key}`}
      onClose={onClose}
      header={
        <div className="flex items-center gap-2">
          <span className={ACCENT_TEXT} style={accentVars(type.color)}>
            <PlanTypeGlyph glyph={type.glyph} size={16} />
          </span>
          <select
            aria-label="Item type"
            className="rounded-md border border-transparent bg-transparent py-0.5 text-[13px] font-semibold enabled:cursor-pointer hover:border-slate-200 dark:hover:border-slate-700"
            disabled={disabled}
            value={item.type}
            onChange={(e) => onType(e.target.value)}
          >
            {!types.some((t) => t.id === item.type) ? (
              <option value={item.type}>{type.label}</option>
            ) : null}
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-slate-500 dark:text-slate-400">#{item.key}</span>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate">
            Made by {item.createdBy.name} · Changed by {item.updatedBy.name},{' '}
            {relativeSince(item.updatedAt, now)}
          </span>
          {canEdit ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md px-2 py-1 font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Delete
            </button>
          ) : null}
        </div>
      }
    >
      <div className="mb-4">
        <DebouncedText
          id={id('title')}
          value={itemTitle(item)}
          required
          placeholder="Title"
          disabled={disabled}
          onSave={(v) => onSave('title', v)}
        />
      </div>
      {rows.map((f) => (
        <SheetRow
          key={f}
          label={customFieldOf(type, f)?.label ?? LABELS[f as ItemFieldId] ?? f}
          htmlFor={f === 'checklist' ? undefined : id(f)}
        >
          {field(f)}
        </SheetRow>
      ))}
      {offered.has('votes') || votes > 0 ? (
        <SheetRow label="Votes">
          <span className="text-[13px]">{votes}</span>
        </SheetRow>
      ) : null}
    </PlanModal>
  );
}
