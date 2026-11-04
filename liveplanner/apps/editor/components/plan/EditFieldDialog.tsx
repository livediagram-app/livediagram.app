'use client';

// Edit Field (docs/specs/026-plan/item-types.md "Edit Field"): Add Field's modal opened on an existing custom field,
// straight on Shape with its name and settings, Save in place of Add. All Kinds goes back to the gallery, where it
// may become another type (the tiles it can't become dimmed, each saying why). What a new type does to the values
// cards hold is counted from the field as the type is saved (edit-field-values.ts); the type editor's Save writes
// them, with the type, as one undo step. The field keeps its id.
import type { CustomFieldDef } from '@liveplanner/items';
import { AddFieldDialog } from './AddFieldDialog';
import { useEditFieldPlan } from './edit-field-values';
import type { FormulaDraft } from './FormulaEditor';
import { usePlan } from './PlanContext';

const NO_FIELDS: readonly never[] = [];
const ignore = () => {};

export function EditFieldDialog({
  typeId,
  field,
  formulaDraft,
  onSave,
  onClose,
}: {
  // The type being edited (undefined for a new one: none of its fields is on a card yet).
  typeId: string | undefined;
  // The field as the draft holds it.
  field: CustomFieldDef;
  formulaDraft?: FormulaDraft;
  onSave: (field: CustomFieldDef) => void;
  onClose: () => void;
}) {
  const plan = usePlan();
  const types = plan?.types ?? NO_FIELDS;
  // The field as the type is saved: its cards hold values of that type.
  const stored = types.find((t) => t.id === typeId)?.custom?.find((f) => f.id === field.id);
  const editPlan = useEditFieldPlan({
    typeId,
    stored,
    types,
    items: plan?.items,
    people: plan?.people,
  });
  const { id, ...shape } = field;
  return (
    <AddFieldDialog
      {...(formulaDraft ? { formulaDraft } : {})}
      missing={NO_FIELDS}
      canAddCustom
      onAddBuiltIn={ignore}
      onAddCustom={ignore}
      edit={{ field: shape, plan: editPlan, onSave: (next) => onSave({ ...next, id }) }}
      onClose={onClose}
    />
  );
}
