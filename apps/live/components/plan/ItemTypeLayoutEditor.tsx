'use client';

// The type editor's fields and tabs as one list (docs/specs/026-plan/item-types.md "Editing a type"),
// grouped the way the card's panel shows them: On the Card (Title, Votes), Details (the panel's side
// column, renamed in place) and each tab (renamed, moved and removed in its header). A field moves within
// its group by its handle (or Move Up and Move Down in its ⋯ menu), to another group and off from that menu;
// Title and Status stay. Each
// group adds a field into itself. Edits a draft; the type editor saves it.
import { useState } from 'react';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { HANDLE_TOUCH, useHandleReorder } from '@/components/primitives/useHandleReorder';
import { FieldMenu, GripIcon } from './ItemTypeFieldMenu';
import {
  BUILT_IN_FIELD_IDS,
  DETAILS_LABEL_DEFAULT,
  ITEM_TYPE_CUSTOM_MAX,
  ITEM_TYPE_FIELDS_MAX,
  ITEM_TYPE_TAB_LABEL_MAX,
  ITEM_TYPE_TABS_MAX,
  REQUIRED_TYPE_FIELDS,
  requiredFieldsOf,
  newCustomFieldId,
  type ItemFieldId,
} from '@livediagram/items';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloseIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  Tooltip,
} from '@livediagram/ui';
import {
  BUILT_IN_FIELD_LABELS,
  CUSTOM_KIND_LABELS,
  CustomFieldForm,
  DASHED_ADD_BUTTON,
  ICON_BUTTON,
  NewFieldForm,
} from './ItemTypeFieldForms';
import {
  addField,
  addTab,
  cardFields,
  fileField,
  groupFields,
  isKeptTab,
  movableIn,
  moveField,
  moveTab,
  orderedFields,
  placeField,
  removeField,
  type GroupId,
  type LayoutDraft,
} from './item-type-layout';

// The Add Field popover: wide enough for a name and a kind side by side, whatever column it opens from.
const ADD_FIELD_POPOVER_PX = 384;
const NAME_INPUT =
  'min-w-0 flex-1 rounded-md border bg-transparent px-1.5 py-0.5 text-[13px] font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none dark:text-slate-50 dark:hover:border-slate-600 dark:focus:bg-slate-900';
const isRequired = (f: string) => (REQUIRED_TYPE_FIELDS as readonly string[]).includes(f);

export function ItemTypeLayoutEditor({
  typeId,
  draft,
  onChange,
  detailsLabel,
  onDetailsLabel,
  removedSome,
}: {
  // The type being edited (undefined for a new one): a Project always keeps its Start and Due.
  typeId?: string | undefined;
  draft: LayoutDraft;
  onChange: (next: LayoutDraft) => void;
  // What this type calls Details: renamed here, never moved or removed.
  detailsLabel: string;
  onDetailsLabel: (label: string) => void;
  // A field has come off since the editor opened: say what happens to its values.
  removedSome: boolean;
}) {
  // The group whose Add Field form is open (Details is `null`), and the custom field being edited.
  // The group whose Add Field popover is open, and the button it hangs from.
  const [adding, setAdding] = useState<{ group: GroupId; anchor: HTMLElement } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const fields = orderedFields(draft.fields);
  const kept = requiredFieldsOf(typeId);
  const customOf = (id: string) => draft.custom.find((f) => f.id === id);
  const labelOf = (id: string) =>
    customOf(id)?.label || BUILT_IN_FIELD_LABELS[id as ItemFieldId] || id;
  const full = fields.length >= ITEM_TYPE_FIELDS_MAX;
  const groups: { id: GroupId; label: string }[] = [
    { id: null, label: detailsLabel.trim() || DETAILS_LABEL_DEFAULT },
    ...draft.tabs.map((t) => ({ id: t.id, label: t.label.trim() || 'Untitled tab' })),
  ];

  const rowsOf = (group: GroupId | 'card', list: readonly string[]) => {
    if (list.length === 0) return null;
    const movable = group === 'card' ? [] : movableIn(draft, group);
    return (
      <ReorderableRows
        ids={movable}
        onPlace={(id, to) => group !== 'card' && onChange(placeField(draft, group, id, to))}
      >
        {(drag) =>
          list.map((id) => {
            const c = customOf(id);
            const at = movable.indexOf(id);
            return (
              <FieldRow
                key={id}
                id={id}
                label={labelOf(id)}
                kind={c ? CUSTOM_KIND_LABELS[c.kind] : null}
                removable={!kept.includes(id) && !isRequired(id)}
                editing={editing === id}
                onEdit={c ? () => setEditing(editing === id ? null : id) : undefined}
                moveTargets={group === 'card' ? [] : groups.filter((g) => g.id !== group)}
                onMoveTo={(to) => onChange({ ...draft, tabs: fileField(draft.tabs, id, to) })}
                handle={at >= 0 && movable.length > 1 ? drag.handleProps(id) : undefined}
                dragging={drag.draggingId === id}
                style={drag.rowStyle(id)}
                canUp={at > 0}
                canDown={at >= 0 && at < movable.length - 1}
                onMove={
                  at < 0 || group === 'card'
                    ? undefined
                    : (by) => onChange(moveField(draft, group, id, by))
                }
                onRemove={() => onChange(removeField(draft, id))}
              >
                {c && editing === id ? (
                  <CustomFieldForm
                    field={c}
                    className="mt-2"
                    onChange={(patch) =>
                      onChange({
                        ...draft,
                        custom: draft.custom.map((f) => (f.id === id ? { ...f, ...patch } : f)),
                      })
                    }
                  />
                ) : null}
              </FieldRow>
            );
          })
        }
      </ReorderableRows>
    );
  };

  const addForm = (group: GroupId) => (
    <>
      <button
        type="button"
        disabled={full}
        aria-haspopup="dialog"
        aria-expanded={adding?.group === group}
        className={`${DASHED_ADD_BUTTON} bg-white/60 dark:bg-slate-900/40`}
        onClick={(e) => {
          const anchor = e.currentTarget;
          setAdding((open) => (open?.group === group ? null : { group, anchor }));
        }}
      >
        <PlusIcon size={13} />
        Add Field
      </button>
      {adding?.group === group ? (
        <AnchoredPopover
          anchor={adding.anchor}
          name="Add Field"
          width={ADD_FIELD_POPOVER_PX}
          onClose={() => setAdding(null)}
        >
          <NewFieldForm
            missing={BUILT_IN_FIELD_IDS.filter((f) => !fields.includes(f))}
            canAddCustom={draft.custom.length < ITEM_TYPE_CUSTOM_MAX}
            onAddBuiltIn={(id) => {
              onChange(addField(draft, id, group));
              setAdding(null);
            }}
            onAddCustom={(field) => {
              const id = newCustomFieldId(field.label, [
                ...fields,
                ...draft.custom.map((f) => f.id),
              ]);
              onChange(addField(draft, id, group, { ...field, id }));
              setAdding(null);
            }}
            onCancel={() => {
              adding.anchor.focus();
              setAdding(null);
            }}
          />
        </AnchoredPopover>
      ) : null}
    </>
  );

  return (
    // Laid out as the card's panel: the main column (On the Card, then the tabs and Add Tab) with Details beside it
    // on desktop, spanning both rows; one column on a phone. The DOM order (On the Card, Details, the tabs) is the
    // phone's order, so focus and reading order follow what is shown.
    <div className="flex flex-col gap-2.5 md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:grid-rows-[auto_1fr] md:items-start md:gap-x-3">
      <div className="md:col-start-1 md:row-start-1">
        <LayoutGroup title={<span className="px-1.5">On the Card</span>} tag="Always shown">
          {rowsOf('card', cardFields(draft))}
        </LayoutGroup>
      </div>
      <div className="md:col-start-2 md:row-span-2 md:row-start-1">
        {/* Details, as the card's panel shows it: a column on the right on desktop; on a phone, after On the Card. */}
        <LayoutGroup
          title={
            <input
              aria-label="Details name"
              className={`${NAME_INPUT} border-transparent`}
              value={detailsLabel}
              maxLength={ITEM_TYPE_TAB_LABEL_MAX}
              placeholder={DETAILS_LABEL_DEFAULT}
              onChange={(e) => onDetailsLabel(e.target.value)}
            />
          }
          tag="Side column"
          footer={addForm(null)}
          empty="No fields here."
        >
          {rowsOf(null, groupFields(draft, null))}
        </LayoutGroup>
      </div>
      <div className="flex flex-col gap-2.5 md:col-start-1 md:row-start-2">
        {draft.tabs.map((t, i) => (
          <LayoutGroup
            key={t.id}
            title={
              <input
                aria-label={`Tab ${i + 1} name`}
                autoFocus={!t.label && t.fields.length === 0}
                className={`${NAME_INPUT} ${
                  !t.label.trim() && t.fields.length > 0
                    ? 'border-rose-400 dark:border-rose-500'
                    : 'border-transparent'
                }`}
                value={t.label}
                maxLength={ITEM_TYPE_TAB_LABEL_MAX}
                placeholder="Name this tab"
                onChange={(e) =>
                  onChange({
                    ...draft,
                    tabs: draft.tabs.map((x) =>
                      x.id === t.id ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
            }
            tag="Tab"
            actions={
              <>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Move ${t.label || 'tab'} up`}
                  disabled={i === 0}
                  onClick={() => onChange({ ...draft, tabs: moveTab(draft.tabs, i, -1) })}
                >
                  <ArrowUpIcon size={14} />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Move ${t.label || 'tab'} down`}
                  disabled={i === draft.tabs.length - 1}
                  onClick={() => onChange({ ...draft, tabs: moveTab(draft.tabs, i, 1) })}
                >
                  <ArrowDownIcon size={14} />
                </button>
                {isKeptTab(t) ? (
                  // Overview stays: the slot keeps the headers' controls lined up.
                  <span aria-hidden className="h-7 w-7 shrink-0" />
                ) : (
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    aria-label={`Remove ${t.label || 'tab'}`}
                    onClick={() =>
                      onChange({ ...draft, tabs: draft.tabs.filter((x) => x.id !== t.id) })
                    }
                  >
                    <CloseIcon size={12} />
                  </button>
                )}
              </>
            }
            footer={addForm(t.id)}
            empty={
              isKeptTab(t)
                ? 'No fields yet. Add one, or move one here.'
                : 'No fields yet. Add one, or move one here; an empty tab is dropped when you save.'
            }
          >
            {rowsOf(t.id, t.fields)}
          </LayoutGroup>
        ))}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={draft.tabs.length >= ITEM_TYPE_TABS_MAX}
            className={DASHED_ADD_BUTTON}
            onClick={() => onChange({ ...draft, tabs: addTab(draft.tabs) })}
          >
            <PlusIcon size={13} />
            Add Tab
          </button>
          {removedSome ? (
            <p className="text-center text-[12px] text-slate-500 dark:text-slate-400">
              Items keep what they hold in a removed field.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// One group: a header (its name, what it is, how many fields, its controls), its fields, and Add Field.
function LayoutGroup({
  title,
  tag,
  actions,
  footer,
  empty,
  children,
}: {
  title: React.ReactNode;
  tag: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  empty?: string;
  // The group's rows, or null when it has none (then its empty note shows).
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
      <header className="flex min-h-10 items-center gap-2 px-2 py-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-50">
        {title}
        <span className="shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {tag}
        </span>
        {actions ? <div className="ml-auto flex shrink-0 items-center">{actions}</div> : null}
      </header>
      <div className="flex flex-col gap-1 px-2 pb-2">
        {children != null ? (
          <ul className="flex flex-col gap-1">{children}</ul>
        ) : empty ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-center text-[12px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
            {empty}
          </p>
        ) : null}
        {footer ? <div>{footer}</div> : null}
      </div>
    </section>
  );
}

// A group's rows with one handle drag between them (useHandleReorder, over the group's movable fields).
function ReorderableRows({
  ids,
  onPlace,
  children,
}: {
  ids: readonly string[];
  onPlace: (id: string, to: number) => void;
  children: (drag: ReturnType<typeof useHandleReorder>) => React.ReactNode;
}) {
  return <>{children(useHandleReorder(ids, onPlace))}</>;
}

// One field: a drag handle (a field that moves), its name with a lock when the type always keeps it, its kind,
// Edit (a custom field) and a ⋯ menu: Move Up, Move Down, Move to each other group and Remove. Title and Status
// stay put and never come off; a field the type always keeps (a Project's Start and Due) moves but never comes
// off. The handle is for a pointer or a finger; the menu's Move Up and Move Down are the keyboard's way.
// Rows alternate white and a light grey (odd and even in their group), so a long list reads row by row.
function FieldRow({
  id,
  label,
  kind,
  removable,
  editing,
  onEdit,
  moveTargets,
  onMoveTo,
  handle,
  dragging,
  style,
  canUp,
  canDown,
  onMove,
  onRemove,
  children,
}: {
  id: string;
  label: string;
  kind: string | null;
  // False for a field that never comes off (Title, Status, a type's kept fields): no Remove, and a lock.
  removable: boolean;
  editing: boolean;
  onEdit?: () => void;
  moveTargets: readonly { id: GroupId; label: string }[];
  onMoveTo: (to: GroupId) => void;
  // The handle's pointer handlers, for a field that can be dragged within its group.
  handle?: ReturnType<ReturnType<typeof useHandleReorder>['handleProps']> | undefined;
  dragging: boolean;
  style?: React.CSSProperties | undefined;
  canUp: boolean;
  canDown: boolean;
  onMove?: ((by: -1 | 1) => void) | undefined;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  const hasMenu = removable || moveTargets.length > 0 || (onMove && (canUp || canDown));
  return (
    <li
      data-reorder-id={id}
      style={style}
      className={`rounded-lg border px-1.5 py-1 odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800 ${
        dragging
          ? 'border-brand-400 shadow-md dark:border-brand-500'
          : 'border-slate-200 shadow-sm dark:border-slate-700'
      }`}
    >
      <div className="flex min-h-8 items-center gap-1">
        {handle ? (
          <span
            aria-hidden
            {...handle}
            className={`flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${HANDLE_TOUCH}`}
          >
            <GripIcon />
          </span>
        ) : (
          <span aria-hidden className="h-7 w-5 shrink-0" />
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
          <span className="truncate">{label}</span>
          {!removable ? (
            <Tooltip label={`${label} is always on this type`}>
              <span
                tabIndex={0}
                aria-label={`${label} is always on this type`}
                className="flex shrink-0 text-slate-400 dark:text-slate-400"
              >
                <LockIcon size={11} />
              </span>
            </Tooltip>
          ) : null}
          {kind ? (
            <span className="shrink-0 text-[11px] font-normal text-slate-500 dark:text-slate-400">
              {kind}
            </span>
          ) : null}
        </span>
        {onEdit ? (
          <button
            type="button"
            className={`${ICON_BUTTON} ${editing ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : ''}`}
            aria-label={editing ? `Done editing ${label}` : `Edit ${label}`}
            aria-expanded={editing}
            onClick={onEdit}
          >
            <PencilIcon size={13} />
          </button>
        ) : null}
        {hasMenu ? (
          <FieldMenu
            label={label}
            moveTargets={moveTargets}
            onMoveTo={onMoveTo}
            canUp={canUp}
            canDown={canDown}
            onMove={onMove}
            onRemove={removable ? onRemove : undefined}
          />
        ) : (
          <span aria-hidden className="h-7 w-7 shrink-0" />
        )}
      </div>
      {children}
    </li>
  );
}
