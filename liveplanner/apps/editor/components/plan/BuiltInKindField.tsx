'use client';

// A custom field of a built-in kind (docs/specs/026-plan/item-types.md "Custom field kinds") where it is asked for
// outside the card panel (New {Type}'s required fields): the built-in field's own control, a Person's people picker,
// Labels' chips, Colour's picker and Checklist's rows. The card panel draws them through ItemFieldEditor.
import { builtInFieldOfKind, type CustomFieldKind, type ItemFieldValue } from '@liveplanner/items';
import { isHexColour } from '@liveplanner/project';
import { ChecklistEditor } from './item-field-editors';
import { LabelsEditor } from './LabelsEditor';
import { ColourSelect } from './ColourSwatches';
import { PersonPicker } from './PersonPicker';
import { usePlan } from './PlanContext';

export function BuiltInKindField({
  id,
  label,
  kind,
  value,
  onSave,
  multiple = false,
}: {
  id: string;
  // The field's name.
  label: string;
  kind: CustomFieldKind;
  value: ItemFieldValue | undefined;
  onSave: (value: ItemFieldValue | undefined) => void;
  // A Person field that holds several (item-types.md "Holds Several").
  multiple?: boolean;
}) {
  const plan = usePlan();
  switch (builtInFieldOfKind(kind)) {
    case 'assignee':
      return (
        <PersonPicker
          id={id}
          value={value}
          people={plan?.people ?? []}
          disabled={false}
          onSave={onSave}
          label={label}
          multiple={multiple}
        />
      );
    case 'labels':
      return <LabelsEditor id={id} value={value} disabled={false} onSave={onSave} />;
    case 'color':
      return (
        <ColourSelect
          id={id}
          disabled={false}
          value={isHexColour(value) ? value.toLowerCase() : undefined}
          onChange={onSave}
        />
      );
    case 'checklist':
      return <ChecklistEditor value={value} disabled={false} onSave={onSave} />;
    default:
      return null;
  }
}
