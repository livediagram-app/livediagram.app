'use client';

// Add Field (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field), a gallery on the frame Add a Widget uses
// (gallery/GalleryFrame), in two steps: Pick (AddFieldPicker: the rail of categories and the kinds as tiles) then
// Shape (AddFieldShape: the kind's built-in fields the type lacks as Ready to use, then the field's name, settings,
// preview and "Add {Name}"), beside the same rail. It keeps the step, the search (across the steps) and the category
// shown, and answers Escape for the popover: Shape goes back to Pick, Pick clears a typed search, and then the popover
// closes. The categories a search leaves are worked out once per search, never per render.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  CALCULATIONS,
  ITEM_TYPES,
  type CustomFieldKind,
  type ItemFieldId,
} from '@liveplanner/items';
import {
  AddFieldPicker,
  AddFieldRail,
  focusFirstKind,
  pickFirstKind,
  shownCount,
} from './AddFieldPicker';
import { AddFieldShape, type NewField } from './AddFieldShape';
import {
  BUILT_INS_OF_KIND,
  categoryOfKind,
  readyBuiltIns,
  searchKey,
  shownCategories,
  type CategoryChoice,
  type PickKind,
} from './add-field-kinds';
import { BUILT_IN_FIELD_LABELS, PICK_KIND_LABELS } from './ItemTypeFieldForms';
import { GalleryFrame, GalleryList } from './gallery/GalleryFrame';
import { usePlan } from './PlanContext';
import type { FormulaDraft } from './FormulaEditor';

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

const labelOf = (kind: PickKind) => PICK_KIND_LABELS[kind];
const builtInNamesOf = (kind: PickKind) =>
  (BUILT_INS_OF_KIND[kind] ?? []).map((id) => BUILT_IN_FIELD_LABELS[id]);

export function NewFieldForm({
  missing,
  canAddCustom,
  onAddBuiltIn,
  onAddCustom,
  onCancel,
  escapeRef,
  formulaDraft,
}: {
  missing: readonly ItemFieldId[];
  canAddCustom: boolean;
  onAddBuiltIn: (id: ItemFieldId) => void;
  onAddCustom: (field: NewField) => void;
  onCancel: () => void;
  // Set to this form's Escape: true when it took it (a step back, a search cleared), false to let the popover close.
  escapeRef?: MutableRefObject<(() => boolean) | null>;
  // The type as drafted, for a Formula's names and preview.
  formulaDraft?: FormulaDraft;
}) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<CategoryChoice>('all');
  // The field being shaped (Shape), or null (Pick); the one left by going back (its name kept for the next kind),
  // and the kind to focus back on Pick (going back by All Kinds or Escape, not by typing a search).
  const [field, setField] = useState<NewField | null>(null);
  const [left, setLeft] = useState<NewField | null>(null);
  const [focusKind, setFocusKind] = useState<CustomFieldKind | undefined>(undefined);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const key = searchKey(query);
  const categories = useMemo(() => shownCategories(key, labelOf, builtInNamesOf), [key]);
  const count = shownCount(categories);

  const back = (focus: boolean) => {
    if (!field) return;
    setLeft(field);
    setFocusKind(focus ? field.kind : undefined);
    setField(null);
  };
  const onQuery = (next: string) => {
    // Starting a search looks in every category.
    if (!key && searchKey(next)) setChoice('all');
    setQuery(next);
    back(false);
  };
  const escape = (): boolean => {
    if (field) {
      back(true);
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
    <GalleryFrame
      title="Add Field"
      line="Pick what the new field holds."
      search={{
        label: 'Search fields',
        placeholder: 'Search fields, like money or date',
        value: query,
        onChange: onQuery,
        onKeyDown: (e) => {
          if (field) return;
          if (e.key === 'ArrowDown') focusFirstKind(list.current, e);
          else if (e.key === 'Enter') {
            e.preventDefault();
            if (key) pickFirstKind(list.current);
          }
        },
      }}
      searchRef={search}
      onClose={onCancel}
      rail={
        key && count === 0 ? null : (
          <AddFieldRail
            categories={categories}
            // Shaping, the kind's own category is marked.
            choice={field ? categoryOfKind(field.kind).id : choice}
            onChoose={(next) => {
              setChoice(next);
              back(false);
            }}
            // Shaping on a phone, the form has the room; All Kinds goes back.
            className={field ? '@max-[600px]:hidden' : ''}
          />
        )
      }
      said={key ? `${count} ${count === 1 ? 'field matches' : 'fields match'}` : ''}
    >
      {field ? (
        <GalleryList bare>
          <AddFieldShape
            field={field}
            onChange={setField}
            types={types}
            formulaDraft={formulaDraft}
            ready={readyBuiltIns(field.kind, missing)}
            canAddCustom={canAddCustom}
            onBack={() => back(true)}
            onAdd={onAddCustom}
            onAddBuiltIn={onAddBuiltIn}
          />
        </GalleryList>
      ) : (
        <AddFieldPicker
          categories={categories}
          choice={choice}
          query={query}
          missing={missing}
          canAddCustom={canAddCustom}
          onPick={(kind) => setField(freshField(kind, left))}
          focusKind={focusKind}
          listRef={list}
          searchRef={search}
        />
      )}
    </GalleryFrame>
  );
}
