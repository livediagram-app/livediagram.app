'use client';

// The type editor (docs/specs/026-plan/item-types.md "Editing a type"): a modal, a sheet rising from
// the bottom on a phone. Name, colour, glyph and fields are edited as a draft; Save applies the whole
// edit as one change, Cancel drops it. Delete Type, for a type with items, asks where they go first.
import { pickableStatuses } from './column-status-picks';
import { useId, useMemo, useState } from 'react';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPE_STATUSES_MAX,
  NEW_ITEM_TYPE,
  defaultNewTitle,
  newItemTypeId,
  tabsOf,
  detailsLabelOf,
  DETAILS_LABEL_DEFAULT,
  typeStatusesOf,
  validateItemTypeCatalogue,
  baseOf,
  basesFor,
  inheritFrom,
  inheritedFieldIds,
  inheritingTypesOf,
  type ItemTypeDef,
} from '@liveplanner/items';
import {
  Button,
  CheckIcon,
  CloseIcon,
  DialogCloseButton,
  DuplicateIcon,
  TrashIcon,
} from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { ConfirmPopover } from '@liveworkspace/workbench/components/primitives/ConfirmPopover';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import {
  CardTypeShowMeButton,
  CardTypeTourStage,
  useCardTypeTour,
} from '@/components/tour/CardTypeTour';
import { SheetRow } from './PlanModal';
import { ItemTypeConfiguration } from './ItemTypeConfiguration';
import { ItemTypeEditorTabs, type TypeEditorTab } from './ItemTypeEditorTabs';
import { ItemTypeStatuses } from './ItemTypeStatuses';
import { ItemTypeDisplay, type CardDisplayDraft } from './ItemTypeDisplay';
import { ItemTypeCardColour } from './ItemTypeCardColour';
import { InheritedPartNotice, InheritsFromRow } from './ItemTypeInheritance';
import { track } from '@/lib/telemetry';
import { usePlan } from './PlanContext';
import { withoutEmptyTabs, type LayoutDraft } from './item-type-layout';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

// Where a deleted type's items go: another type's id, or null to keep them (drawn as "Item").

const NEW_TYPE = NEW_ITEM_TYPE;

export function ItemTypeEditor({
  type,
  template,
  types,
  itemCount,
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
  // How many cards (out of the Trash) have this type: a delete says they go to the Trash with it.
  itemCount: number;
  onSave: (type: ItemTypeDef) => void;
  // Deletes the type and moves its cards to the Trash, once confirmed.
  onDelete: () => void;
  onClose: () => void;
  // Duplicate Type, for a type that exists while the catalogue has room.
  onDuplicate?: () => void;
}) {
  const titleId = useId();
  const start = type ?? template ?? NEW_TYPE;
  const [label, setLabel] = useState(start.label);
  const [color, setColor] = useState(start.color);
  const [glyph, setGlyph] = useState(start.glyph);
  // The fields, custom fields and the panel's tabs (the type's own, or its one Overview tab), as one draft.
  const [layout, setLayout] = useState<LayoutDraft>(() => ({
    fields: [...start.fields],
    custom: [...(start.custom ?? [])],
    tabs: tabsOf({ ...start, id: '', newTitle: '' }).map((t) => ({
      ...t,
      fields: [...t.fields],
    })),
    ...(start.assigneeNotifies === false ? { assigneeNotifies: false as const } : {}),
  }));
  const { tabs } = layout;
  const [detailsLabel, setDetailsLabel] = useState(detailsLabelOf(start));
  const plan = usePlan();
  const statusNames = plan?.statusNames;
  // The statuses it uses, in order, edited as the rest is (docs/specs/026-plan/item-types.md "The statuses a type
  // uses"); a type stored before the list (or a new one) starts on every status the boards name, less any it left
  // out. Always saved, so such a type is saved in the new shape.
  const [used, setUsed] = useState<string[]>(() => [
    ...typeStatusesOf(start, statusNames?.keys() ?? []),
  ]);
  // What its cards show at each card size (the Display tab); a size absent takes its default.
  const [display, setDisplay] = useState<CardDisplayDraft>(() => ({ ...start.display }));
  // The Colour field that tints its cards (Card Colour, item-types.md "Fields by role"); absent is the built-in.
  const [colourField, setColourField] = useState(start.colourField);
  // The Default State: the status a card made outside a board starts in (none: '').
  const [defaultStatus, setDefaultStatus] = useState(start.defaultStatus ?? '');
  const planItems = plan?.items;
  // The boards' statuses, then any a card is in that no board names (shown under No Board in States).
  const statuses = useMemo(
    () =>
      [
        ...pickableStatuses(statusNames ?? new Map<string, string>(), planItems?.values() ?? []),
      ].map(([status, name]) => ({ status, name })),
    [statusNames, planItems],
  );
  // The Delete Type button while its confirmation is open.
  const [confirmingAt, setConfirmingAt] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<TypeEditorTab>('configuration');
  // Show Me: the tour of making a card type, run on this editor (docs/specs/026-plan/item-types.md).
  const tour = useCardTypeTour(setTab);
  const others = types.filter((t) => t.id !== type?.id);
  // Its base type (docs/specs/026-plan/item-types.md "Inherited types"), the types it may inherit from, and those
  // inheriting from it.
  const [inherits, setInherits] = useState(start.inherits);
  const base = baseOf({ id: type?.id ?? '', inherits }, types);
  const bases = useMemo(() => basesFor(type?.id, types), [type?.id, types]);
  const heirs = useMemo(() => (type ? inheritingTypesOf(type.id, types) : []), [type, types]);
  const inheritedIds = useMemo(
    () => (base ? inheritedFieldIds({ id: '', inherits: base.id }, types) : undefined),
    [base, types],
  );

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
      ...(layout.assigneeNotifies === false ? { assigneeNotifies: false } : {}),
      tabs: withoutEmptyTabs(tabs).map((t) => ({ ...t, label: t.label.trim() })),
      ...(detailsLabel.trim() && detailsLabel.trim() !== DETAILS_LABEL_DEFAULT
        ? { detailsLabel: detailsLabel.trim() }
        : {}),
      statuses: used,
      ...(defaultStatus && used.includes(defaultStatus) ? { defaultStatus } : {}),
      ...(Object.keys(display).length ? { display } : {}),
      // Kept only while the type still has the field (a field taken off reads as the built-in Colour again).
      ...(colourField &&
      layout.custom.some((c) => c.id === colourField && c.kind === 'colour') &&
      layout.fields.includes(colourField)
        ? { colourField }
        : {}),
      // Its base and its own fields; the check below resolves the rest from the base.
      ...(base && inheritedIds
        ? { inherits: base.id, ownFields: layout.fields.filter((f) => !inheritedIds.has(f)) }
        : {}),
    };
  }, [
    base,
    inheritedIds,
    type,
    types,
    label,
    color,
    glyph,
    layout,
    tabs,
    detailsLabel,
    used,
    defaultStatus,
    display,
    colourField,
  ]);
  const tabNames = withoutEmptyTabs(tabs).map((t) => t.label.trim().toLowerCase());
  const tabProblem = tabNames.some((n) => !n)
    ? 'Give every tab a name.'
    : new Set(tabNames).size !== tabNames.length
      ? 'Two tabs have the same name.'
      : null;
  // The same check the api makes, on the catalogue with this draft in place: a bad custom field never reaches a save,
  // an inherited type comes back resolved from its base, and a base whose change takes a type inheriting from it past
  // a cap says so.
  const all = useMemo(
    () => (type ? types.map((t) => (t.id === type.id ? draft : t)) : [...types, draft]),
    [type, types, draft],
  );
  const check = useMemo(
    () => validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types: all }),
    [all],
  );
  const at = all.indexOf(draft);
  const saved = check.ok ? check.catalogue.types[at] : undefined;
  // The type a refusal names, when it is another (one inheriting from this one).
  const refusedAt = check.ok ? -1 : Number(/^types\[(\d+)\]/.exec(check.reason)?.[1] ?? at);
  const heirProblem = refusedAt >= 0 && refusedAt !== at ? all[refusedAt] : undefined;
  // Too many statuses on (kept ids a board no longer names count too): its own message.
  const statusesProblem = !check.ok && !heirProblem && check.reason.endsWith('.statuses');
  const problem = !draft.label
    ? 'Give the type a name.'
    : clash
      ? 'Another type has this name.'
      : tabProblem
        ? tabProblem
        : heirProblem
          ? `${heirProblem.label} inherits from this type and can’t hold any more fields.`
          : statusesProblem
            ? `Too many states on: a type can use at most ${ITEM_TYPE_STATUSES_MAX}.`
            : !check.ok
              ? 'A custom field needs a name, and a Choice field at least one option.'
              : null;

  // The tabs holding what stops Save (a status list problem is States'; a clashing name, a tab or a custom field
  // problem is Configuration's). A missing name is not flagged: a new type starts without one, and Save says so.
  const flagged = new Set<TypeEditorTab>(
    !problem || !draft.label
      ? []
      : !clash && !tabProblem && statusesProblem
        ? ['statuses']
        : ['configuration'],
  );

  // A base chosen: the draft laid out from it at once, any fields only this type had kept as its own.
  const chooseBase = (next: ItemTypeDef) => {
    // Moving from one base to another keeps only this type's own fields, never the old base's.
    const own =
      base && inheritedIds
        ? {
            ...draft,
            fields: draft.fields.filter((f) => !inheritedIds.has(f)),
            custom: (draft.custom ?? []).filter((c) => !inheritedIds.has(c.id)),
          }
        : draft;
    const resolved = inheritFrom(own, next);
    setInherits(next.id);
    setLayout({
      fields: [...resolved.fields],
      custom: [...(resolved.custom ?? [])],
      tabs: tabsOf(resolved).map((t) => ({ ...t, fields: [...t.fields] })),
      ...(resolved.assigneeNotifies === false ? { assigneeNotifies: false as const } : {}),
    });
    setDetailsLabel(detailsLabelOf(resolved));
    setUsed([...typeStatusesOf(resolved, statusNames?.keys() ?? [])]);
    setDefaultStatus(resolved.defaultStatus ?? '');
    setDisplay({ ...resolved.display });
    setColourField(resolved.colourField);
  };
  const inherited = base && inheritedIds ? { from: base.label, ids: inheritedIds } : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="3xl"
      phoneSheet
      // While Show Me runs, Escape is the tour's, never the editor's.
      closeOnEscape={!tour.active}
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
          {/* Named for the type as saved, so the title stays put while its Name is edited. */}
          {type ? `Edit ${type.label} Card Type` : 'New Card Type'}
        </h2>
        {/* Show Me, Help on card types, and the editor's own close (as Cancel: the draft is dropped). */}
        <CardTypeShowMeButton tour={tour} />
        <HelpArticleLink article="planCardTypes" variant="labelled" />
        <DialogCloseButton compact onClick={onClose} />
      </div>
      <ItemTypeEditorTabs
        tab={tab}
        onTab={setTab}
        flagged={flagged}
        panels={{
          configuration: (
            <ItemTypeConfiguration
              nameId={`${titleId}-name`}
              isNew={!type}
              label={label}
              onLabel={setLabel}
              glyph={glyph}
              onGlyph={setGlyph}
              color={color}
              onColor={setColor}
              typeId={type?.id}
              layout={layout}
              onLayout={setLayout}
              detailsLabel={detailsLabel}
              onDetailsLabel={setDetailsLabel}
              removedSome={removedSome}
              inherited={inherited}
              inheritance={
                <InheritsFromRow
                  id={`${titleId}-inherits`}
                  base={base}
                  bases={bases}
                  heirs={heirs}
                  onBase={chooseBase}
                  onDetach={() => setInherits(undefined)}
                />
              }
            />
          ),
          display: (
            <div data-tour-id="card-type-display">
              {base ? (
                <InheritedPartNotice typeLabel={label} baseLabel={base.label} part="display">
                  <ItemTypeDisplay type={draft} display={display} onChange={setDisplay} />
                </InheritedPartNotice>
              ) : (
                <>
                  <SheetRow label="Display">
                    <ItemTypeDisplay type={draft} display={display} onChange={setDisplay} />
                  </SheetRow>
                  <ItemTypeCardColour
                    type={draft}
                    onChange={(field) => {
                      setColourField(field);
                      track('Plan', 'Changed', 'CardColourField');
                    }}
                  />
                </>
              )}
            </div>
          ),
          statuses: (
            <>
              <div data-tour-id="card-type-states">
                {base ? (
                  <InheritedPartNotice typeLabel={label} baseLabel={base.label} part="states">
                    <ItemTypeStatuses
                      statuses={statuses}
                      used={used}
                      onChange={setUsed}
                      defaultStatus={defaultStatus}
                      onDefaultStatus={setDefaultStatus}
                      {...(plan?.statusBoards ? { boards: plan.statusBoards } : {})}
                    />
                  </InheritedPartNotice>
                ) : (
                  <SheetRow label="States">
                    <ItemTypeStatuses
                      statuses={statuses}
                      used={used}
                      onChange={(next) => {
                        setUsed(next);
                        // Turning the Default State off clears it.
                        if (!next.includes(defaultStatus)) setDefaultStatus('');
                      }}
                      defaultStatus={defaultStatus}
                      onDefaultStatus={setDefaultStatus}
                      {...(type ? { typeId: type.id } : {})}
                      {...(plan?.statusBoards ? { boards: plan.statusBoards } : {})}
                    />
                  </SheetRow>
                )}
              </div>
            </>
          ),
        }}
      />
      <DialogFooter>
        <>
          {type ? (
            <Button
              variant="secondary"
              // Duplicate Type, when there, sits beside it and ends the left group instead.
              className={onDuplicate ? undefined : 'mr-auto'}
              aria-haspopup="dialog"
              aria-expanded={confirmingAt !== null}
              onClick={(e) => setConfirmingAt(e.currentTarget)}
            >
              <TrashIcon size={14} />
              {/* One word, so a phone's footer keeps each button on one line. */}
              Delete
            </Button>
          ) : null}
          {type && onDuplicate ? (
            <Button variant="secondary" className="mr-auto" onClick={onDuplicate}>
              <DuplicateIcon size={14} />
              Duplicate
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
            data-tour-id="card-type-save"
            disabled={!!problem}
            onClick={() => {
              if (!saved) return;
              if (saved.inherits && saved.inherits !== type?.inherits)
                track('Plan', 'Linked', 'CardTypeBase');
              else if (!saved.inherits && type?.inherits) track('Plan', 'Unlinked', 'CardTypeBase');
              onSave(saved);
            }}
          >
            <CheckIcon size={14} />
            Save
          </Button>
        </>
      </DialogFooter>
      <CardTypeTourStage tour={tour} />
      {confirmingAt && type ? (
        <ConfirmPopover
          anchor={confirmingAt}
          message={deleteMessage(
            type.label,
            itemCount,
            heirs.map((t) => t.label),
          )}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmingAt(null);
            onDelete();
          }}
          onCancel={() => {
            confirmingAt.focus();
            setConfirmingAt(null);
          }}
        />
      ) : null}
    </Dialog>
  );
}

// The delete confirmation: the type, its cards going to the Trash with it when it has any, and the types inheriting
// from it keeping a copy of its settings (docs/specs/026-plan/item-types.md "Inherited types").
export function deleteMessage(label: string, cards: number, heirs: readonly string[] = []): string {
  const ask =
    cards === 0
      ? `Delete the ${label} type?`
      : `Delete the ${label} type? Its ${cards === 1 ? 'card' : `${cards} cards`} will be moved to the Trash too.`;
  if (heirs.length === 0) return ask;
  const names =
    heirs.length > 1 ? `${heirs.slice(0, -1).join(', ')} and ${heirs[heirs.length - 1]}` : heirs[0];
  return `${ask} ${names} will keep a copy of its settings.`;
}
