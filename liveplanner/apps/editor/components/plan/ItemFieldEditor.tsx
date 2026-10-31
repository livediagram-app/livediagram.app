'use client';

// One field of an item, as the item panel edits it (docs/specs/026-plan/plan-board.md "Working on a
// board"): a built-in field by its kind, a custom field by its kind, and the description and Long Text fields as
// rich text.
// Each saves as it changes.
import { Select } from '@liveplanner/ui';
import {
  ITEM_TYPES,
  builtInFieldOfKind,
  customFieldOf,
  isBuiltInFieldId,
  linkCandidates,
  linkTypesOf,
  requiredFieldEmptied,
  richFieldOf,
  typeAllowsStatus,
  typeStatusesOf,
  type Item,
  type ItemFieldId,
  type ItemFieldValue,
  type ItemPatch,
  type ItemPerson,
  type ItemTypeDef,
  type LabelUse,
} from '@liveplanner/items';
import { ChecklistEditor, DateField, EstimateSelect, PriorityPicker } from './item-field-editors';
import { LabelsEditor } from './LabelsEditor';
import { ParagraphField } from './ParagraphField';
import { PersonPicker } from './PersonPicker';
import { CustomFieldEditor } from './CustomFieldEditor';
import { CalculatedFieldValue } from './CalculatedFieldValue';
import { calculatedFieldValue } from './calculated-values';
import { LinkedCardField } from './LinkedCardField';
import { ImageFieldControl } from './ImageField';
import { usePlan } from './PlanContext';
import { isHexColour } from '@liveplanner/project';
import { ColourSelect } from './ColourSwatches';
import { PHASE_COLOURS } from './views/view-frame';
import { track } from '@/lib/telemetry';
import { ItemDescription } from './ItemDescription';
import { CardThreads } from './threads/CardThreads';
import type { ItemOpenVia } from './item-trail';

const FIELD_LABELS: Partial<Record<ItemFieldId, string>> = {
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

// Fields whose editor is not one labelled control (a label `for` would point nowhere): a custom field of a built-in
// kind as its built-in field.
export function labelsItsControl(type: ItemTypeDef, f: string): boolean {
  const kind = customFieldOf(type, f)?.kind;
  const as = (kind && builtInFieldOfKind(kind)) ?? f;
  return (
    as !== 'checklist' &&
    as !== 'color' &&
    as !== 'description' &&
    as !== 'comments' &&
    kind !== 'checkbox' &&
    kind !== 'image' &&
    kind !== 'longtext'
  );
}

export type ItemFieldContext = {
  item: Item;
  type: ItemTypeDef;
  statuses: readonly { status: string; name: string }[];
  people: readonly ItemPerson[];
  canEdit: boolean;
  // Every label the plan's cards carry, with how many carry it, most used first (labelUsage): the label menu's.
  labels: readonly LabelUse[];
  // Whether the save landed (false: refused), so a text field can go back to what is saved.
  onSave: (field: string, value: ItemFieldValue | undefined) => void | Promise<boolean>;
  onPatch: (patch: ItemPatch) => void;
  // Opens another item in the panel (the parent), stepping the panel's card trail.
  onOpenItem: (itemId: string, via: ItemOpenVia) => void;
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
  // A save fired from an event: only a text field waits for whether it landed.
  const save = (v: ItemFieldValue | undefined) => void onSave(f, v);
  // A Card field (docs/specs/026-plan/item-types.md "Card fields"): one card of any of the types it links to.
  const linkTypes = custom?.kind === 'card' ? linkTypesOf(custom) : [];
  if (custom && linkTypes.length) {
    return (
      <LinkedCardField
        id={id}
        label={custom.label}
        value={value}
        candidates={linkCandidates(items.values(), linkTypes, item.id)}
        items={items}
        types={types}
        disabled={disabled}
        onSave={save}
        onOpen={(target) => ctx.onOpenItem(target, 'Parent')}
      />
    );
  }
  // A Calculated field (docs/specs/026-plan/item-types.md "Calculated fields"): worked out, read-only.
  if (custom?.kind === 'calculated') {
    return (
      <CalculatedFieldValue
        id={id}
        field={custom}
        value={plan ? calculatedFieldValue(plan, custom, item) : null}
      />
    );
  }
  // An Image field (docs/specs/026-plan/item-types.md "Image fields"): one picture, uploaded into the media service.
  if (custom?.kind === 'image') {
    return (
      <ImageFieldControl
        id={id}
        label={custom.label}
        value={value}
        disabled={disabled}
        onSave={save}
      />
    );
  }
  // A Long Text field (docs/specs/026-plan/item-types.md "An item type"): rich text, as the description is.
  if (custom?.kind === 'longtext') {
    return (
      <ParagraphField
        item={item}
        field={custom}
        canEdit={canEdit}
        onPatch={ctx.onPatch}
        onEmpty={() => {
          // A required field is refused by the host's own save, which says why; any other clears with its
          // formatting.
          if (requiredFieldEmptied(type, item.fields, f, undefined)) return save(undefined);
          const clear = [f, richFieldOf(f)].filter((k) => k in item.fields);
          if (clear.length) ctx.onPatch({ clear });
        }}
      />
    );
  }
  // A custom field of a built-in kind (Person, Labels, Colour, Checklist) is edited as its built-in field is.
  const asBuiltIn = custom ? builtInFieldOfKind(custom.kind) : undefined;
  if (custom && !asBuiltIn) {
    return (
      <CustomFieldEditor id={id} field={custom} value={value} disabled={disabled} onSave={save} />
    );
  }
  const as = asBuiltIn ?? f;
  if (!isBuiltInFieldId(as)) return null;
  switch (as) {
    case 'status': {
      // A state no board names any more reads as No status (docs/specs/026-plan/plan-board.md "A state no board
      // names"), never as its raw id; the card keeps it until another is picked.
      const raw = typeof value === 'string' ? value : '';
      const status = ctx.statuses.some((s) => s.status === raw) ? raw : '';
      const known = ctx.statuses;
      // Only the statuses this card type uses, in its order (docs/specs/026-plan/item-types.md "The statuses a type
      // uses"), the same on every tab; a card already in one it leaves out shows it last, marked, and can move out of
      // it but never back in.
      const byId = new Map(known.map((s) => [s.status, s]));
      const options: { status: string; name: string; excluded?: true }[] = typeStatusesOf(
        type,
        byId.keys(),
      ).flatMap((id) => {
        const s = byId.get(id);
        return s ? [s] : [];
      });
      const current = byId.get(status);
      if (current && !typeAllowsStatus(type, status))
        options.push({
          ...current,
          name: `${current.name} (not used by ${type.label})`,
          excluded: true,
        });
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
            onChange={(e) => void onSave('status', e.target.value || undefined)}
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
          onSave={save}
          {...(custom ? { label: custom.label } : {})}
        />
      );
    case 'priority':
      return <PriorityPicker id={id} value={value} disabled={disabled} onSave={save} />;
    case 'labels':
      return (
        <LabelsEditor
          id={id}
          value={value}
          disabled={disabled}
          suggestions={ctx.labels}
          onSave={save}
        />
      );
    case 'color':
      // The item's own colour, beside its type's (docs/specs/026-plan/items.md "Colour").
      return (
        <ColourSelect
          id={id}
          disabled={disabled}
          value={isHexColour(value) ? value.toLowerCase() : undefined}
          onChange={(c) => {
            save(c);
            if (!asBuiltIn) track('Plan', 'Changed', 'ProjectColour');
          }}
        />
      );
    case 'estimate':
      return <EstimateSelect id={id} value={value} disabled={disabled} onSave={save} />;
    case 'start': {
      // A start after its due date is kept, and said gently (docs/specs/026-plan/items.md "Fields").
      const due = item.fields['due'];
      const late = typeof value === 'string' && typeof due === 'string' && value > due;
      return (
        <div className="flex flex-col gap-1">
          <DateField id={id} value={value} disabled={disabled} onSave={save} />
          {late ? (
            <span className="text-[12px] text-amber-700 dark:text-amber-300" role="note">
              Starts after it is due
            </span>
          ) : null}
        </div>
      );
    }
    case 'due':
      return <DateField id={id} value={value} disabled={disabled} onSave={save} />;
    case 'checklist':
      return <ChecklistEditor value={value} disabled={disabled} onSave={save} />;
    case 'description':
      return <ItemDescription item={item} canEdit={canEdit} onPatch={ctx.onPatch} />;
    case 'comments':
      // The card's comment threads (docs/specs/026-plan/items.md "Comments"), from their own context.
      return <CardThreads item={item} />;
    default:
      return null;
  }
}
