'use client';

// Add Field (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field), in two steps in one popover: Pick
// (AddFieldPicker: search, then one list of kinds in an accordion) then Shape (AddFieldShape: the kind's built-in
// fields the type lacks as Ready to use, then the field's name, settings, preview and "Add {Name}"). It keeps the step, the search (across the steps) and the open group, and
// answers Escape for the popover: Shape goes back to Pick, Pick clears a typed search, and then the popover closes.
import { useEffect, useState, type MutableRefObject } from 'react';
import {
  CALCULATIONS,
  ITEM_TYPES,
  type CustomFieldKind,
  type ItemFieldId,
} from '@liveplanner/items';
import { AddFieldPicker } from './AddFieldPicker';
import { AddFieldShape, type NewField } from './AddFieldShape';
import {
  groupOfKind,
  KIND_GROUPS,
  readyBuiltIns,
  searchKey,
  type KindGroupId,
} from './add-field-kinds';
import { usePlan } from './PlanContext';

// A kind's field as it starts: the one left by going back when it is the same kind; else the name typed so far and
// Required kept, every other setting fresh.
function freshField(kind: CustomFieldKind, from: NewField | null): NewField {
  if (from?.kind === kind) return from;
  return {
    label: from?.label ?? '',
    kind,
    ...(from?.required ? { required: true } : {}),
    ...(kind === 'calculated' ? { calculation: CALCULATIONS[0] } : {}),
  };
}

export function NewFieldForm({
  missing,
  canAddCustom,
  onAddBuiltIn,
  onAddCustom,
  onCancel,
  escapeRef,
}: {
  missing: readonly ItemFieldId[];
  canAddCustom: boolean;
  onAddBuiltIn: (id: ItemFieldId) => void;
  onAddCustom: (field: NewField) => void;
  onCancel: () => void;
  // Set to this form's Escape: true when it took it (a step back, a search cleared), false to let the popover close.
  escapeRef?: MutableRefObject<(() => boolean) | null>;
}) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  const [query, setQuery] = useState('');
  const [openGroup, setOpenGroup] = useState<KindGroupId | null>(KIND_GROUPS[0]!.id);
  // The field being shaped (Shape), or null (Pick); the one left by going back (its kind focused on Pick, its name
  // kept for the next kind).
  const [field, setField] = useState<NewField | null>(null);
  const [left, setLeft] = useState<NewField | null>(null);

  const back = () => {
    if (!field) return;
    setLeft(field);
    // Its group opens, so the kind is there to land on (a search shows it as it is).
    if (!searchKey(query)) setOpenGroup(groupOfKind(field.kind));
    setField(null);
  };
  const escape = (): boolean => {
    if (field) {
      back();
      return true;
    }
    if (query) {
      setQuery('');
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (!escapeRef) return;
    escapeRef.current = escape;
    return () => {
      escapeRef.current = null;
    };
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
      {field ? (
        <AddFieldShape
          field={field}
          onChange={setField}
          types={types}
          ready={readyBuiltIns(field.kind, missing)}
          canAddCustom={canAddCustom}
          onBack={back}
          onAdd={onAddCustom}
          onAddBuiltIn={onAddBuiltIn}
        />
      ) : (
        <AddFieldPicker
          query={query}
          onQuery={setQuery}
          openGroup={openGroup}
          onOpenGroup={setOpenGroup}
          missing={missing}
          canAddCustom={canAddCustom}
          onPick={(kind) => setField(freshField(kind, left))}
          onCancel={onCancel}
          focusKind={left?.kind}
        />
      )}
    </div>
  );
}
