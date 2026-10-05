'use client';

// One field of an item, as the item panel edits it (docs/specs/025-plan/plan-board.md "Working on a
// board"): a built-in field by its kind, a custom field by its kind, and the description as rich text.
// Each saves as it changes.
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
import { FIELD_CLASS } from './PlanModal';
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
  onSave: (field: string, value: ItemFieldValue | undefined) => void;
  onPatch: (patch: ItemPatch) => void;
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
        <select
          id={id}
          className={FIELD_CLASS}
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
        </select>
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
        <LabelsEditor id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />
      );
    case 'estimate':
      return <NumberField id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />;
    case 'due':
      return <DateField id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />;
    case 'checklist':
      return <ChecklistEditor value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />;
    case 'parent':
      return (
        <select
          id={id}
          className={FIELD_CLASS}
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
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
        </select>
      );
    case 'description':
      return <ItemDescription item={item} canEdit={canEdit} onPatch={ctx.onPatch} />;
    default:
      return null;
  }
}
