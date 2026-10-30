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
    };
  }, [
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
  // The same check the api makes, on this type alone: a bad custom field never reaches a save.
  const check = useMemo(
    () => validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types: [draft] }),
    [draft],
  );
  // Too many statuses on (kept ids a board no longer names count too): its own message.
  const statusesProblem = !check.ok && check.reason.endsWith('.statuses');
  const problem = !draft.label
    ? 'Give the type a name.'
    : clash
      ? 'Another type has this name.'
      : tabProblem
        ? tabProblem
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
            />
          ),
          display: (
            <div data-tour-id="card-type-display">
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
            </div>
          ),
          statuses: (
            <>
              <div data-tour-id="card-type-states">
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
            onClick={() => check.ok && onSave(check.catalogue.types[0]!)}
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
          message={deleteMessage(type.label, itemCount)}
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

// The delete confirmation: the type, and its cards going to the Trash with it when it has any.
export function deleteMessage(label: string, cards: number): string {
  if (cards === 0) return `Delete the ${label} type?`;
  return `Delete the ${label} type? Its ${cards === 1 ? 'card' : `${cards} cards`} will be moved to the Trash too.`;
}
