'use client';

// The item panel (docs/specs/026-plan/plan-board.md "Working on a board"): a wide modal in two columns.
// The main column holds the title and the type's tabs (docs/specs/026-plan/item-types.md); the Details
// panel beside it holds the fields in no tab, then who made the item and who last changed it. Every type's tabs end
// with Linked Cards (when a Card field can link to the type), Activity (the card’s history) and Hidden (values the type
// doesn’t show, when the card keeps any); on a phone it is one column and Details becomes the last tab. It opens on the
// type's first tab. Every field saves as it changes. It follows the item wherever someone moves it, and closes if
// someone deletes it.
import { CardPullRequests } from './CardPullRequests';
import { useEffect, useState, type ReactNode } from 'react';
import { markResponseOpened } from '@/components/forms/fresh-responses';
import {
  BUILT_IN_FIELD_IDS,
  commentsFieldsOf,
  detailFieldsOf,
  detailsLabelOf,
  isArchived,
  isFlagged,
  itemTitle,
  ITEM_TITLE_MAX,
  requiredCustomFieldsOf,
  tabsOf,
  typeIn,
  type Item,
  type ItemFieldValue,
  type ItemPatch,
  type ItemPerson,
  type ItemTypeDef,
  type LinkedGroup,
  type LabelUse,
  type BoardStatusTypes,
  hasBlocksFields,
  hiddenValueCount,
  hiddenValuesOf,
} from '@liveplanner/items';
import { DialogCloseButton } from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { DebouncedText } from './item-field-editors';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ItemPanelMenu } from './ItemPanelMenu';
import { useCardMorph } from './useCardMorph';
import { useItemRepeat } from './ItemRepeatLine';
import { useRunRule } from '@/components/automations/use-run-rule';
import { useCardThreadsContext } from './threads/CardThreadsContext';
import { useAutomationHistory } from '@/components/automations/set-by-automation';
import { SetByAutomationChip } from '@/components/automations/SetByAutomationChip';
import { LinkedCardsTab, linkedCardCount } from './LinkedCardsTab';
import { HiddenValuesTab } from './HiddenValuesTab';
import { BlockedBySections } from './BlockedBy';
import { LinkedActionBanner } from './LinkedActionBanner';
import type { PlanContextValue } from './PlanContext';
import { ItemTrailCrumbs } from './ItemTrailCrumbs';
import { ItemKeyTag, ItemMaximiseButton, ItemTypePill } from './ItemPanelHeaderParts';
import { typeChoices } from './type-choices';
import { PANEL_RESIZE_TRANSITION, panelSizeClass } from './item-panel-size';
import { useAnimatedMaximise } from './useAnimatedMaximise';
import type { ItemOpenVia } from './item-trail';
import { FLAG_COLOUR } from './item-flag';
import {
  ItemFieldEditor,
  fieldId,
  fieldLabel,
  labelsItsControl,
  type ItemFieldContext,
} from './ItemFieldEditor';
import { ItemDetailsRow, ItemMeta, ItemPanelSection, ItemTypeBand } from './ItemPanelLayout';
import {
  ACTIVITY_TAB,
  DETAILS_TAB,
  HIDDEN_TAB,
  LINKED_TAB,
  ItemPanelTabBar,
  namedLinkedTab,
  panelTabs,
} from './ItemPanelTabs';
import { track } from '@/lib/telemetry';
import { CardActivityTab } from './threads/CardActivity';
import { CardThreads } from './threads/CardThreads';
import { PRACTICE_KEY } from '@/hooks/plan/practice-items';
import { TAKES_HISTORY_ATTR } from '@/hooks/canvas/panel-history';

const NO_GROUPS: readonly LinkedGroup[] = [];
const NO_STATUS_TYPES: BoardStatusTypes = new Map();

type ItemPanelProps = {
  item: Item;
  // The project's item types (docs/specs/026-plan/item-types.md).
  types: readonly ItemTypeDef[];
  // The card types the boards naming each status take: the Card Type picker offers the card's boards' types
  // (plan-board.md "The types it offers"). Absent: every type.
  statusTypes?: BoardStatusTypes;
  // The statuses this tab's boards use, by name, for the status picker.
  statuses: readonly { status: string; name: string }[];
  people: readonly ItemPerson[];
  // The plan's labels with how many cards carry each (labelUsage): the Labels field's menu.
  labels: readonly LabelUse[];
  canEdit: boolean;
  // Archive, Trash and the type editor (ItemPanelMenu); absent: as canEdit.
  canRetire?: boolean;
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
  // Copy Card Link in the ⋯ menu (docs/specs/026-plan/plan-board.md "Its address"); absent, no row.
  onCopyLink?: (() => void) | undefined;
  // The cards opened before this one from inside the panel, ending on it (docs/specs/026-plan/plan-board.md
  // "Breadcrumb").
  trail: readonly Item[];
  // The cards linking here through a Card field, a group per field (docs/specs/026-plan/item-types.md "Card fields").
  linkedGroups?: readonly LinkedGroup[];
  // Make a new card of `typeId` already linked here through the group's field.
  onAddLinked?: (group: LinkedGroup, typeId: string) => void;
  // Link an existing card here through the group's field (docs/specs/026-plan/item-types.md "Link Existing"):
  // sets that card's field to this one; false: refused. `moved`: it linked to another card before.
  onLinkExisting?: (group: LinkedGroup, cardId: string, moved: boolean) => Promise<boolean>;
  // Each status's column name, for a child row's status.
  statusNames: ReadonlyMap<string, string>;
  // The card was just made by this person (openNewItem): its title is selected so typing names it.
  fresh?: boolean;
  // The Actions board's links (docs/specs/026-plan/linked-boards.md "On the board"): a linked card shows where its
  // action is and the way to it, and its assignee (the action's) reads only.
  linkedActions?: PlanContextValue['linkedActions'];
  // Maximise Card (docs/specs/026-plan/plan-board.md "Maximised"): this person's preference, and the way to change
  // it. Absent onMaximise, no button; a phone never maximises whatever `maximised` says.
  maximised?: boolean;
  onMaximise?: ((on: boolean) => void) | undefined;
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
  // A response's card stops showing New once opened (docs/specs/030-forms/forms.md "Hearing about responses").
  useEffect(() => markResponseOpened(item), [item]);
  const mobile = useIsMobileViewport();
  // The size eases between the two (plan-board.md "Maximised"): a View Transition of the Dialog's panel.
  const [shownMaximised, onMaximise] = useAnimatedMaximise(!!props.maximised, props.onMaximise);
  const maximised = shownMaximised && !mobile;
  // It grows out of the card clicked and shrinks back into it (useCardMorph).
  const { probe: morphProbe, close: morphClose } = useCardMorph(item.id, onClose);
  return (
    <Dialog
      open
      onClose={morphClose}
      ariaLabel={item.key === PRACTICE_KEY ? 'Practice Card' : `Item #${item.key}`}
      size="3xl"
      phoneSheet
      // The trap lands on the panel itself, never its first control (the type picker, which nobody opens a card
      // to change); on a desktop the title then takes focus (useTitleFocus), on a phone it stays on the panel so
      // no keyboard rises (docs/specs/026-plan/plan-board.md "Open an item").
      initialFocus="container"
      className={panelSizeClass(maximised)}
      resizeTransition={PANEL_RESIZE_TRANSITION}
    >
      <span ref={morphProbe} hidden />
      {/* Cmd/Ctrl+Z and redo reach the plan while the panel is open (hooks/canvas/panel-history.ts). */}
      <span hidden {...{ [TAKES_HISTORY_ATTR]: '' }} />
      <ItemPanelContent
        key={item.id}
        {...props}
        onClose={morphClose}
        maximised={maximised}
        onMaximise={onMaximise}
      />
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
  canRetire = canEdit,
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
  onCopyLink,
  trail,
  linkedGroups = NO_GROUPS,
  fresh = false,
  onAddLinked,
  onLinkExisting,
  statusNames,
  linkedActions,
  maximised = false,
  onMaximise,
  statusTypes = NO_STATUS_TYPES,
}: ItemPanelProps) {
  const linkedPlace = linkedActions?.placeOf(item) ?? null;
  // A practice card of the Boards tour (plan-tour.md "Practice cards"): saved nowhere, so no menu and no comments.
  const practice = item.key === PRACTICE_KEY;
  const mobile = useIsMobileViewport();
  useTitleFocus(fieldId(item, 'title'), !mobile && canEdit, fresh);
  // When the panel opened: the meta line says how long ago the last change was from here.
  const [now] = useState(() => Date.now());
  const type = typeIn(types, item.type);
  const repeat = useItemRepeat({ item, type, statuses, canSet: canRetire, now, onSave });
  // Run Rule (docs/specs/026-plan/automations.md "On cards"): null unless an Editor has a Run from a Card rule on.
  const runRules = useRunRule(item.id);
  // Set by Automation: the fields whose latest change was a rule's, read while a rule made the card's last change.
  const historyScope = useCardThreadsContext()?.threads.scope ?? null;
  const automationHistory = useAutomationHistory(historyScope, item);
  const setByAutomation = automationHistory.setBy;
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
  // The type's tabs, then Linked Cards when a Card field can link to the type, then Activity, then (on a phone)
  // Details at the far right; the panel opens on the first.
  const linked = linkedGroups.length > 0;
  // The values it keeps that its type doesn't show (item-types.md "The Hidden tab"): one pass over its keys, which the
  // React Compiler memoises on its fields, type and catalogue.
  const hidden = hiddenValuesOf(item, type, types);
  const shownTabs = panelTabs(
    tabs,
    mobile ? { id: DETAILS_TAB, label: detailsLabelOf(type), fields: details } : null,
    linked ? linkedCardCount(linkedGroups) : null,
    hiddenValueCount(hidden),
  );
  const [picked, setPicked] = useState<string>(shownTabs[0]!.id);
  const current = shownTabs.find((t) => t.id === picked) ?? shownTabs[0]!;
  const pick = (id: string) => {
    // Picking Activity reads the card's history (items.md "History" "Where it shows").
    if (id === ACTIVITY_TAB && current.id !== ACTIVITY_TAB) track('Plan', 'Toggled', 'ActivityOn');
    if (id === HIDDEN_TAB && current.id !== HIDDEN_TAB) track('Plan', 'Opened', 'HiddenValues');
    setPicked(id);
  };
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
  };

  // A card's Blocked By sections sit on the type's first tab, before Comments, since they say what stops it
  // (docs/specs/026-plan/item-types.md "Blocked By"). The Linked as sections sit on the Linked Cards tab, even with no
  // cards in them: the generated one, or the type's own tab of that name, before its Comments ("The Linked Cards tab").
  const firstTabId = tabs[0]?.id;
  const blockedOnFirst = hasBlocksFields([type]);
  const linkedHostId = linked ? (namedLinkedTab(tabs)?.id ?? LINKED_TAB) : null;
  const linkedSection = (
    <LinkedCardsTab
      key="linked-cards"
      item={item}
      groups={linkedGroups}
      types={types}
      statusNames={statusNames}
      canAdd={canEdit && !!onAddLinked}
      onOpen={(id) => onOpenItem(id, 'ChildCard')}
      onAdd={(g, typeId) => onAddLinked?.(g, typeId)}
      onLinkExisting={onLinkExisting}
    />
  );
  // What a type's own tab adds before its Comments: the Blocked By sections on the first, the Linked as sections on
  // one named Linked Cards (both when the first is that one).
  const inserted = (id: string): ReactNode[] => [
    ...(id === firstTabId && blockedOnFirst
      ? [
          <BlockedBySections
            key="blocked-by"
            item={item}
            type={type}
            onOpen={(cardId) => onOpenItem(cardId, 'ChildCard')}
          />,
        ]
      : []),
    ...(id === linkedHostId ? [linkedSection] : []),
  ];
  const currentInserted = inserted(current.id);

  // The breadcrumb, the shared back bar, takes a row of its own above the header, so neither it nor the type picker
  // is squeezed.
  const trailRow =
    trail.length > 1 ? (
      <div className="border-b border-slate-200 px-3 pt-1.5 dark:border-slate-700">
        <ItemTrailCrumbs trail={trail} onBack={(id) => onOpenItem(id, 'Breadcrumb')} />
      </div>
    ) : null;

  const header = (
    <div className="flex min-h-12 items-center gap-2 px-4 py-2 sm:px-6">
      {/* The current card: its type picker and number, the trail's end (not a link). */}
      <ItemTypePill
        type={type}
        value={item.type}
        types={typeChoices(types, statusTypes, item)}
        canEdit={canEdit}
        onType={onType}
      />
      {practice ? (
        <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-brand-600">
          Practice
        </span>
      ) : (
        <ItemKeyTag itemKey={item.key} />
      )}
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
      {practice ? null : (
        <ItemPanelMenu
          itemKey={item.key}
          canEdit={canEdit}
          canRetire={canRetire}
          archived={isArchived(item)}
          flagged={isFlagged(item)}
          onDuplicate={onDuplicate}
          onFlag={onFlag}
          onArchive={onArchive}
          onTrash={onTrash}
          onEditType={onEditType}
          onCopyLink={onCopyLink}
          repeat={repeat.menu}
          runRules={canEdit ? runRules : null}
        />
      )}
      {onMaximise && !mobile ? (
        <ItemMaximiseButton maximised={maximised} onToggle={onMaximise} />
      ) : null}
      <DialogCloseButton compact onClick={onClose} />
    </div>
  );

  const meta = <ItemMeta item={item} now={now} />;
  // Its required custom fields, marked after their names (docs/specs/026-plan/item-types.md "Required fields").
  const requiredIds = new Set(requiredCustomFieldsOf(type).map((r) => r.id));

  // A Details row: label beside its control on a wide screen, above it in the phone's tab. A linked card's assignee
  // is its action's: shown, not picked here.
  const lockedAssignee = !!linkedPlace && canEdit;
  const detailRow = (f: string) => (
    <ItemDetailsRow
      key={f}
      field={f}
      label={fieldLabel(type, f)}
      htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
      required={requiredIds.has(f)}
      wide={maximised}
    >
      {f === 'assignee' && lockedAssignee ? (
        <>
          <ItemFieldEditor f={f} ctx={{ ...ctx, canEdit: false }} />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Set on the action</p>
        </>
      ) : (
        <ItemFieldEditor f={f} ctx={ctx} />
      )}
      {setByAutomation.has(f) ? <SetByAutomationChip /> : null}
    </ItemDetailsRow>
  );

  // A type's Comments fields draw their own heading line (the open count and New Thread beside the label).
  const commentFields = new Set(commentsFieldsOf(type));

  // A main-column field: its name over its editor.
  const mainField = (f: string): ReactNode => {
    if (commentFields.has(f) && practice)
      return (
        <ItemPanelSection key={f} heading={fieldLabel(type, f)}>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Comments are kept on real cards. This one is practice, on your screen alone.
          </p>
        </ItemPanelSection>
      );
    if (commentFields.has(f))
      return (
        <CardThreads key={f} item={item} type={type} field={f} heading={fieldLabel(type, f)} />
      );
    return (
      <ItemPanelSection
        key={f}
        heading={fieldLabel(type, f)}
        htmlFor={labelsItsControl(type, f) ? fieldId(item, f) : undefined}
        required={requiredIds.has(f)}
      >
        <ItemFieldEditor f={f} ctx={ctx} />
      </ItemPanelSection>
    );
  };

  const tabPanel = (
    <div
      role="tabpanel"
      id={`item-${item.id}-panel-${current.id}`}
      aria-labelledby={`item-${item.id}-tab-${current.id}`}
    >
      {current.id === ACTIVITY_TAB ? (
        <CardActivityTab item={item} />
      ) : current.id === DETAILS_TAB ? (
        <div className="flex flex-col">
          {details.map(detailRow)}
          <CardPullRequests item={item} type={type} />
          {repeat.line}
          {meta}
        </div>
      ) : current.id === LINKED_TAB ? (
        linkedSection
      ) : current.id === HIDDEN_TAB ? (
        <HiddenValuesTab groups={hidden} ctx={ctx} canChange={canRetire && !practice} />
      ) : currentInserted.length > 0 ? (
        tabFieldsWithInserted(type, current.fields, mainField, currentInserted)
      ) : current.fields.length > 0 ? (
        current.fields.map(mainField)
      ) : (
        <p className="py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
          Nothing on this tab yet. Edit the card type to add fields to it.
        </p>
      )}
    </div>
  );

  return (
    <>
      <ItemTypeBand colour={type.color} />
      {trailRow}
      {header}
      <div className="flex min-h-0 flex-1">
        <div
          className={`min-w-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 sm:px-8 ${maximised ? 'lg:px-12' : ''}`}
        >
          {/* Maximised, the column keeps a reading width, centred in the room beside Details. */}
          <div className={maximised ? 'mx-auto max-w-[52rem]' : undefined}>
            {linkedPlace && linkedActions ? (
              <LinkedActionBanner
                tabName={linkedPlace.tabName}
                // Closes the panel and goes to the action.
                onShowOnCanvas={() => {
                  onClose();
                  linkedActions.showOnCanvas(item);
                }}
              />
            ) : null}
            <DebouncedText
              id={fieldId(item, 'title')}
              label="Title"
              value={itemTitle(item)}
              maxLength={ITEM_TITLE_MAX}
              // Enter saves the title and closes the card.
              onEnter={onClose}
              // A long title wraps to three lines, then scrolls; a short one keeps to one (plan-board.md "Look").
              wrapLines={3}
              required
              placeholder="Title"
              disabled={!canEdit}
              onSave={(v) => onSave('title', v)}
              className={`-mx-2 mb-5 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 py-1 ${maximised ? 'text-[26px]' : 'text-[22px]'} font-semibold leading-snug tracking-tight text-slate-900 outline-none transition hover:bg-slate-50 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:text-slate-50 dark:hover:bg-slate-800/50 dark:focus:bg-slate-950`}
            />
            <ItemPanelTabBar itemId={item.id} tabs={shownTabs} current={current.id} onPick={pick} />
            {tabPanel}
          </div>
        </div>
        {mobile ? null : (
          <aside
            aria-label={detailsLabelOf(type)}
            className={`m-3 ml-0 flex shrink-0 flex-col ${maximised ? 'w-96 px-5 2xl:w-[28rem]' : 'w-80 px-4'} overflow-y-auto rounded-xl bg-slate-50 py-4 ring-1 ring-slate-200/70 dark:bg-slate-800/40 dark:ring-slate-700/60`}
          >
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {detailsLabelOf(type)}
            </h3>
            {details.map(detailRow)}
            <CardPullRequests item={item} type={type} />
            {repeat.line}
            {meta}
          </aside>
        )}
      </div>
      {repeat.dialog}
    </>
  );
}

// A tab's fields with sections (Blocked By, Linked as) placed before its first Comments field (or last when it has
// none).
function tabFieldsWithInserted(
  type: ItemTypeDef,
  fields: readonly string[],
  mainField: (f: string) => ReactNode,
  sections: readonly ReactNode[],
): ReactNode[] {
  const comments = new Set(commentsFieldsOf(type));
  const at = fields.findIndex((f) => comments.has(f));
  const cut = at < 0 ? fields.length : at;
  return [...fields.slice(0, cut).map(mainField), ...sections, ...fields.slice(cut).map(mainField)];
}
