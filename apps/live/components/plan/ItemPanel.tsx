'use client';

// The item panel (docs/specs/025-plan/plan-board.md "Working on a board"): a wide modal in two columns.
// The main column holds the title and the type's tabs (docs/specs/025-plan/item-types.md); the Details
// panel beside it holds the fields in no tab, then who made the item and who last changed it. On a phone
// it is one column and Details becomes the first tab. Every field saves as it changes. It follows the
// item wherever someone moves it, and closes if someone deletes it.
import { useState } from 'react';
import {
  BUILT_IN_FIELD_IDS,
  detailFieldsOf,
  itemTitle,
  tabsOf,
  typeIn,
  type Item,
  type ItemFieldValue,
  type ItemPatch,
  type ItemPerson,
  type ItemTypeDef,
} from '@livediagram/items';
import { CloseIcon, TrashIcon, relativeSince } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { DebouncedText } from './item-field-editors';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';
import {
  ItemFieldEditor,
  fieldId,
  fieldLabel,
  labelsItsControl,
  type ItemFieldContext,
} from './ItemFieldEditor';

// The phone's extra first tab, holding what the Details panel holds on a wide screen.
const DETAILS_TAB = 'details';

const TAB_CLASS =
  'relative shrink-0 whitespace-nowrap px-1 pb-2 pt-1 text-[13px] font-medium transition aria-selected:text-brand-700 dark:aria-selected:text-brand-300';

export function ItemPanel({
  item,
  types,
  statuses,
  projects,
  people,
  canEdit,
  onSave,
  onPatch,
  onType,
  onDelete,
  onClose,
}: {
  item: Item;
  // The document's item types (docs/specs/025-plan/item-types.md).
  types: readonly ItemTypeDef[];
  // The statuses this tab's boards use, by name, for the status picker.
  statuses: readonly { status: string; name: string }[];
  // The projects an item can sit under (its Parent).
  projects: readonly Item[];
  people: readonly ItemPerson[];
  canEdit: boolean;
  onSave: (field: string, value: ItemFieldValue | undefined) => void;
  // Several fields in one write (the description and its formatting).
  onPatch: (patch: ItemPatch) => void;
  onType: (type: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const mobile = useIsMobileViewport();
  // When the panel opened: the meta line says how long ago the last change was from here.
  const [now] = useState(() => Date.now());
  const type = typeIn(types, item.type);
  const tabs = tabsOf(type);
  const offered = new Set<string>(type.fields);
  // The fields in no tab, then any built-in field the item holds a value in that its type does not
  // offer. A custom field's value its type no longer offers stays stored, unshown.
  const details = [
    ...detailFieldsOf(type),
    ...BUILT_IN_FIELD_IDS.filter(
      (f) => f !== 'title' && f !== 'votes' && !offered.has(f) && item.fields[f] !== undefined,
    ),
  ];
  const shownTabs = mobile
    ? [{ id: DETAILS_TAB, label: 'Details', fields: details }, ...tabs]
    : tabs;
  const [picked, setPicked] = useState<string>(shownTabs[0]?.id ?? DETAILS_TAB);
  const current = shownTabs.find((t) => t.id === picked) ?? shownTabs[0];
  const ctx: ItemFieldContext = {
    item,
    type,
    statuses,
    projects,
    people,
    canEdit,
    onSave,
    onPatch,
  };

  const header = (
    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700 sm:px-5">
      <span className={ACCENT_TEXT} style={accentVars(type.color)}>
        <PlanTypeGlyph glyph={type.glyph} size={16} />
      </span>
      <select
        aria-label="Item type"
        className="rounded-md border border-transparent bg-transparent py-0.5 text-[13px] font-semibold enabled:cursor-pointer hover:border-slate-200 dark:hover:border-slate-700"
        disabled={!canEdit}
        value={item.type}
        onChange={(e) => onType(e.target.value)}
      >
        {!types.some((t) => t.id === item.type) ? (
          <option value={item.type}>{type.label}</option>
        ) : null}
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <span className="text-[13px] text-slate-500 dark:text-slate-400">#{item.key}</span>
      <span className="flex-1" />
      {canEdit ? (
        <button
          type="button"
          onClick={onDelete}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
        >
          <TrashIcon size={14} />
          Delete
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );

  const meta = (
    <div className="mt-4 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <div>Made by {item.createdBy.name}</div>
      <div>
        Changed by {item.updatedBy.name}, {relativeSince(item.updatedAt, now)}
      </div>
    </div>
  );

  // A Details row: label beside its control on a wide screen, above it in the phone's tab.
  const detailRow = (f: string) => (
    <div
      key={f}
      className="grid grid-cols-[6.5rem_1fr] items-start gap-2 py-1.5 max-sm:grid-cols-1"
    >
      <label
        htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
        className="pt-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 max-sm:pt-0"
      >
        {fieldLabel(type, f)}
      </label>
      <div className="min-w-0">
        <ItemFieldEditor f={f} ctx={ctx} />
      </div>
    </div>
  );

  // A main-column field: its name over its editor.
  const mainField = (f: string) => (
    <section key={f} className="mb-5">
      <label
        htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
        className="mb-1.5 block text-[12px] font-semibold text-slate-700 dark:text-slate-200"
      >
        {fieldLabel(type, f)}
      </label>
      <ItemFieldEditor f={f} ctx={ctx} />
    </section>
  );

  const tabPanel = current ? (
    <div
      role={shownTabs.length > 1 ? 'tabpanel' : undefined}
      id={`item-${item.id}-panel-${current.id}`}
      aria-labelledby={shownTabs.length > 1 ? `item-${item.id}-tab-${current.id}` : undefined}
    >
      {current.id === DETAILS_TAB ? (
        <>
          {details.map(detailRow)}
          {meta}
        </>
      ) : current.fields.length > 0 ? (
        current.fields.map(mainField)
      ) : (
        <p className="py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
          Nothing on this tab yet. Edit the card type to add fields to it.
        </p>
      )}
    </div>
  ) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={`Item #${item.key}`}
      size="3xl"
      phoneSheet
      className="h-[min(46rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden max-sm:h-[85dvh]"
    >
      {header}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
          <DebouncedText
            id={fieldId(item, 'title')}
            label="Title"
            value={itemTitle(item)}
            required
            placeholder="Title"
            disabled={!canEdit}
            onSave={(v) => onSave('title', v)}
            className="-mx-2 mb-3 w-[calc(100%+1rem)] rounded-md border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold leading-snug text-slate-900 outline-none transition hover:border-slate-200 focus:border-brand-400 focus:bg-white dark:text-slate-50 dark:hover:border-slate-700 dark:focus:bg-slate-950"
          />
          {shownTabs.length > 1 ? (
            <div
              role="tablist"
              aria-label="Item sections"
              className="mb-4 flex gap-4 overflow-x-auto border-b border-slate-200 dark:border-slate-700"
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const i = shownTabs.findIndex((t) => t.id === current?.id);
                const next =
                  shownTabs[
                    (i + (e.key === 'ArrowRight' ? 1 : -1) + shownTabs.length) % shownTabs.length
                  ]!;
                setPicked(next.id);
                document.getElementById(`item-${item.id}-tab-${next.id}`)?.focus();
              }}
            >
              {shownTabs.map((t) => {
                const on = t.id === current?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`item-${item.id}-tab-${t.id}`}
                    aria-selected={on}
                    aria-controls={`item-${item.id}-panel-${t.id}`}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setPicked(t.id)}
                    className={`${TAB_CLASS} ${on ? '' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
                  >
                    {t.label}
                    {on ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-400"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {tabPanel}
        </div>
        {mobile ? null : (
          <aside
            aria-label="Details"
            className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40"
          >
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Details
            </h3>
            {details.map(detailRow)}
            {meta}
          </aside>
        )}
      </div>
    </Dialog>
  );
}
