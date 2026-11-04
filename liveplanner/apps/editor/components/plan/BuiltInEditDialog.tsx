'use client';

// Edit Field on a built-in field (docs/specs/026-plan/item-types.md "Edit Field": Built-in fields): Add Field's modal
// opened on Shape for the built-in's own tile, where it is renamed (and the Assignee's Notifies set); All Kinds goes
// back to the gallery, where another tile makes it a new custom field of that type on Save (the tiles it can't become
// dimmed, each saying why; Status keeps its type). What that does to its values and what stops reading it are
// counted by built-in-edit-plan.ts; the type editor's Save writes it all as one undo step.
import { BUILT_IN_FIELD_NAMES, ITEM_TYPE_CUSTOM_MAX, type ItemFieldId } from '@liveplanner/items';
import { AddFieldDialog } from './AddFieldDialog';
import { BUILT_IN_ROLES, CUSTOM_MAX_NOTE, pickOf } from './add-field-kinds';
import type { NewField } from './AddFieldShape';
import { builtInStartField, onOwnTile, useBuiltInEditPlan } from './built-in-edit-plan';
import type { FormulaDraft } from './FormulaEditor';
import { usePlan } from './PlanContext';

const NO_FIELDS: readonly never[] = [];
const ignore = () => {};
const STATUS_ROLE = 'Its states are set in States.';

export function BuiltInEditDialog({
  typeId,
  id,
  name,
  notifies,
  canAddCustom,
  formulaDraft,
  onRename,
  onRetype,
  onClose,
}: {
  // The type being edited (undefined for a new one: no card holds the field yet).
  typeId: string | undefined;
  id: ItemFieldId;
  // The type's name for it as drafted (its built-in name when it has none).
  name: string;
  // The Assignee's Notifies as drafted.
  notifies: boolean;
  // Whether a field of the type's own can still be made: another tile makes one.
  canAddCustom: boolean;
  formulaDraft?: FormulaDraft;
  onRename: (name: string, notifies: boolean) => void;
  // Another tile: the custom field it becomes (its id given by the editor).
  onRetype: (field: NewField) => void;
  onClose: () => void;
}) {
  const plan = usePlan();
  const editPlan = useBuiltInEditPlan({
    id,
    typeId,
    types: plan?.types ?? NO_FIELDS,
    items: plan?.items,
    people: plan?.people,
    planTabs: plan?.planTabs,
  });
  const field = builtInStartField(id, name, notifies);
  const own = pickOf(field);
  // At the custom field cap, the other tiles say so (a new field would pass it).
  const refusalOf: typeof editPlan.refusalOf = (pick) =>
    editPlan.refusalOf(pick) ??
    (pick !== own && !canAddCustom ? CUSTOM_MAX_NOTE(ITEM_TYPE_CUSTOM_MAX) : null);
  return (
    <AddFieldDialog
      {...(formulaDraft ? { formulaDraft } : {})}
      missing={NO_FIELDS}
      canAddCustom
      onAddBuiltIn={ignore}
      onAddCustom={ignore}
      edit={{
        field,
        plan: { ...editPlan, refusalOf },
        builtIn: {
          placeholder: BUILT_IN_FIELD_NAMES[id],
          role: id === 'status' ? STATUS_ROLE : (BUILT_IN_ROLES[id] ?? ''),
          notifies: id === 'assignee',
        },
        onSave: (next) => {
          if (onOwnTile(id, next)) onRename(next.label, next.notifies === true);
          else onRetype(next);
        },
      }}
      onClose={onClose}
    />
  );
}
