'use client';

// Add to Slot (docs/specs/026-plan/plan-tabs.md "Filling a slot"): an empty slot's own way to fill it, without the
// palette. A popover of what a slot takes, from the palette's own tiles so the two never drift (the project's Board
// and Sheet tabs, a new board of each preset, a Sheet, the metrics, the visualisations, figures and charts from a
// Sheet, and the cards), offering only what looks good at this slot's size (SLOT_FIT). It opens on its categories
// (the palette's ToolsCategoryGrid); one opens to its tiles, each drawn as it would look there, under the breadcrumb
// back (Escape and Backspace go back too). Picking one fills this slot (placeItem, one step) and closes it.
import { useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorContext } from '@/app/project/[id]/EditorContext';
import {
  isPlanViewId,
  type MetricKind,
  type PlanBoardPresetId,
  type PlanVisualisation,
} from '@liveplanner/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { planPalette, type PlanPalette } from '../plan-palette';
import { BoardPreview, SHEET_TILES, SheetPreview } from '../PlanBoardPicker';
import { BOARD_WIDGET_INFO } from '@liveplanner/plan-art';
import { MetricPreview, NotePreview, VisualisationPreview } from './slot-previews';
import {
  CardPreview,
  FormMetricPreview,
  SheetChartPreview,
  SheetMetricPreview,
} from './card-previews';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { ToolsBreadcrumb } from '@liveworkspace/workbench/components/palette/palette-tools-nav';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideArrowUpDown } from '@liveworkspace/icons/lucide';
import { PICK_CARD, SlotCategoryCard, type SlotCategory } from './slot-fill-categories';
import { tileById, tilesForCategory } from '@/components/palette/palette-tile-defs';
import { tileCaption } from '@/components/palette/tile-caption';
import type { PaletteTileDef } from '@/components/palette/palette-tile-defs';
import {
  DASHBOARD_CARD_TILES,
  DASHBOARD_FORM_TILES,
  DASHBOARD_SHEET_TILES,
  dashboardTabTiles,
} from '@/components/palette/palette-dashboard-tiles';
import { dashboardItemOf, type DashboardItem } from '@/hooks/plan/dashboard-drop';
import { fitKindOf, fitsSlot, type SlotFitKind, type SlotSize } from '@/hooks/plan/slot-fit';
export { fitsSlot } from '@/hooks/plan/slot-fit';
import { usePlanTabList } from '@/hooks/plan/plan-tab-list-store';

// The Dashboard item a palette tile stands for, or null for one a slot does not take.
export function slotItemOfTile(tile: PaletteTileDef): DashboardItem | null {
  const a = tile.action;
  if (a.type === 'shape') return dashboardItemOf(a.kind, a.plan);
  return dashboardItemOf(a.type);
}

type Section = { title: SlotCategory; tiles: PaletteTileDef[] };

// The picker's sections, in order: only what fits the slot (all of it when its size is unknown), empty sections left
// out; and the kinds left out for being too big, for the line that says so.
export function slotFillSections(
  tabTiles: PaletteTileDef[],
  size: SlotSize | null = null,
  // Whether the project has a form: Form Metrics are offered only then.
  hasForms = false,
): { sections: Section[]; tooBig: SlotFitKind[] } {
  const sticky = tileById('tools:sticky');
  const all: Section[] = [
    { title: 'This Plan’s Tabs', tiles: tabTiles },
    { title: 'New Board', tiles: tilesForCategory('plan-boards') },
    { title: 'New Sheet', tiles: tilesForCategory('plan-sheets') },
    { title: 'Card Metrics', tiles: tilesForCategory('plan-metrics') },
    { title: 'Form Metrics', tiles: hasForms ? DASHBOARD_FORM_TILES : [] },
    { title: 'Visualisations', tiles: tilesForCategory('plan-visualisations') },
    { title: 'From a Sheet', tiles: DASHBOARD_SHEET_TILES },
    { title: 'Utilities', tiles: [sticky, ...DASHBOARD_CARD_TILES].filter((t) => !!t) },
  ];
  const tooBig = new Set<SlotFitKind>();
  const sections = all
    .map((s) => ({
      ...s,
      tiles: s.tiles.filter((t) => {
        const item = slotItemOfTile(t);
        if (!item) return false;
        if (fitsSlot(item, size)) return true;
        const kind = fitKindOf(item);
        if (kind) tooBig.add(kind);
        return false;
      }),
    }))
    .filter((s) => s.tiles.length > 0);
  return {
    sections,
    tooBig: (['board', 'sheet', 'chart'] as const).filter((k) => tooBig.has(k)),
  };
}

// The category shown (null: the categories), and whether it is the only one (opened at once, nowhere to go back to).
export function openSection<S extends { title: string }>(
  sections: readonly S[],
  openTitle: string | null,
): { open: S | null; only: boolean } {
  if (sections.length === 1) return { open: sections[0]!, only: true };
  return { open: sections.find((s) => s.title === openTitle) ?? null, only: false };
}

const TOO_BIG_NAMES: Record<SlotFitKind, string> = {
  board: 'boards',
  sheet: 'sheets',
  chart: 'charts',
  metric: 'metrics',
  note: 'notes',
};

// "Boards, sheets and charts need a bigger slot."
export function tooBigLine(kinds: readonly SlotFitKind[]): string | null {
  if (kinds.length === 0) return null;
  const names = kinds.map((k) => TOO_BIG_NAMES[k]);
  const list =
    names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list[0]!.toUpperCase()}${list.slice(1)} need a bigger slot: drag the row’s lower edge to make it taller.`;
}

// The tile drawn as it would look in the slot.
function TilePicture({
  item,
  label,
  palette,
}: {
  item: DashboardItem;
  label: string;
  palette: PlanPalette;
}) {
  if (item.kind === 'board')
    return (
      <BoardPreview preset={(item.preset ?? 'blank') as PlanBoardPresetId} palette={palette} />
    );
  if (item.kind === 'sheet') {
    const tile = SHEET_TILES.find((t) => (t.start ?? undefined) === item.start) ?? SHEET_TILES[0]!;
    return <SheetPreview palette={palette} tile={tile} />;
  }
  if (item.kind === 'tab')
    return item.of === 'sheet' ? (
      <SheetPreview palette={palette} tile={SHEET_TILES[3] ?? SHEET_TILES[0]!} />
    ) : (
      <BoardPreview preset="kanban" palette={palette} />
    );
  if (item.kind === 'view' && isPlanViewId(item.view)) {
    if (item.view.startsWith('metric:')) {
      const kind = item.view.slice(7) as MetricKind;
      return <MetricPreview kind={kind} label={BOARD_WIDGET_INFO[kind].label} palette={palette} />;
    }
    return <VisualisationPreview view={item.view as PlanVisualisation} palette={palette} />;
  }
  if (item.kind === 'note') return <NotePreview palette={palette} />;
  if (item.kind === 'card') return <CardPreview card={item.card} palette={palette} />;
  if (item.kind === 'sheet-metric')
    return <SheetMetricPreview metric={item.metric} palette={palette} />;
  if (item.kind === 'form-metric')
    return <FormMetricPreview metric={item.metric} palette={palette} />;
  if (item.kind === 'sheet-chart') return <SheetChartPreview palette={palette} />;
  return <span aria-hidden>{label}</span>;
}

export function SlotFillPicker({
  anchor,
  size,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  // The slot's size, measured as the picker opened.
  size: SlotSize | null;
  onPick: (item: DashboardItem) => void;
  onClose: () => void;
}) {
  const tabs = usePlanTabList();
  const palette = planPalette(useCanvasSurface(), {});
  // Form Metrics only while the project has a form (docs/specs/026-plan/plan-tabs.md "Form Metrics").
  const hasForms = useContext(EditorContext)?.tabs.some((t) => t.kind === 'form') ?? false;
  const { sections, tooBig } = useMemo(
    () => slotFillSections(dashboardTabTiles(tabs), size, hasForms),
    [tabs, size, hasForms],
  );
  const hint = tooBigLine(tooBig);
  // null: the categories. A lone category opens at once, with nowhere to go back to.
  const [nav, setNav] = useState<{ title: string | null; dir: 'in' | 'back' | null }>({
    title: null,
    dir: null,
  });
  const { open, only } = openSection(sections, nav.title);
  const scroller = useRef<HTMLDivElement>(null);
  // The categories' scroll, kept while drilled in and put back on return.
  const rootScroll = useRef(0);
  // Drilled in, the first choice takes focus; back, the category it came from.
  const focusAfter = useRef<string | null>(null);
  useLayoutEffect(() => {
    const at = focusAfter.current;
    focusAfter.current = null;
    if (at === null) return;
    if (scroller.current) scroller.current.scrollTop = at ? rootScroll.current : 0;
    const target = at
      ? scroller.current?.querySelector<HTMLElement>(`[data-category-id="${CSS.escape(at)}"]`)
      : scroller.current?.querySelector<HTMLElement>('[data-fill-card]');
    target?.focus({ preventScroll: true });
  }, [nav]);
  const drillIn = (title: string) => {
    rootScroll.current = scroller.current?.scrollTop ?? 0;
    focusAfter.current = '';
    setNav({ title, dir: 'in' });
  };
  const back = () => {
    if (only || nav.title === null) return false;
    focusAfter.current = nav.title;
    setNav({ title: null, dir: 'back' });
    return true;
  };
  const [levelRef, levelHeight] = useLevelHeight(nav, nav.dir !== null);
  // Each level slides in from where it lies: a category from the right, the categories from the left. The first
  // open cascades its cards instead.
  const slide =
    nav.dir === 'in' ? 'animate-tip-next' : nav.dir === 'back' ? 'animate-tip-prev' : '';
  return (
    <AnchoredPopover
      anchor={anchor}
      name="Add to Slot"
      width={480}
      onClose={onClose}
      onEscape={back}
    >
      <div
        className="flex max-h-[inherit] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onKeyDown={(e) => {
          // Backspace on the drill-down goes back a level, as Escape does.
          if (e.key === 'Backspace' && back()) e.preventDefault();
        }}
      >
        <div className="flex items-baseline gap-2 border-b border-slate-100 px-4 pb-2.5 pt-3 dark:border-slate-800">
          <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
            Add to Slot
          </h3>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
            What fits here, as it will look.
          </p>
        </div>
        <div
          ref={scroller}
          className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          <div
            className="overflow-hidden transition-[height] duration-short ease-out motion-reduce:transition-none"
            style={levelHeight === null ? undefined : { height: levelHeight }}
          >
            <div ref={levelRef} key={open?.title ?? ''} className={`p-3 ${slide}`}>
              {open ? (
                <section aria-label={open.title}>
                  {only ? null : (
                    <ToolsBreadcrumb root="Add to Slot" label={open.title} onBack={back} />
                  )}
                  <div className="grid grid-cols-2 gap-2.5">
                    {open.tiles.map((t) => {
                      const item = slotItemOfTile(t)!;
                      return (
                        <FillCard
                          key={t.id}
                          label={t.label}
                          caption={tileCaption(t.label, t.caption)}
                          picture={<TilePicture item={item} label={t.label} palette={palette} />}
                          onPick={() => onPick(item)}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    {sections.map((sec, i) => (
                      <SlotCategoryCard
                        key={sec.title}
                        title={sec.title}
                        count={sec.tiles.length}
                        palette={palette}
                        index={i}
                        cascade={nav.dir === null}
                        onOpen={() => drillIn(sec.title)}
                      />
                    ))}
                  </div>
                  {hint ? (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11.5px] leading-snug text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      <span aria-hidden className="mt-px shrink-0">
                        <ResizeGlyph />
                      </span>
                      {hint}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AnchoredPopover>
  );
}

const ResizeGlyph = lucideGlyph(lucideArrowUpDown, 14);

// The height a level takes, followed as it changes so moving between levels eases rather than jumps: none until the
// first level change (`eased`; nothing to ease from), then the measured height of what is shown.
function useLevelHeight(key: unknown, eased: boolean) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const read = () => setH(el.offsetHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  return [inner, eased ? h : null] as const;
}

function FillCard({
  label,
  caption,
  picture,
  onPick,
}: {
  label: string;
  caption: string;
  picture: ReactNode;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-fill-card
      onClick={onPick}
      className={`${PICK_CARD} gap-1.5 p-1.5`}
    >
      <span className="pointer-events-none block">{picture}</span>
      <span className="truncate px-1 pb-0.5 text-[12px] font-medium text-slate-700 group-hover:text-brand-700 dark:text-slate-200 dark:group-hover:text-brand-300">
        {caption}
      </span>
    </button>
  );
}
