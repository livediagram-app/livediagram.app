'use client';

// One field of an item, as the item panel edits it (docs/specs/026-plan/plan-board.md "Working on a
// board"): a built-in field by its kind, a custom field by its kind, and the description as rich text.
// Each saves as it changes.
import { Select } from '@livediagram/ui';
import {
  ITEM_TYPES,
  customFieldOf,
  isBuiltInFieldId,
  linkCandidates,
  typeAllowsStatus,
  itemColourValue,
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
  EstimateSelect,
  PersonPicker,
  PriorityPicker,
} from './item-field-editors';
import { CustomFieldEditor } from './CustomFieldEditor';
import { LinkedCardField } from './LinkedCardField';
import { usePlan } from './PlanContext';
import { ColourSelect } from './ColourSwatches';
import { PHASE_COLOURS } from './views/view-frame';
import { track } from '@/lib/telemetry';
import { ItemDescription } from './ItemDescription';
import { ItemComments, type ItemCommentsContext } from './ItemComments';
import type { ItemOpenVia } from './item-trail';

export const FIELD_LABELS: Partial<Record<ItemFieldId, string>> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  color: 'Colour',
  labels: 'Labels',
  estimate: 'Estimate',
  start: 'Start',
  due: 'Due',
  checklist: 'Checklist',
  description: 'Description',
  comments: 'Comments',
};

export function fieldLabel(type: ItemTypeDef, f: string): string {
  return customFieldOf(type, f)?.label ?? FIELD_LABELS[f as ItemFieldId] ?? f;
}

// Fields whose editor is not one labelled control (a label `for` would point nowhere).
export function labelsItsControl(type: ItemTypeDef, f: string): boolean {
  return (
    f !== 'checklist' &&
    f !== 'color' &&
    f !== 'description' &&
    f !== 'comments' &&
    customFieldOf(type, f)?.kind !== 'checkbox'
  );
}

export type ItemFieldContext = {
  item: Item;
  type: ItemTypeDef;
  statuses: readonly { status: string; name: string }[];
  people: readonly ItemPerson[];
  canEdit: boolean;
  // Every label the document's items carry, offered while a label is typed.
  labels: readonly string[];
  // Whether the save landed (false: refused), so a text field can go back to what is saved.
  onSave: (field: string, value: ItemFieldValue | undefined) => void | Promise<boolean>;
  onPatch: (patch: ItemPatch) => void;
  // Opens another item in the panel (the parent), stepping the panel's card trail.
  onOpenItem: (itemId: string, via: ItemOpenVia) => void;
  // The card's comments (docs/specs/026-plan/items.md "Comments"); absent, the field draws nothing.
  comments?: ItemCommentsContext;
};

export const fieldId = (item: Item, f: string) => `item-${item.id}-${f}`;

const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

export function ItemFieldEditor({ f, ctx }: { f: string; ctx: ItemFieldContext }) {
  const { item, type, canEdit, onSave } = ctx;
  const plan = usePlan();
  const items = plan?.items ?? NO_ITEMS;
  const types = plan?.types ?? ITEM_TYPES;
  const id = fieldId(item, f);
  const disabled = !canEdit;
  const value = item.fields[f];
  const custom = customFieldOf(type, f);
  // A Card field (docs/specs/026-plan/item-types.md "Card fields"): one card of the type it links to.
  if (custom?.kind === 'card' && custom.linkType) {
    return (
      <LinkedCardField
        id={id}
        label={custom.label}
        value={value}
        candidates={linkCandidates(items.values(), custom.linkType, item.id)}
        items={items}
        types={types}
        disabled={disabled}
        onSave={(v) => onSave(f, v)}
        onOpen={(target) => ctx.onOpenItem(target, 'Parent')}
      />
    );
  }
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
      // A state no board names any more reads as No status (docs/specs/026-plan/plan-board.md "A state no board
      // names"), never as its raw id; the card keeps it until another is picked.
      const raw = typeof value === 'string' ? value : '';
      const status = ctx.statuses.some((s) => s.status === raw) ? raw : '';
      const known = ctx.statuses;
      // Only the statuses this card type uses (docs/specs/026-plan/item-types.md "An item type"); a card already
      // in one it leaves out shows it, marked, and can move out of it but never back in.
      const options = known
        .filter((s) => typeAllowsStatus(type, s.status) || s.status === status)
        .map((s) =>
          typeAllowsStatus(type, s.status)
            ? s
            : { ...s, name: `${s.name} (not used by ${type.label})`, excluded: true },
        );
      // The status reads as a pill: a dot in its stage's colour (Not Started, In Progress, Done) before its name.
      const phase = status ? (plan?.statusPhases?.get(status) ?? 'todo') : null;
      return (
        <div className="relative">
          {phase ? (
            <span
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-2 w-2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: PHASE_COLOURS[phase] }}
            />
          ) : null}
          <Select
            id={id}
            className="w-full"
            selectClassName={`text-[13px] font-medium ${phase ? 'pl-6' : ''}`}
            disabled={disabled}
            value={status}
            onChange={(e) => onSave('status', e.target.value || undefined)}
          >
            <option value="">No status</option>
            {options.map((s) => (
              <option key={s.status} value={s.status} disabled={'excluded' in s}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
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
    case 'color':
      // The item's own colour, beside its type's (docs/specs/026-plan/items.md "Colour").
      return (
        <ColourSelect
          id={id}
          disabled={disabled}
          value={itemColourValue(value)}
          onChange={(c) => {
            onSave(f, c);
            track('Plan', 'Changed', 'ProjectColour');
          }}
        />
      );
    case 'estimate':
      return (
        <EstimateSelect id={id} value={value} disabled={disabled} onSave={(v) => onSave(f, v)} />
      );
    case 'start': {
      // A start after its due date is kept, and said gently (docs/specs/026-plan/items.md "Fields").
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
    case 'description':
      return <ItemDescription item={item} canEdit={canEdit} onPatch={ctx.onPatch} />;
    case 'comments':
      return ctx.comments ? (
        <ItemComments item={item} canEdit={canEdit} comments={ctx.comments} />
      ) : null;
    default:
      return null;
  }
}
