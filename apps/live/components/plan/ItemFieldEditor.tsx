'use client';

// One field of an item, as the item panel edits it (docs/specs/025-plan/plan-board.md "Working on a
// board"): a built-in field by its kind, a custom field by its kind, and the description as rich text.
// Each saves as it changes.
import { ChevronRightIcon, Select } from '@livediagram/ui';
import {
  customFieldOf,
  isBuiltInFieldId,
  itemTitle,
  type Item,
  type ItemFieldId,
  type ItemFieldValue,
  type ItemPatch,
  type ItemPerson,
  type ItemTypeDef,
} from '@livediagram/items';
import {
  ChecklistEditor,
  DateField,
  LabelsEditor,
  NumberField,
  PersonPicker,
  PriorityPicker,
} from './item-field-editors';
import { CustomFieldEditor } from './CustomFieldEditor';
import { ItemDescription } from './ItemDescription';

export const FIELD_LABELS: Partial<Record<ItemFieldId, string>> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  labels: 'Labels',
  estimate: 'Estimate',
  start: 'Start',
  due: 'Due',
  checklist: 'Checklist',
  parent: 'Parent',
  description: 'Description',
};

export function fieldLabel(type: ItemTypeDef, f: string): string {
  return customFieldOf(type, f)?.label ?? FIELD_LABELS[f as ItemFieldId] ?? f;
}

// Fields whose editor is not one labelled control (a label `for` would point nowhere).
export function labelsItsControl(type: ItemTypeDef, f: string): boolean {
  return f !== 'checklist' && f !== 'description' && customFieldOf(type, f)?.kind !== 'checkbox';
}

export type ItemFieldContext = {
  item: Item;
  type: ItemTypeDef;
  statuses: readonly { status: string; name: string }[];
  projects: readonly Item[];
  people: readonly ItemPerson[];
  canEdit: boolean;
  // Every label the document's items carry, offered while a label is typed.
  labels: readonly string[];
  onSave: (field: string, value: ItemFieldValue | undefined) => void;
  onPatch: (patch: ItemPatch) => void;
  // Opens another item in the panel (the parent).
  onOpenItem: (itemId: string) => void;
};

export const fieldId = (item: Item, f: string) => `item-${item.id}-${f}`;

export function ItemFieldEditor({ f, ctx }: { f: string; ctx: ItemFieldContext }) {
  const { item, type, canEdit, onSave } = ctx;
  const id = fieldId(item, f);
  const disabled = !canEdit;
  const value = item.fields[f];
  const custom = customFieldOf(type, f);
  if (custom) {
    return (
      <CustomFieldEditor
        id={id}
        field={custom}
        value={value}
        disabled={disabled}
        onSave={(v) => onSave(f, v)}
      />
    );
  }
  if (!isBuiltInFieldId(f)) return null;
  switch (f) {
    case 'status': {
      const status = typeof value === 'string' ? value : '';
      const options =
        status && !ctx.statuses.some((s) => s.status === status)
          ? [{ status, name: status }, ...ctx.statuses]
          : ctx.statuses;
      return (
        <Select
          id={id}
          className="w-full"
          selectClassName="text-[13px]"
          disabled={disabled}
          value={status}
          onChange={(e) => onSave('status', e.target.value || undefined)}
        >
          <option value="">No status</option>
          {options.map((s) => (
            <option key={s.status} value={s.status}>
              {s.name}
            </option>
          ))}
        </Select>
      );
    }
    case 'assignee':
      return (
        <PersonPicker
          id={id}
          value={value}
          people={ctx.people}
          disabled={disabled}
          onSave={(v) => onSave(f, v)}
        />
      );
    case 'priority':
      return (
        <PriorityPicker id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />
      );
    case 'labels':
      return (
        <LabelsEditor
          id={id}
          value={value}
          disabled={disabled}
          suggestions={ctx.labels}
          onSave={(v) => onSave(f, v)}
        />
      );
    case 'estimate':
      return <NumberField id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />;
    case 'start': {
      // A start after its due date is kept, and said gently (docs/specs/025-plan/items.md "Fields").
      const due = item.fields['due'];
      const late = typeof value === 'string' && typeof due === 'string' && value > due;
      return (
        <div className="flex flex-col gap-1">
          <DateField id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />
          {late ? (
            <span className="text-[12px] text-amber-700 dark:text-amber-300" role="note">
              Starts after it is due
            </span>
          ) : null}
        </div>
      );
    }
    case 'due':
      return <DateField id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />;
    case 'checklist':
      return <ChecklistEditor value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />;
    case 'parent': {
      const parentId = typeof value === 'string' ? value : '';
      const parent = parentId ? ctx.projects.find((p) => p.id === parentId) : undefined;
      return (
        <div className="flex items-center gap-1.5">
          <Select
            id={id}
            className="min-w-0 flex-1"
            selectClassName="text-[13px]"
            disabled={disabled}
            value={parentId}
            onChange={(e) => onSave(f, e.target.value || undefined)}
          >
            <option value="">None</option>
            {ctx.projects
              .filter((e) => e.id !== item.id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.key} {itemTitle(e)}
                </option>
              ))}
          </Select>
          {/* The parent opens in this panel, so it can be read or changed and come back from. */}
          {parent ? (
            <button
              type="button"
              aria-label={`Open #${parent.key} ${itemTitle(parent)}`}
              className="flex h-[34px] shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => ctx.onOpenItem(parent.id)}
            >
              Open
              <ChevronRightIcon size={12} />
            </button>
          ) : null}
        </div>
      );
    }
    case 'description':
      return <ItemDescription item={item} canEdit={canEdit} onPatch={ctx.onPatch} />;
    default:
      return null;
  }
}
