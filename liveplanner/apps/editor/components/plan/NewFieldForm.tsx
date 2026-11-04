'use client';

// Add Field (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field), a gallery on the frame Add a Widget uses
// (gallery/GalleryFrame), in two steps: Pick (AddFieldPicker: the rail of categories and every kind as a tile under its
// category, the rail scrolling to a category as Add a Widget's does, gallery/use-gallery-spy) then
// Shape (AddFieldShape: the kind's built-in fields the type lacks as Ready to use, then the field's name, settings,
// preview and "Add {Name}"), beside the same rail. It keeps the step and the search (across the steps), and answers Escape for the modal it sits in (AddFieldDialog): Shape goes back to Pick, Pick clears a typed
// search, and then the modal closes. The categories a search leaves are worked out once per search, never per render.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { CALCULATIONS, ITEM_TYPES, type ItemFieldId } from '@liveplanner/items';
import {
  AddFieldPicker,
  AddFieldRail,
  focusFirstKind,
  pickFirstKind,
  shownCount,
} from './AddFieldPicker';
import { AddFieldShape, type BuiltInShapeOf, type NewField } from './AddFieldShape';
import {
  BUILT_INS_OF_KIND,
  categoryOfKind,
  pickOf,
  presetOf,
  readyBuiltIns,
  searchKey,
  shownCategories,
  storedKindOf,
  type KindCategoryId,
  type PickKind,
} from './add-field-kinds';
import { BUILT_IN_FIELD_LABELS, PICK_KIND_LABELS } from './ItemTypeFieldForms';
import { GalleryFrame, GalleryList } from './gallery/GalleryFrame';
import { useGallerySpy } from './gallery/use-gallery-spy';
import { usePlan } from './PlanContext';
import type { FormulaDraft } from './FormulaEditor';
import type { EditFieldPlan } from './edit-field-values';

// A tile's field as it starts: the one left by going back when it is the same tile; else the name typed so far and
// Required kept, the tile's preset settings on (a variant's option), every other setting fresh.
function freshField(pick: PickKind, from: NewField | null): NewField {
  if (from && pickOf(from) === pick) return from;
  const kind = storedKindOf(pick);
  return {
    label: from?.label ?? '',
    kind,
    ...(from?.required ? { required: true } : {}),
    ...(kind === 'calculated' ? { calculation: CALCULATIONS[0] } : {}),
    ...presetOf(pick),
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
  dialogTitleId,
  autoFocusSearch = false,
  edit,
}: {
  missing: readonly ItemFieldId[];
  canAddCustom: boolean;
  onAddBuiltIn: (id: ItemFieldId) => void;
  onAddCustom: (field: NewField) => void;
  onCancel: () => void;
  // Set to this form's Escape: true when it took it (a step back, a search cleared), false to let the modal close.
  escapeRef?: MutableRefObject<(() => boolean) | null>;
  // The type as drafted, for a Formula's names and preview.
  formulaDraft?: FormulaDraft;
  // In a modal: the id its heading takes (GalleryFrame's dialog look).
  dialogTitleId?: string | undefined;
  // The search takes focus on opening (under a mouse or a pen; never on a touch screen, so no keyboard flies up).
  autoFocusSearch?: boolean;
  // Edit Field (item-types.md "Edit Field"): an existing field, opened on Shape with its name and settings, saved by
  // Save; All Kinds offers the other types it may become (`plan` says which, and what each does to its values).
  // `builtIn`: a built-in field, renamed on its own tile (what its Shape says of it) and made a custom field on another.
  edit?:
    | {
        field: NewField;
        plan: EditFieldPlan;
        onSave: (field: NewField) => void;
        builtIn?: BuiltInShapeOf | undefined;
      }
    | undefined;
}) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  const [query, setQuery] = useState('');
  // The field being shaped (Shape), or null (Pick); the one left by going back (its name kept for the next kind),
  // the tile to focus back on Pick (going back by All Kinds or Escape, not by typing a search), and the category to
  // scroll to on arriving back (a rail entry pressed while shaping).
  const [field, setField] = useState<NewField | null>(edit?.field ?? null);
  const [left, setLeft] = useState<NewField | null>(null);
  const [focusKind, setFocusKind] = useState<PickKind | undefined>(undefined);
  const [arriveAt, setArriveAt] = useState<KindCategoryId | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const key = searchKey(query);
  const categories = useMemo(() => shownCategories(key, labelOf, builtInNamesOf), [key]);
  const count = shownCount(categories);
  // The rail and the list in step, as Add a Widget's: a rail entry scrolls to its category, the one in view marked.
  const firstShown = categories.find((c) => c.shown.length > 0)?.id ?? null;
  const rail = useGallerySpy(list, firstShown, key);

  const back = (focus: boolean, at: KindCategoryId | null = null) => {
    if (!field) return;
    setLeft(field);
    setFocusKind(focus ? pickOf(field) : undefined);
    setArriveAt(at);
    setField(null);
  };
  const onQuery = (next: string) => {
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

  // A tile picked: Add Field's fresh field; editing, its own tile gives the field back as it was (renamed as typed),
  // and a Choice made from it starts with the values its cards hold as options.
  const picked = (kind: PickKind): NewField => {
    if (!edit) return freshField(kind, left);
    const label = left?.label ?? edit.field.label;
    if (kind === pickOf(edit.field) && (!left || pickOf(left) !== kind))
      return { ...edit.field, label };
    const next = freshField(kind, left);
    const options = next.options?.length ? undefined : edit.plan.optionsFor(kind);
    return options ? { ...next, options } : next;
  };

  return (
    <GalleryFrame
      title={edit ? 'Edit Field' : 'Add a Field'}
      line={
        edit ? 'Rename it, reshape it, or pick another type.' : 'Pick what the new field holds.'
      }
      dialogTitleId={dialogTitleId}
      search={{
        label: 'Search fields',
        placeholder: 'Search fields, like money or date',
        value: query,
        onChange: onQuery,
        autoFocus: autoFocusSearch,
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
            current={field ? categoryOfKind(pickOf(field)).id : rail.current}
            onChoose={(next) => {
              if (field) back(false, next);
              else rail.goTo(next);
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
            ready={edit ? [] : readyBuiltIns(field.kind, missing)}
            canAddCustom={edit ? true : canAddCustom}
            onBack={() => back(true)}
            onAdd={edit ? edit.onSave : onAddCustom}
            onAddBuiltIn={onAddBuiltIn}
            edit={
              edit
                ? {
                    loss: edit.plan.lossOf(field, PICK_KIND_LABELS[pickOf(field)]),
                    // A built-in on its own tile is renamed; on another it is a new field of that type.
                    builtIn:
                      edit.builtIn && pickOf(field) === pickOf(edit.field) ? edit.builtIn : undefined,
                  }
                : undefined
            }
          />
        </GalleryList>
      ) : (
        <AddFieldPicker
          categories={categories}
          query={query}
          missing={edit ? [] : missing}
          canAddCustom={edit ? true : canAddCustom}
          onPick={(kind) => setField(picked(kind))}
          refusalOf={edit?.plan.refusalOf}
          current={edit ? pickOf(edit.field) : undefined}
          focusKind={focusKind}
          listRef={list}
          searchRef={search}
          onScroll={rail.spy}
          onArrive={() => {
            if (arriveAt) rail.goTo(arriveAt, true);
            else rail.spy();
          }}
        />
      )}
    </GalleryFrame>
  );
}
