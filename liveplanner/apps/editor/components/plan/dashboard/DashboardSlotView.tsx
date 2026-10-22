'use client';

// One Dashboard slot (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): a framed card spanning its twelfths of the
// row, holding its content (a Board or Sheet tab drawn compact, a plan view or chart at the slot's size, a note) or,
// empty, an invitation to drag something from the palette into it. Its settings sit in one cog: the cog of what it
// shows, holding the slot's Slot section too, or the slot's own Slot Settings cog (SlotCog), on hover or focus.
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { CompactEmptyState, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideGripVertical, lucideLayoutGrid } from '@liveplanner/icons/lucide';
import { dashboardNeighbour, moveDashboardSlot } from '@liveplanner/project';
import { DASHBOARD_SPANS, type DashboardLayout, type DashboardSlot } from '@liveplanner/project';
import { DASHBOARD_GAP_PX } from '@/hooks/plan/slot-fit';
import { useDashboard } from './dashboard-context';
import { SLOT_SECTION, SlotSettings, type SlotSettingsValue } from './slot-menu';
import { SlotSection } from './SlotSection';
import { SlotToolbar } from './SlotToolbar';
import { SlotCog } from './SlotCog';
import { DashboardSlotContent } from './DashboardSlotContent';
import { SlotFillPicker } from './SlotFillPicker';
import { SheetChartSource } from './SheetChartSource';
import { DashedAddButton } from '@/components/primitives/DashedAddButton';
import { useSlotEnter } from './useSlotEnter';
import { isCondensed } from './condense';
import { isDashboardStyledType } from '@liveplanner/project';
import { useCardStyle } from './useCardStyle';
import { CardStyleSections } from './CardStyleSections';
import { cardFrameStyle, cardInkClass, cardInkStyle } from './card-look';

const SlotGlyph = lucideGlyph(lucideLayoutGrid, 18);
const GripGlyph = () => (
  <span className="rotate-90">
    <GripRaw />
  </span>
);
const GripRaw = lucideGlyph(lucideGripVertical, 14);

const GAP = DASHBOARD_GAP_PX;
// On a touch screen a slot with no header of its own carries its always-shown grip in its top left corner.
const GRIP_CORNER_ON_TOUCH =
  '[@media(hover:none)]:left-2 [@media(hover:none)]:top-2 [@media(hover:none)]:translate-x-0';

const SLOT_CARD =
  'overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white/[0.72] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.22)] transition duration-micro hover:-translate-y-px hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_40px_-16px_rgba(15,23,42,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/[0.08] dark:bg-slate-900/60 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_12px_32px_-16px_rgba(0,0,0,0.6)]';

export function DashboardSlotView({
  rowId,
  slot,
  at,
  span = slot.span,
  phone,
}: {
  rowId: string;
  slot: DashboardSlot;
  // The twelfths it is drawn across.
  span?: number;
  // On a phone: stacked full width, sized for what it holds (condense.ts phoneSlotStyle), rather than the wide row's
  // eased flex; it cannot be carried by a grip there (the stack is only a way of drawing the rows).
  phone?: CSSProperties | undefined;
  // Where it sits: its index in its row, its row's index, and how many slots the row has (the edge markers).
  at: { slot: number; row: number; slots: number };
}) {
  const { canEdit, actions, elements, fit, beginMove, movingSlotId, layout } = useDashboard();
  const cellRef = useRef<HTMLDivElement>(null);
  useSlotEnter(cellRef, at.slot);
  const tabId = slot.content?.type === 'tab' ? slot.content.tabId : null;
  // What the slot shows has a header of its own (a board, a Sheet, a visualisation, a Board or Sheet tab): the slot's settings
  // join its cog there (slot-menu.ts). A metric, a note or an empty slot has none: the slot's cog floats at the top
  // right on hover.
  const content = slot.content;
  const el =
    content?.type === 'element'
      ? (elements.get(content.elementId) as
          { shape?: string; planView?: { view?: string } } | undefined)
      : undefined;
  const headed =
    content?.type === 'tab' ||
    el?.shape === 'plan-board' ||
    el?.shape === 'plan-sheet' ||
    (!!el?.planView && !el.planView.view?.startsWith('metric:'));
  // An Editor's whole Slot section; anyone else's only Open Tab, so a slot showing no tab offers them nothing.
  const hasMenu = canEdit || !!tabId;
  // A Utility's style (plan-tabs.md "Card style"): drawn on its card, changed from its cog's Style row by an Editor.
  const card = useCardStyle(slot.id, content);
  const styledType = content && isDashboardStyledType(content.type) ? content.type : null;
  // A board or Sheet (its own, or a tab's) brings its own frame; a Title sits bare on the page, as a section's heading.
  const framed =
    content?.type === 'tab' ||
    content?.type === 'title' ||
    el?.shape === 'plan-board' ||
    el?.shape === 'plan-sheet';
  // The slot's settings (slot-menu.ts): its Slot section, folded into the cog of what it shows, or its own cog.
  const { slot: atSlot, row: atRow, slots: atSlots } = at;
  // Stacked on a phone, where no grip carries it: its toolbar moves it up and down the stack instead.
  const stacked = !!phone;
  const settings = useMemo<SlotSettingsValue | null>(() => {
    if (!hasMenu) return null;
    const where = { slot: atSlot, row: atRow, slots: atSlots };
    const sections: SlotSettingsValue['sections'] = (section, close) => (
      <SlotSection
        rowId={rowId}
        slot={slot}
        at={where}
        {...section(SLOT_SECTION)}
        onClose={close}
      />
    );
    const toolbar: SlotSettingsValue['toolbar'] = (close) => (
      <SlotToolbar rowId={rowId} slot={slot} stacked={stacked} onClose={close} />
    );
    return { sections, toolbar, cog: <SlotCog sections={sections} /> };
  }, [hasMenu, rowId, slot, atSlot, atRow, atSlots, stacked]);
  return (
    // The grid cell: the card inside it, and the edge markers on its edges (outside the card, which clips).
    <div
      ref={cellRef}
      data-dashboard-slot={slot.id}
      // Show Me (plan-tabs.md "Show Me") points at an empty slot to fill and a filled one to change.
      data-slot-empty={slot.content ? undefined : ''}
      className={`group/slot relative min-w-0 ${phone ? '' : 'transition-[flex-basis] duration-short ease-out motion-reduce:transition-none'}`}
      style={
        phone ??
          // Its twelfths of the row, less its share of the gaps; eased as the span changes.
          { flex: `0 0 calc((100% + ${GAP}px) * ${span / DASHBOARD_SPANS} - ${GAP}px)` }
      }
    >
      {beginMove && !phone ? (
        // The grip a slot is carried by (plan-tabs.md "Moving a slot"), on its top edge's middle.
        <Tooltip label="Move Slot">
          <button
            type="button"
            aria-label="Move Slot"
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              beginMove(slot.id, e);
            }}
            // From the keyboard: an arrow swaps this slot with its neighbour that way, and focus follows it.
            onKeyDown={(e) => {
              const dir = ARROW_DIRS[e.key];
              if (!dir) return;
              e.preventDefault();
              e.stopPropagation();
              const to = layout ? dashboardNeighbour(layout, slot.id, dir) : null;
              if (!to) return;
              // A swap that would squeeze either slot's content is not made (useFitGuard).
              const swap = (l: DashboardLayout) =>
                moveDashboardSlot(l, slot.id, { kind: 'slot', slotId: to }, newId);
              if (fit && !fit.keeps(swap)) return;
              actions.changeDashboard(
                (l) => moveDashboardSlot(l, slot.id, { kind: 'slot', slotId: to }, newId),
                'DashboardSlot',
              );
              // The slots keep their places (only what they hold swaps), so the target's grip is there now.
              document
                .querySelector<HTMLElement>(
                  `[data-dashboard-slot="${to}"] [aria-label="Move Slot"]`,
                )
                ?.focus();
            }}
            // touch-none: a finger on the grip carries the slot rather than scrolling the page under it. A touch screen
            // has no hover to reveal it: there it is always shown, quietly, with a finger's tap area, in the slot's top
            // left corner (the cog holds the right) where nothing heads the slot, clear of what it shows in its middle;
            // a slot with a header of its own (its title at the left) keeps it in the middle of its top edge.
            className={`touch-target absolute left-1/2 top-1.5 z-30 flex h-5 w-9 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border border-slate-900/10 bg-white text-slate-500 opacity-0 shadow-sm scale-75 transition-[opacity,scale,color] duration-micro ease-out hover:text-brand-700 focus-visible:scale-100 focus-visible:opacity-100 active:cursor-grabbing group-hover/slot:scale-100 group-hover/slot:opacity-70 group-data-[tour-reveal]/slot:scale-100 group-data-[tour-reveal]/slot:opacity-100 hover:!opacity-100 motion-reduce:scale-100 motion-reduce:transition-none dark:border-white/[0.06] dark:bg-slate-800 dark:text-slate-400 dark:group-hover/slot:opacity-50 dark:hover:text-brand-300 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-70 ${headed ? '' : GRIP_CORNER_ON_TOUCH}`}
          >
            <GripGlyph />
          </button>
        </Tooltip>
      ) : null}
      <div
        // A translucent card over the canvas (plan-tabs.md "Look"): no backdrop blur, which every slot would recomposite
        // on scroll. A board or Sheet draws its own frame, so its card is bare: the board's corners are the slot's.
        className={`relative h-full transition-opacity duration-micro motion-reduce:transition-none ${framed ? '' : SLOT_CARD} ${movingSlotId === slot.id ? 'opacity-40' : ''}`}
        // The card's border in the Dashboard tab's theme (its stroke colour), under any style of its own; the
        // Default scheme, with none, keeps the soft neutral line.
        style={
          framed
            ? undefined
            : {
                ...(card.theme.elementStroke ? { borderColor: card.theme.elementStroke } : {}),
                ...cardFrameStyle(card.look),
              }
        }
      >
        {slot.content ? (
          <SlotSettings.Provider value={headed ? settings : null}>
            <div className={cardInkClass(card.look)} style={cardInkStyle(card.look)}>
              <DashboardSlotContent slotId={slot.id} content={slot.content} />
            </div>
          </SlotSettings.Provider>
        ) : (
          <SlotEmpty canEdit={canEdit} slotId={slot.id} />
        )}
        {settings && !headed ? (
          // Shown on hover or focus; always on a screen with no hover (a phone), where a tap must find it.
          <div className="absolute right-2 top-2 z-10 origin-top-right scale-90 opacity-0 transition-[opacity,scale] duration-micro ease-out focus-within:scale-100 focus-within:opacity-100 group-hover/slot:scale-100 group-hover/slot:opacity-100 group-data-[tour-reveal]/slot:scale-100 group-data-[tour-reveal]/slot:opacity-100 motion-reduce:scale-100 motion-reduce:transition-none [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100">
            {/* In the slot's settings, so its cog draws the slot's toolbar (SettingsCog). */}
            <SlotSettings.Provider value={settings}>
              <SlotCog
                floating
                sections={settings.sections}
                head={
                  canEdit && styledType
                    ? (close) => <CardStyleSections type={styledType} card={card} onClose={close} />
                    : undefined
                }
              />
            </SlotSettings.Provider>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// An empty slot, in the site's empty-state language at a slot's size.
// An Editor fills it from Add to Slot (SlotFillPicker) or the palette.
function SlotEmpty({ canEdit, slotId }: { canEdit: boolean; slotId: string }) {
  const { actions } = useDashboard();
  const [pickerAt, setPickerAt] = useState<HTMLElement | null>(null);
  const [chartAt, setChartAt] = useState<HTMLElement | null>(null);
  // The slot's size as the picker opens: it offers only what fits.
  const [slotSize, setSlotSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <>
      <CompactEmptyState
        className="h-full"
        icon={<SlotGlyph />}
        title="Empty Slot"
        action={
          canEdit ? (
            // The shared dashed add row, as Add New Card Type wears it, kept to a button's width in a wide slot.
            <DashedAddButton
              label="Add to Slot"
              aria-haspopup="dialog"
              aria-expanded={!!pickerAt}
              className="max-w-56"
              onClick={(e) => {
                if (pickerAt) {
                  setPickerAt(null);
                  return;
                }
                const box = e.currentTarget
                  .closest('[data-dashboard-slot]')
                  ?.getBoundingClientRect();
                // On a phone the slot takes the height what it holds needs (condense.ts): everything fits.
                const row = e.currentTarget
                  .closest('[data-dashboard-row]')
                  ?.getBoundingClientRect();
                setSlotSize(
                  box && !isCondensed(row?.width) ? { width: box.width, height: box.height } : null,
                );
                setPickerAt(e.currentTarget);
              }}
            />
          ) : undefined
        }
      />
      {pickerAt ? (
        <SlotFillPicker
          anchor={pickerAt}
          size={slotSize}
          onClose={() => setPickerAt(null)}
          onPick={(item) => {
            setPickerAt(null);
            // A Sheet Chart asks for its sheet and chart first, where Add to Slot was (plan-tabs.md "Sheet Chart").
            if (item.kind === 'sheet-chart' && !item.chart) setChartAt(pickerAt);
            else actions.placeItem(item, { kind: 'slot', slotId });
          }}
        />
      ) : null}
      {chartAt ? (
        <SheetChartSource
          anchor={chartAt}
          onChoose={(chart) =>
            actions.placeItem({ kind: 'sheet-chart', chart }, { kind: 'slot', slotId })
          }
          onClose={() => setChartAt(null)}
        />
      ) : null}
    </>
  );
}

const newId = () => crypto.randomUUID();

const ARROW_DIRS: Record<string, 'left' | 'right' | 'up' | 'down' | undefined> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};
