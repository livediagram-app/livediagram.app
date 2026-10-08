'use client';

// The item panel (docs/specs/026-plan/plan-board.md "Working on a board"): a wide modal in two columns.
// The main column holds the title and the type's tabs (docs/specs/026-plan/item-types.md); the Details
// panel beside it holds the fields in no tab, then who made the item and who last changed it. On a phone
// it is one column and Details becomes the first tab. Every field saves as it changes. It follows the
// item wherever someone moves it, and closes if someone deletes it.
import { useEffect, useState, type ReactNode } from 'react';
import {
  BUILT_IN_FIELD_IDS,
  detailFieldsOf,
  detailsLabelOf,
  isArchived,
  isFlagged,
  itemTitle,
  ITEM_TITLE_MAX,
  tabsOf,
  typeIn,
  type Item,
  type ItemFieldValue,
  type ItemPatch,
  type ItemPerson,
  type ItemTypeDef,
  type LinkedGroup,
} from '@livediagram/items';
import { DialogCloseButton } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { DebouncedText } from './item-field-editors';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ItemPanelMenu } from './ItemPanelMenu';
import { LinkedCardGroup } from './LinkedCards';
import { ItemTrailCrumbs } from './ItemTrailCrumbs';
import { ItemKeyTag, ItemTypePill } from './ItemPanelHeaderParts';
import type { ItemOpenVia } from './item-trail';
import { FLAG_COLOUR } from './item-flag';
import type { ItemCommentsContext } from './ItemComments';
import {
  ItemFieldEditor,
  fieldId,
  fieldLabel,
  labelsItsControl,
  type ItemFieldContext,
} from './ItemFieldEditor';
import { ItemDetailsRow, ItemMeta, ItemPanelSection, ItemTypeBand } from './ItemPanelLayout';

// The phone's extra first tab, holding what the Details panel holds on a wide screen.
const DETAILS_TAB = 'details';
const NO_GROUPS: readonly LinkedGroup[] = [];

const TAB_CLASS =
  'relative shrink-0 whitespace-nowrap px-1 pb-2 pt-1 text-[13px] font-medium transition aria-selected:text-brand-700 dark:aria-selected:text-brand-300';

type ItemPanelProps = {
  item: Item;
  // The document's item types (docs/specs/026-plan/item-types.md).
  types: readonly ItemTypeDef[];
  // The statuses this tab's boards use, by name, for the status picker.
  statuses: readonly { status: string; name: string }[];
  people: readonly ItemPerson[];
  // Every label the document's items carry (the labels field's suggestions).
  labels: readonly string[];
  canEdit: boolean;
  // Whether the save landed (false: refused), so a field can go back to what is saved.
  onSave: (field: string, value: ItemFieldValue | undefined) => void | Promise<boolean>;
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
  // Edit Card Type in the ⋯ menu: closes the panel and opens the card's type in the type editor.
  onEditType?: (() => void) | undefined;
  // The card's comments (docs/specs/026-plan/items.md "Comments").
  comments?: ItemCommentsContext;
  // The cards opened before this one from inside the panel, ending on it (docs/specs/026-plan/plan-board.md
  // "Breadcrumb").
  trail: readonly Item[];
  // The cards linking here through a Card field, a group per field (docs/specs/026-plan/item-types.md "Card fields").
  linkedGroups?: readonly LinkedGroup[];
  // Make a new card of `typeId` already linked here through the group's field.
  onAddLinked?: (group: LinkedGroup, typeId: string) => void;
  // Each status's column name, for a child row's status.
  statusNames: ReadonlyMap<string, string>;
  // The card was just made by this person (openNewItem): its title is selected so typing names it.
  fresh?: boolean;
};

// On a desktop, the title takes focus as a card opens (each card: the content is keyed by it): the caret at its
// end, or the whole title selected on a card just made, so typing replaces "New task". A frame later than the
// Dialog's focus trap, which first lands on the panel itself.
function useTitleFocus(id: string, on: boolean, select: boolean): void {
  useEffect(() => {
    if (!on) return;
    const frame = requestAnimationFrame(() => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
      field.focus({ preventScroll: true });
      if (select) field.select();
      else field.setSelectionRange(field.value.length, field.value.length);
    });
    return () => cancelAnimationFrame(frame);
  }, [id, on, select]);
}

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
      // The trap lands on the panel itself, never its first control (the type picker, which nobody opens a card
      // to change); on a desktop the title then takes focus (useTitleFocus), on a phone it stays on the panel so
      // no keyboard rises (docs/specs/026-plan/plan-board.md "Open an item").
      initialFocus="container"
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
  onEditType,
  comments,
  trail,
  linkedGroups = NO_GROUPS,
  fresh = false,
  onAddLinked,
  statusNames,
}: ItemPanelProps) {
  const mobile = useIsMobileViewport();
  useTitleFocus(fieldId(item, 'title'), !mobile && canEdit, fresh);
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
    people,
    labels,
    canEdit,
    onSave,
    onPatch,
    onOpenItem,
    ...(comments ? { comments } : {}),
  };

  // The Linked as sections sit on the type's first tab, before Comments, even with no cards in them.
  const firstTabId = tabs[0]?.id;
  const showsChildren = linkedGroups.length > 0;
  const childSection = (
    <div key="child-cards">
      {linkedGroups.map((g) => (
        <LinkedCardGroup
          key={g.fieldId}
          group={g}
          types={types}
          statusNames={statusNames}
          canAdd={canEdit && !!onAddLinked}
          onOpen={(id) => onOpenItem(id, 'ChildCard')}
          onAdd={(typeId) => onAddLinked?.(g, typeId)}
        />
      ))}
    </div>
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
    <div className="flex min-h-12 items-center gap-2 px-4 py-2 sm:px-6">
      {mobile ? null : crumbs}
      {/* The current card: its type picker and number, the trail's end (not a link). */}
      <ItemTypePill type={type} value={item.type} types={types} canEdit={canEdit} onType={onType} />
      <ItemKeyTag itemKey={item.key} />
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
      <ItemPanelMenu
        itemKey={item.key}
        canEdit={canEdit}
        archived={isArchived(item)}
        flagged={isFlagged(item)}
        onDuplicate={onDuplicate}
        onFlag={onFlag}
        onArchive={onArchive}
        onTrash={onTrash}
        onEditType={onEditType}
      />
      <DialogCloseButton compact onClick={onClose} />
    </div>
  );

  const meta = <ItemMeta item={item} now={now} />;

  // A Details row: label beside its control on a wide screen, above it in the phone's tab.
  const detailRow = (f: string) => (
    <ItemDetailsRow
      key={f}
      label={fieldLabel(type, f)}
      htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
    >
      <ItemFieldEditor f={f} ctx={ctx} />
    </ItemDetailsRow>
  );

  // A main-column field: its name over its editor.
  const mainField = (f: string) => (
    <ItemPanelSection
      key={f}
      heading={fieldLabel(type, f)}
      htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
    >
      <ItemFieldEditor f={f} ctx={ctx} />
    </ItemPanelSection>
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
      <ItemTypeBand colour={type.color} />
      {mobile ? trailRow : null}
      {header}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 sm:px-8">
          <DebouncedText
            id={fieldId(item, 'title')}
            label="Title"
            value={itemTitle(item)}
            maxLength={ITEM_TITLE_MAX}
            // Enter saves the title and closes the card.
            onEnter={onClose}
            required
            placeholder="Title"
            disabled={!canEdit}
            onSave={(v) => onSave('title', v)}
            className="-mx-2 mb-5 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 py-1 text-[22px] font-semibold leading-snug tracking-tight text-slate-900 outline-none transition hover:bg-slate-50 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:text-slate-50 dark:hover:bg-slate-800/50 dark:focus:bg-slate-950"
          />
          {shownTabs.length > 1 ? (
            <div
              role="tablist"
              aria-label="Item sections"
              className="mb-6 flex gap-5 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-700"
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
            className="m-3 ml-0 w-80 shrink-0 overflow-y-auto rounded-xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200/70 dark:bg-slate-800/40 dark:ring-slate-700/60"
          >
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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

// A first tab's fields with the Linked as sections placed before Comments (or last when it has none).
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
