'use client';

// The type editor (docs/specs/026-plan/item-types.md "Editing a type"): a modal, a sheet rising from
// the bottom on a phone. Name, colour, glyph and fields are edited as a draft; Save applies the whole
// edit as one change, Cancel drops it. Delete Type, for a type with items, asks where they go first.
import { useId, useMemo, useState } from 'react';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPE_LABEL_MAX,
  PLAN_GLYPH_IDS,
  PLAN_TYPE_COLOURS,
  defaultNewTitle,
  newItemTypeId,
  tabsOf,
  detailsLabelOf,
  DETAILS_LABEL_DEFAULT,
  validateItemTypeCatalogue,
  type ItemTypeDef,
  type ItemTypeTab,
} from '@livediagram/items';
import { Button, Select } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { FIELD_CLASS, SheetRow } from './PlanModal';
import { ItemTypeFieldList, type FieldDraft } from './ItemTypeFieldList';
import { NOT_TABBABLE, TabPicker, TabsList, withoutEmptyTabs } from './ItemTypeTabsEditor';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

// Where a deleted type's items go: another type's id, or null to keep them (drawn as "Item").
export type DeleteTarget = string | null;

// The swatches' names, for the colour picker's buttons.
const COLOUR_NAMES: Record<string, string> = {
  '#18181b': 'Black',
  '#71717a': 'Gray',
  '#2563eb': 'Blue',
  '#eab308': 'Yellow',
  '#dc2626': 'Red',
  '#16a34a': 'Green',
  '#7c3aed': 'Violet',
  '#d97706': 'Amber',
  '#0d9488': 'Teal',
  '#db2777': 'Pink',
  '#ea580c': 'Orange',
  '#0891b2': 'Cyan',
};

const NEW_TYPE: Omit<ItemTypeDef, 'id' | 'newTitle'> = {
  label: '',
  color: PLAN_TYPE_COLOURS[11],
  glyph: 'star',
  fields: ['title', 'status', 'description', 'assignee'],
};

export function ItemTypeEditor({
  type,
  types,
  itemCount,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  // The type being edited, or null for a new one.
  type: ItemTypeDef | null;
  types: readonly ItemTypeDef[];
  // How many items have this type (a delete asks where they go when there are any).
  itemCount: number;
  canDelete: boolean;
  onSave: (type: ItemTypeDef) => void;
  onDelete: (moveTo: DeleteTarget) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const start = type ?? NEW_TYPE;
  const [label, setLabel] = useState(start.label);
  const [color, setColor] = useState(start.color);
  const [glyph, setGlyph] = useState(String(start.glyph));
  const [fields, setFields] = useState<FieldDraft>({
    fields: [...start.fields],
    custom: [...(start.custom ?? [])],
  });
  // The panel's tabs, starting from the type's own or its one Overview tab, so they can be edited.
  const [tabs, setTabs] = useState<ItemTypeTab[]>(() =>
    tabsOf({ ...start, id: '', newTitle: '' } as ItemTypeDef).map((t) => ({
      ...t,
      fields: [...t.fields],
    })),
  );
  const [detailsLabel, setDetailsLabel] = useState(detailsLabelOf(start));
  const [deleting, setDeleting] = useState(false);
  const others = types.filter((t) => t.id !== type?.id);
  const [moveTo, setMoveTo] = useState<DeleteTarget>(others[0]?.id ?? null);

  const removedSome = start.fields.some((f) => !fields.fields.includes(f));
  const clash = others.some((t) => t.label.toLowerCase() === label.trim().toLowerCase());
  const draft = useMemo((): ItemTypeDef => {
    const name = label.trim();
    return {
      id: type?.id ?? newItemTypeId(name || 'type', types),
      label: name,
      newTitle: type && type.label === name ? type.newTitle : defaultNewTitle(name),
      color,
      glyph,
      fields: fields.fields,
      ...(fields.custom.length ? { custom: fields.custom } : {}),
      tabs: withoutEmptyTabs(tabs).map((t) => ({ ...t, label: t.label.trim() })),
      ...(detailsLabel.trim() && detailsLabel.trim() !== DETAILS_LABEL_DEFAULT
        ? { detailsLabel: detailsLabel.trim() }
        : {}),
    };
  }, [type, types, label, color, glyph, fields, tabs, detailsLabel]);
  const tabNames = withoutEmptyTabs(tabs).map((t) => t.label.trim().toLowerCase());
  const tabProblem = tabNames.some((n) => !n)
    ? 'Give every tab a name.'
    : new Set(tabNames).size !== tabNames.length
      ? 'Two tabs have the same name.'
      : null;
  // The same check the api makes, on this type alone: a bad custom field never reaches a save.
  const check = useMemo(
    () => validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types: [draft] }),
    [draft],
  );
  const problem = !draft.label
    ? 'Give the type a name.'
    : clash
      ? 'Another type has this name.'
      : tabProblem
        ? tabProblem
        : !check.ok
          ? 'A custom field needs a name, and a Choice field at least one option.'
          : null;

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="lg"
      phoneSheet
      className="max-h-[min(46rem,calc(100dvh-2rem))] overflow-hidden"
    >
      <div className="border-b border-slate-100 px-5 pt-5 pb-3 dark:border-slate-800">
        <h2
          id={titleId}
          className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          <span className={ACCENT_TEXT} style={accentVars(color)}>
            <PlanTypeGlyph glyph={glyph} size={18} />
          </span>
          {type ? 'Edit Card Type' : 'New Card Type'}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-slate-800 dark:text-slate-100">
        {deleting ? (
          <DeleteStep
            label={type?.label ?? ''}
            itemCount={itemCount}
            others={others}
            moveTo={moveTo}
            onMoveTo={setMoveTo}
          />
        ) : (
          <>
            <SheetRow label="Name" htmlFor={`${titleId}-name`}>
              <input
                id={`${titleId}-name`}
                className={FIELD_CLASS}
                value={label}
                maxLength={ITEM_TYPE_LABEL_MAX}
                placeholder="Customer call"
                autoFocus={!type}
                onChange={(e) => setLabel(e.target.value)}
              />
            </SheetRow>
            <SheetRow label="Colour">
              <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5">
                {PLAN_TYPE_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={COLOUR_NAMES[c] ?? c}
                    className={`h-7 w-7 rounded-full ring-offset-2 transition dark:ring-offset-slate-900 ${
                      color === c ? 'ring-2 ring-brand-500' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </SheetRow>
            <SheetRow label="Glyph">
              <div role="radiogroup" aria-label="Glyph" className="flex flex-wrap gap-1.5">
                {PLAN_GLYPH_IDS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={glyph === g}
                    aria-label={`${g[0]!.toUpperCase()}${g.slice(1)} glyph`}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                      glyph === g
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                    }`}
                    onClick={() => setGlyph(g)}
                  >
                    <span className={ACCENT_TEXT} style={accentVars(color)}>
                      <PlanTypeGlyph glyph={g} size={18} />
                    </span>
                  </button>
                ))}
              </div>
            </SheetRow>
            <SheetRow label="Fields">
              <ItemTypeFieldList
                draft={fields}
                onChange={setFields}
                removedSome={removedSome}
                tabSlot={(f, label) =>
                  NOT_TABBABLE.has(f) ? null : (
                    <TabPicker
                      field={f}
                      label={label}
                      tabs={tabs}
                      detailsLabel={detailsLabel.trim()}
                      onChange={setTabs}
                    />
                  )
                }
              />
            </SheetRow>
            <SheetRow label="Tabs">
              <p className="mb-2 text-[12px] text-slate-500 dark:text-slate-400">
                Choose where each field shows beside it above: Details, a tab, or New Tab…. Rename
                Details and Overview as you like; they stay. Any other tab with no fields is dropped
                when you save.
              </p>
              <TabsList
                tabs={tabs}
                detailsLabel={detailsLabel}
                onDetailsLabel={setDetailsLabel}
                onChange={setTabs}
              />
            </SheetRow>
          </>
        )}
      </div>
      <DialogFooter>
        {deleting ? (
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Back
            </Button>
            <Button variant="danger" onClick={() => onDelete(itemCount > 0 ? moveTo : null)}>
              Delete Type
            </Button>
          </>
        ) : (
          <>
            {type && canDelete ? (
              <Button
                variant="secondary"
                className="mr-auto text-rose-600 dark:text-rose-400"
                onClick={() => (itemCount > 0 ? setDeleting(true) : onDelete(null))}
              >
                Delete Type
              </Button>
            ) : null}
            {problem && draft.label ? (
              <span className="self-center text-[12px] text-rose-600 dark:text-rose-400">
                {problem}
              </span>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!!problem}
              onClick={() => check.ok && onSave(check.catalogue.types[0]!)}
            >
              Save
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}

// Deleting a type with items: where they go.
function DeleteStep({
  label,
  itemCount,
  others,
  moveTo,
  onMoveTo,
}: {
  label: string;
  itemCount: number;
  others: readonly ItemTypeDef[];
  moveTo: DeleteTarget;
  onMoveTo: (next: DeleteTarget) => void;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        {itemCount === 1 ? 'One item is' : `${itemCount} items are`} a {label}. Where should{' '}
        {itemCount === 1 ? 'it' : 'they'} go?
      </p>
      <Select
        aria-label="Move the items to"
        className="w-full"
        selectClassName="text-[13px]"
        value={moveTo ?? ''}
        onChange={(e) => onMoveTo(e.target.value || null)}
      >
        {others.map((t) => (
          <option key={t.id} value={t.id}>
            Make {itemCount === 1 ? 'it a' : 'them'} {t.label}
            {itemCount === 1 ? '' : ' items'}
          </option>
        ))}
        <option value="">Keep as Item</option>
      </Select>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Kept items keep their fields and show as a plain Item card.
      </p>
    </div>
  );
}
