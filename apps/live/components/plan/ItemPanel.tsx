'use client';

// The item panel (docs/specs/026-plan/plan-board.md "Working on a board"): a wide modal in two columns.
// The main column holds the title and the type's tabs (docs/specs/026-plan/item-types.md); the Details
// panel beside it holds the fields in no tab, then who made the item and who last changed it. On a phone
// it is one column and Details becomes the first tab. Every field saves as it changes. It follows the
// item wherever someone moves it, and closes if someone deletes it.
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useState, type ReactNode } from 'react';
import {
  BUILT_IN_FIELD_IDS,
  detailFieldsOf,
  detailsLabelOf,
  isArchived,
  isFlagged,
  itemTitle,
  tabsOf,
  typeIn,
  type Item,
  type ItemFieldValue,
  type ItemPatch,
  type ItemPerson,
  type ItemTypeDef,
} from '@livediagram/items';
import { DialogCloseButton, relativeSince, Select } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { DebouncedText } from './item-field-editors';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ItemPanelMenu } from './ItemPanelMenu';
import { ItemChildCards } from './ItemChildCards';
import { ItemTrailCrumbs } from './ItemTrailCrumbs';
import type { ItemOpenVia } from './item-trail';
import { FLAG_COLOUR } from './item-flag';
import { ACCENT_TEXT, accentVars } from './plan-palette';
import type { ItemCommentsContext } from './ItemComments';
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

type ItemPanelProps = {
  item: Item;
  // The document's item types (docs/specs/026-plan/item-types.md).
  types: readonly ItemTypeDef[];
  // The statuses this tab's boards use, by name, for the status picker.
  statuses: readonly { status: string; name: string }[];
  // The projects an item can sit under (its Parent).
  projects: readonly Item[];
  people: readonly ItemPerson[];
  // Every label the document's items carry (the labels field's suggestions).
  labels: readonly string[];
  canEdit: boolean;
  onSave: (field: string, value: ItemFieldValue | undefined) => void;
  // Several fields in one write (the description and its formatting).
  onPatch: (patch: ItemPatch) => void;
  onType: (type: string) => void;
  // Switches the panel to another item (a card's parent, a child, a crumb), stepping the card trail.
  onOpenItem: (itemId: string, via: ItemOpenVia) => void;
  onTrash: () => void;
  onDuplicate: () => void;
  onFlag: () => void;
  // Archive the item, or restore an archived one (docs/specs/026-plan/items.md "Archive").
  onArchive: () => void;
  onClose: () => void;
  // The card's comments (docs/specs/026-plan/items.md "Comments").
  comments?: ItemCommentsContext;
  // The cards opened before this one from inside the panel, ending on it (docs/specs/026-plan/plan-board.md
  // "Breadcrumb").
  trail: readonly Item[];
  // The cards that name this one as their Parent ("Child Cards").
  childCards: readonly Item[];
  // Each status's column name, for a child row's status.
  statusNames: ReadonlyMap<string, string>;
};

// The panel: the Dialog stays mounted while the panel moves from card to card (a parent, a child, a crumb), so
// it opens once rather than sliding in again; the content is keyed by the card, so each starts on its first
// tab with its own clock.
export function ItemPanel(props: ItemPanelProps) {
  const { item, onClose } = props;
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={`Item #${item.key}`}
      size="3xl"
      phoneSheet
      className="h-[min(46rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden max-sm:h-[85dvh]"
    >
      <ItemPanelContent key={item.id} {...props} />
    </Dialog>
  );
}

function ItemPanelContent({
  item,
  types,
  statuses,
  projects,
  people,
  labels,
  canEdit,
  onSave,
  onPatch,
  onType,
  onOpenItem,
  onTrash,
  onDuplicate,
  onFlag,
  onArchive,
  onClose,
  comments,
  trail,
  childCards,
  statusNames,
}: ItemPanelProps) {
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
      // Comments a type no longer offers stay on the card, out of the panel, like votes.
      (f) =>
        f !== 'title' &&
        f !== 'votes' &&
        f !== 'comments' &&
        !offered.has(f) &&
        item.fields[f] !== undefined,
    ),
  ];
  const shownTabs = mobile
    ? [{ id: DETAILS_TAB, label: detailsLabelOf(type), fields: details }, ...tabs]
    : tabs;
  const [picked, setPicked] = useState<string>(shownTabs[0]?.id ?? DETAILS_TAB);
  const current = shownTabs.find((t) => t.id === picked) ?? shownTabs[0];
  const ctx: ItemFieldContext = {
    item,
    type,
    statuses,
    projects,
    people,
    labels,
    canEdit,
    onSave,
    onPatch,
    onOpenItem,
    ...(comments ? { comments } : {}),
  };

  // Child Cards sit on the type's first tab, before Comments; a Project shows them even with none.
  const firstTabId = tabs[0]?.id;
  const showsChildren = childCards.length > 0 || item.type === 'project';
  const childSection = (
    <ItemChildCards
      key="child-cards"
      item={item}
      childCards={childCards}
      types={types}
      statusNames={statusNames}
      onOpen={(id) => onOpenItem(id, 'ChildCard')}
    />
  );

  // The breadcrumb leads the header on a wide screen; on a phone it takes a row of its own above it, so neither
  // it nor the type picker is squeezed.
  const crumbs = (
    <ItemTrailCrumbs
      trail={trail}
      types={types}
      mobile={mobile}
      onBack={(id) => onOpenItem(id, 'Breadcrumb')}
    />
  );
  const trailRow =
    trail.length > 1 ? (
      <div className="flex min-w-0 items-center border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
        {crumbs}
      </div>
    ) : null;

  const header = (
    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700 sm:px-5">
      {mobile ? null : crumbs}
      <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
        <PlanTypeGlyph glyph={type.glyph} size={16} />
      </span>
      <Select
        aria-label="Item type"
        variant="ghost"
        selectClassName="text-[13px] font-semibold"
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
      </Select>
      <span className="text-[13px] text-slate-500 dark:text-slate-400">#{item.key}</span>
      {isFlagged(item) ? (
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: FLAG_COLOUR, backgroundColor: `${FLAG_COLOUR}14` }}
        >
          <PlanTypeGlyph glyph="flag" size={12} color={FLAG_COLOUR} />
          Flagged
        </span>
      ) : null}
      <span className="flex-1" />
      <HelpArticleLink article="planCards" variant="labelled" />
      {canEdit ? (
        <ItemPanelMenu
          itemKey={item.key}
          archived={isArchived(item)}
          flagged={isFlagged(item)}
          onDuplicate={onDuplicate}
          onFlag={onFlag}
          onArchive={onArchive}
          onTrash={onTrash}
        />
      ) : null}
      <DialogCloseButton compact onClick={onClose} />
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
      className="grid grid-cols-[6.5rem_1fr] items-start gap-2 py-2.5 max-sm:grid-cols-1 max-sm:gap-1.5"
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
    <section key={f} className="mb-7">
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
      ) : current.id === firstTabId && showsChildren ? (
        tabFieldsWithChildren(current.fields, mainField, childSection)
      ) : current.fields.length > 0 ? (
        current.fields.map(mainField)
      ) : (
        <p className="py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
          Nothing on this tab yet. Edit the card type to add fields to it.
        </p>
      )}
    </div>
  ) : null;

  return (
    <>
      {mobile ? trailRow : null}
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
              className="mb-4 flex gap-4 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-700"
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
            aria-label={detailsLabelOf(type)}
            className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40"
          >
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {detailsLabelOf(type)}
            </h3>
            {details.map(detailRow)}
            {meta}
          </aside>
        )}
      </div>
    </>
  );
}

// A first tab's fields with the Child Cards section placed before Comments (or last when it has none).
function tabFieldsWithChildren(
  fields: readonly string[],
  mainField: (f: string) => ReactNode,
  childSection: ReactNode,
): ReactNode[] {
  const at = fields.indexOf('comments');
  const cut = at < 0 ? fields.length : at;
  return [
    ...fields.slice(0, cut).map(mainField),
    childSection,
    ...fields.slice(cut).map(mainField),
  ];
}
