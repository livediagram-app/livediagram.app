'use client';

// The type editor (docs/specs/026-plan/item-types.md "Editing a type"): a modal, a sheet rising from
// the bottom on a phone. Name, colour, glyph and fields are edited as a draft; Save applies the whole
// edit as one change, Cancel drops it. Delete Type, for a type with items, asks where they go first.
import { useId, useMemo, useState } from 'react';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPE_EXCLUDED_STATUSES_MAX,
  ITEM_TYPE_LABEL_MAX,
  PLAN_TYPE_COLOURS,
  defaultNewTitle,
  newItemTypeId,
  tabsOf,
  detailsLabelOf,
  DETAILS_LABEL_DEFAULT,
  validateItemTypeCatalogue,
  type ItemTypeDef,
} from '@livediagram/items';
import {
  Button,
  CheckIcon,
  ChevronLeftIcon,
  CloseIcon,
  DialogCloseButton,
  DuplicateIcon,
  Select,
  TextInput,
  TrashIcon,
} from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { SheetRow } from './PlanModal';
import { ColourSwatches } from './ColourSwatches';
import { ItemTypeLayoutEditor } from './ItemTypeLayoutEditor';
import { GlyphPicker } from './GlyphPicker';
import { ItemTypeEditorTabs, type TypeEditorTab } from './ItemTypeEditorTabs';
import { ItemTypeStatuses } from './ItemTypeStatuses';
import { usePlan } from './PlanContext';
import { withoutEmptyTabs, type LayoutDraft } from './item-type-layout';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

// Where a deleted type's items go: another type's id, or null to keep them (drawn as "Item").
export type DeleteTarget = string | null;

const NEW_TYPE: Omit<ItemTypeDef, 'id' | 'newTitle'> = {
  label: '',
  color: PLAN_TYPE_COLOURS[11],
  glyph: 'star',
  fields: ['title', 'status', 'description', 'assignee'],
};

export function ItemTypeEditor({
  type,
  template,
  types,
  itemCount,
  canDelete,
  onSave,
  onDelete,
  onClose,
  onDuplicate,
}: {
  // The type being edited, or null for a new one.
  type: ItemTypeDef | null;
  // A new type's starting point (Duplicate): another type's copy, named "<Name> copy".
  template?: ItemTypeDef;
  types: readonly ItemTypeDef[];
  // How many items have this type (a delete asks where they go when there are any).
  itemCount: number;
  canDelete: boolean;
  onSave: (type: ItemTypeDef) => void;
  onDelete: (moveTo: DeleteTarget) => void;
  onClose: () => void;
  // Duplicate Type, for a type that exists while the catalogue has room.
  onDuplicate?: () => void;
}) {
  const titleId = useId();
  const start = type ?? template ?? NEW_TYPE;
  const [label, setLabel] = useState(start.label);
  const [color, setColor] = useState(start.color);
  const [glyph, setGlyph] = useState(String(start.glyph));
  // The fields, custom fields and the panel's tabs (the type's own, or its one Overview tab), as one draft.
  const [layout, setLayout] = useState<LayoutDraft>(() => ({
    fields: [...start.fields],
    custom: [...(start.custom ?? [])],
    tabs: tabsOf({ ...start, id: '', newTitle: '' } as ItemTypeDef).map((t) => ({
      ...t,
      fields: [...t.fields],
    })),
  }));
  const { tabs } = layout;
  const [detailsLabel, setDetailsLabel] = useState(detailsLabelOf(start));
  // The statuses it leaves out, edited as the rest is; the tab's boards name the statuses to choose from.
  const [excluded, setExcluded] = useState<string[]>(() => [...(start.excludedStatuses ?? [])]);
  const statusNames = usePlan()?.statusNames;
  const statuses = useMemo(
    () =>
      [...(statusNames ?? new Map<string, string>())].map(([status, name]) => ({ status, name })),
    [statusNames],
  );
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<TypeEditorTab>('general');
  const others = types.filter((t) => t.id !== type?.id);
  const [moveTo, setMoveTo] = useState<DeleteTarget>(others[0]?.id ?? null);

  const removedSome = start.fields.some((f) => !layout.fields.includes(f));
  const clash = others.some((t) => t.label.toLowerCase() === label.trim().toLowerCase());
  const draft = useMemo((): ItemTypeDef => {
    const name = label.trim();
    return {
      id: type?.id ?? newItemTypeId(name || 'type', types),
      label: name,
      newTitle: type && type.label === name ? type.newTitle : defaultNewTitle(name),
      color,
      glyph,
      fields: layout.fields,
      ...(layout.custom.length ? { custom: layout.custom } : {}),
      tabs: withoutEmptyTabs(tabs).map((t) => ({ ...t, label: t.label.trim() })),
      ...(detailsLabel.trim() && detailsLabel.trim() !== DETAILS_LABEL_DEFAULT
        ? { detailsLabel: detailsLabel.trim() }
        : {}),
      ...(excluded.length ? { excludedStatuses: excluded } : {}),
    };
  }, [type, types, label, color, glyph, layout, tabs, detailsLabel, excluded]);
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
  // Too many statuses left out (one stored past the cap, or kept ids a board no longer names): its own message.
  const statusesProblem = !check.ok && check.reason.endsWith('.excludedStatuses');
  const problem = !draft.label
    ? 'Give the type a name.'
    : clash
      ? 'Another type has this name.'
      : tabProblem
        ? tabProblem
        : statusesProblem
          ? `Too many statuses turned off: a type can turn off at most ${ITEM_TYPE_EXCLUDED_STATUSES_MAX}.`
          : !check.ok
            ? 'A custom field needs a name, and a Choice field at least one option.'
            : null;

  // The tab showing, and the tabs holding what stops Save (a name problem is General's; a left-out status problem
  // is Statuses'; a tab or custom field problem is Fields').
  const flagged = new Set<TypeEditorTab>(
    !problem
      ? []
      : !draft.label || clash
        ? ['general']
        : !tabProblem && statusesProblem
          ? ['statuses']
          : ['fields'],
  );

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="3xl"
      phoneSheet
      className="max-h-[min(46rem,calc(100dvh-2rem))] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-5 pt-5 pb-2">
        <h2
          id={titleId}
          className="flex min-w-0 flex-1 items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          <span className={ACCENT_TEXT} style={accentVars(color)}>
            <PlanTypeGlyph glyph={glyph} size={18} />
          </span>
          {type ? 'Edit Card Type' : 'New Card Type'}
        </h2>
        {/* Help on card types, and the editor's own close (as Cancel: the draft is dropped). */}
        <HelpArticleLink article="planCardTypes" variant="labelled" />
        <DialogCloseButton compact onClick={onClose} />
      </div>
      {deleting ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-slate-800 dark:text-slate-100">
          <DeleteStep
            label={type?.label ?? ''}
            itemCount={itemCount}
            others={others}
            moveTo={moveTo}
            onMoveTo={setMoveTo}
          />
        </div>
      ) : (
        <ItemTypeEditorTabs
          tab={tab}
          onTab={setTab}
          flagged={flagged}
          panels={{
            general: (
              <>
                <SheetRow label="Name" htmlFor={`${titleId}-name`}>
                  <TextInput
                    id={`${titleId}-name`}
                    compact
                    value={label}
                    maxLength={ITEM_TYPE_LABEL_MAX}
                    placeholder="Customer call"
                    autoFocus={!type}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </SheetRow>
                <SheetRow label="Colour">
                  <ColourSwatches value={color} onChange={(c) => c && setColor(c)} />
                </SheetRow>
                <SheetRow label="Glyph">
                  <GlyphPicker value={glyph} colour={color} onChange={setGlyph} />
                </SheetRow>
              </>
            ),
            fields: (
              <>
                <SheetRow label="Fields and Tabs">
                  <p className="mb-2 text-[12px] text-slate-500 dark:text-slate-400">
                    Laid out as the card's panel shows them. Add, move or rename to change it.
                  </p>
                  <ItemTypeLayoutEditor
                    typeId={type?.id}
                    draft={layout}
                    onChange={setLayout}
                    detailsLabel={detailsLabel}
                    onDetailsLabel={setDetailsLabel}
                    removedSome={removedSome}
                  />
                </SheetRow>
              </>
            ),
            statuses: (
              <>
                <SheetRow label="Statuses">
                  <ItemTypeStatuses
                    statuses={statuses}
                    excluded={excluded}
                    onChange={setExcluded}
                  />
                </SheetRow>
              </>
            ),
          }}
        />
      )}
      <DialogFooter>
        {deleting ? (
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              <ChevronLeftIcon size={14} />
              Back
            </Button>
            <Button variant="danger" onClick={() => onDelete(itemCount > 0 ? moveTo : null)}>
              <TrashIcon size={14} />
              Delete Type
            </Button>
          </>
        ) : (
          <>
            {type && canDelete ? (
              <Button
                variant="secondary"
                // Duplicate Type, when there, sits beside it and ends the left group instead.
                className={`text-rose-600 dark:text-rose-400 ${onDuplicate ? '' : 'mr-auto'}`}
                onClick={() => (itemCount > 0 ? setDeleting(true) : onDelete(null))}
              >
                <TrashIcon size={14} />
                Delete Type
              </Button>
            ) : null}
            {type && onDuplicate ? (
              <Button variant="secondary" className="mr-auto" onClick={onDuplicate}>
                <DuplicateIcon size={14} />
                Duplicate Type
              </Button>
            ) : null}
            {problem && draft.label ? (
              <span className="self-center text-[12px] text-rose-600 dark:text-rose-400">
                {problem}
              </span>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              <CloseIcon size={12} />
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!!problem}
              onClick={() => check.ok && onSave(check.catalogue.types[0]!)}
            >
              <CheckIcon size={14} />
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
