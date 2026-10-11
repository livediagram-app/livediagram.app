'use client';

// Start Planning (docs/specs/026-plan/plan-mode.md "Starting a board"): an empty Plan tab's one wide panel. A rail of
// categories (Recommended, Boards, Spreadsheets, Dashboards, and Something Else, the Quick Start) beside a grid of
// large cards, each a picture of what it makes over its name, line and (a board's) card types; a search across all of
// them. Choosing a card acts at once. In the tab's own light or dark look (planPalette).
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { DASHBOARD_PRESETS } from '@livediagram/document';
import {
  CompactEmptyState,
  CountBadge,
  SearchIcon,
  lucideGlyph,
  noMatchTitle,
} from '@livediagram/ui';
import {
  lucideArrowUpRight,
  lucideChartPie,
  lucideGrid3x3,
  lucideLayoutGrid,
  lucideLightbulb,
  lucideSearch,
  lucideSparkles,
  lucideSquareKanban,
  lucideStar,
  lucideX,
} from '@livediagram/icons/lucide';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TemplatePreview } from '@livediagram/template-previews';
import type { PlanTemplateKind } from '@livediagram/templates';
import type { Tab } from '@livediagram/document';
import { suggestedDashboards, type SuggestedDashboard } from '@/lib/suggested-dashboards';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { PlacedSheetStart } from '@/lib/sheet-seeds';
import { usePlan } from '../PlanContext';
import { planPalette, type PlanPalette } from '../plan-palette';
import { BoardPreview, SHEET_TILES, SheetPreview } from '../PlanBoardPicker';
import { DashboardLayoutPicture } from '../DashboardLayoutPicture';
import { VisualisationPreview } from '../dashboard/slot-previews';
import type { PlanVisualisation } from '@livediagram/items';
import {
  KIND_NAMES,
  START_CATEGORIES,
  itemsIn,
  searchStartItems,
  startItems,
  type StartCategory,
  type StartItem,
} from './start-planning-items';

const RAIL_ICONS: Record<StartCategory, ReturnType<typeof lucideGlyph>> = {
  recommended: lucideGlyph(lucideStar, 16),
  boards: lucideGlyph(lucideSquareKanban, 16),
  sheets: lucideGlyph(lucideGrid3x3, 16),
  visualisations: lucideGlyph(lucideChartPie, 16),
  dashboards: lucideGlyph(lucideLayoutGrid, 16),
  inspiration: lucideGlyph(lucideLightbulb, 16),
};
const TemplatesGlyph = lucideGlyph(lucideSparkles, 16);
const OutGlyph = lucideGlyph(lucideArrowUpRight, 14);
const SearchGlyph = lucideGlyph(lucideSearch, 15);
const ClearGlyph = lucideGlyph(lucideX, 13);

// The most card types a board's card shows as chips; the rest are counted.
const CHIPS_MAX = 3;

const tint = (palette: PlanPalette, pct: number) =>
  `color-mix(in srgb, ${palette.focus} ${pct}%, transparent)`;

function Picture({ item, palette }: { item: StartItem; palette: PlanPalette }) {
  if (item.kind === 'board') return <BoardPreview preset={item.preset} palette={palette} />;
  // A template's preview is light-canvas art: on a re-lit tile, as the Quick Start draws it.
  if (item.kind === 'template')
    return (
      <span className="preview-art-tile flex h-full w-full items-center justify-center rounded-lg bg-slate-50 [&>svg]:h-full [&>svg]:w-auto">
        <TemplatePreview kind={item.template} />
      </span>
    );
  if (item.kind === 'visualisation')
    return <VisualisationPreview view={item.view} palette={palette} />;
  if (item.kind === 'sheet') {
    const tile = SHEET_TILES.find((t) => t.start === item.start) ?? SHEET_TILES[0]!;
    return <SheetPreview palette={palette} tile={tile} />;
  }
  if (item.suggestion)
    return (
      <DashboardLayoutPicture
        rows={item.suggestion.rows.map((r) => [r.height, r.slots.map((x) => x.span)] as const)}
        palette={palette}
      />
    );
  const preset = DASHBOARD_PRESETS.find((p) => p.id === item.layout)!;
  return <DashboardLayoutPicture rows={preset.rows} palette={palette} />;
}

function StartCard({
  item,
  palette,
  showKind,
  onChoose,
}: {
  item: StartItem;
  palette: PlanPalette;
  showKind: boolean;
  onChoose: () => void;
}) {
  const chips = item.types?.slice(0, CHIPS_MAX) ?? [];
  const more = (item.types?.length ?? 0) - chips.length;
  return (
    // A cell of its own: the cascade moves the cell, the card keeps its hover lift.
    <div className="flex">
      <button
        type="button"
        data-start-card={item.id}
        onClick={onChoose}
        aria-label={`${item.name}${showKind ? ` ${KIND_NAMES[item.kind]}` : ''}: ${item.line}`}
        // On a phone a row: the picture small at the left, the words beside it, so a screen holds several.
        className="group flex w-full cursor-pointer flex-col rounded-2xl border p-2 text-left max-sm:flex-row max-sm:items-center max-sm:gap-1 max-sm:rounded-xl transition duration-micro ease-out hover:-translate-y-0.5 hover:border-[var(--start-accent)] hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:border-[var(--start-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--start-accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        style={{ borderColor: palette.border, backgroundColor: palette.surface }}
      >
        {/* The picture, larger than it draws elsewhere, on a soft panel of the board's column colour. */}
        <span
          className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl p-3 max-sm:h-[4.5rem] max-sm:w-24 max-sm:shrink-0 max-sm:rounded-lg max-sm:p-1.5 [&>*]:!h-full"
          style={{ backgroundColor: palette.column }}
        >
          <Picture item={item} palette={palette} />
        </span>
        <span className="flex min-w-0 flex-col gap-1 px-1.5 pb-1 pt-2.5 max-sm:flex-1 max-sm:py-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold" style={{ color: palette.text }}>
              {item.name}
            </span>
            {/* One badge at most, so the name keeps its room: a suggestion's For You, else its kind where kinds mix. */}
            {item.kind === 'dashboard' && item.suggestion ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: tint(palette, 14), color: palette.focus }}
              >
                For You
              </span>
            ) : showKind ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: tint(palette, 14), color: palette.focus }}
              >
                {KIND_NAMES[item.kind]}
              </span>
            ) : null}
            {item.tabs ? (
              <span
                className="ml-auto shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold tabular-nums"
                style={{ borderColor: palette.border, color: palette.muted }}
              >
                {item.tabs} {item.tabs === 1 ? 'Tab' : 'Tabs'}
              </span>
            ) : null}
          </span>
          <span
            // In full: a card's line is short, and cut it misleads (on a phone, two lines at most beside the picture).
            className="text-[12.5px] leading-snug max-sm:line-clamp-2"
            style={{ color: palette.muted }}
          >
            {item.line}
          </span>
          {chips.length || item.typesNote ? (
            <span className="mt-1 flex flex-wrap gap-1 max-sm:hidden">
              {item.typesNote ? (
                <Chip palette={palette}>{item.typesNote}</Chip>
              ) : (
                chips.map((t) => (
                  <Chip key={t.label} palette={palette} dot={t.color}>
                    {t.label}
                  </Chip>
                ))
              )}
              {more > 0 ? <Chip palette={palette}>+{more}</Chip> : null}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

function Chip({
  palette,
  dot,
  children,
}: {
  palette: PlanPalette;
  dot?: string;
  children: ReactNode;
}) {
  return (
    <span
      className="flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px]"
      style={{ borderColor: palette.border, color: palette.muted }}
    >
      {dot ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
      ) : null}
      {children}
    </span>
  );
}

export function StartPlanning({
  onPickBoard,
  onPickSheet,
  onDashboard,
  onQuickStart,
  onTemplate,
  tabs,
  loadTabs,
  onSuggestedDashboard,
  onVisualisation,
}: {
  onPickBoard: (preset: string) => void;
  // Absent where sheets cannot be placed: Spreadsheets is left out.
  onPickSheet?: ((start?: PlacedSheetStart) => void) | undefined;
  // Absent where the tab cannot become a Dashboard: Dashboards is left out.
  onDashboard?: ((presetId: string) => void) | undefined;
  // Absent where there is no Quick Start: Something Else is left out.
  onQuickStart?: (() => void) | undefined;
  // Applies a Plan template to this tab (Inspiration); absent, Inspiration is left out.
  onTemplate?: ((kind: PlanTemplateKind) => void) | undefined;
  // The document's tabs, read for Dashboards built from its own work (suggested-dashboards.ts), and the fetch of
  // their content, asked for as the panel opens so every board is read.
  tabs?: readonly Tab[] | undefined;
  loadTabs?: (() => void) | undefined;
  onSuggestedDashboard?: ((s: SuggestedDashboard) => void) | undefined;
  // Makes the tab one chart filling the page (Visualisations); absent, Visualisations is left out.
  onVisualisation?: ((view: PlanVisualisation, name: string) => void) | undefined;
}) {
  const palette = planPalette(useCanvasSurface(), {});
  const plan = usePlan();
  const hasCards = (plan?.items.size ?? 0) > 0;
  // Fetched as the panel opens; the effect returns nothing (the fetch is a promise).
  useEffect(() => {
    void loadTabs?.();
  }, [loadTabs]);
  const suggestions = useMemo(
    () =>
      tabs && onDashboard && onSuggestedDashboard ? suggestedDashboards(tabs, plan?.types) : [],
    [tabs, plan?.types, onDashboard, onSuggestedDashboard],
  );
  const items = useMemo(
    () =>
      startItems({ hasCards, suggestions }).filter(
        (i) =>
          (i.kind !== 'sheet' || !!onPickSheet) &&
          (i.kind !== 'dashboard' || !!onDashboard) &&
          (i.kind !== 'template' || !!onTemplate) &&
          (i.kind !== 'visualisation' || !!onVisualisation),
      ),
    [hasCards, suggestions, onPickSheet, onDashboard, onTemplate, onVisualisation],
  );
  const categories = START_CATEGORIES.filter((c) => itemsIn(items, c.id).length > 0);
  const inspiration = categories.find((c) => c.id === 'inspiration');
  const [category, setCategory] = useState<StartCategory>('recommended');
  const [query, setQuery] = useState('');
  // Switched at least once: the cards cascade in on a change, never on the panel's first paint (motion.md).
  const [switched, setSwitched] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  // Ready to type into on a desktop (a fine pointer), so a letter typed finds a board rather than a canvas shortcut; a
  // phone's keyboard is not raised unasked.
  const search = useRef<HTMLInputElement>(null);
  // The grid's own scroll, back to its top as another category is chosen (it would open part way down otherwise).
  const gridScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches)
      search.current?.focus({ preventScroll: true });
  }, []);
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchStartItems(items, query), [items, query]);
  const choose = (item: StartItem) => {
    if (item.kind === 'board') onPickBoard(item.preset);
    else if (item.kind === 'sheet') onPickSheet?.(item.start ?? undefined);
    else if (item.kind === 'template') onTemplate?.(item.template);
    else if (item.kind === 'visualisation') onVisualisation?.(item.view, item.name);
    else if (item.suggestion) onSuggestedDashboard?.(item.suggestion);
    else if (item.layout) onDashboard?.(item.layout);
  };
  const pick = (next: StartCategory) => {
    setSwitched(true);
    setQuery('');
    setCategory(next);
    gridScroll.current?.scrollTo?.({ top: 0 });
    // On a phone the rail is a row of chips: the chosen one scrolls fully into view.
    rail.current?.parentElement
      ?.querySelector<HTMLElement>(`[data-rail="${next}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  // Up and Down move along the rail, choosing as they go.
  const onRailKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const at = categories.findIndex((c) => c.id === category);
    const next =
      categories[(at + (e.key === 'ArrowDown' ? 1 : -1) + categories.length) % categories.length]!;
    pick(next.id);
    rail.current?.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-rail="${next.id}"]`)
      ?.focus();
  };
  // A rail category's button.
  const railButton = (c: (typeof START_CATEGORIES)[number]) => {
    const Icon = RAIL_ICONS[c.id];
    const on = !searching && c.id === category;
    return (
      <button
        key={c.id}
        type="button"
        data-rail={c.id}
        aria-current={on ? 'true' : undefined}
        onClick={() => pick(c.id)}
        className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition duration-micro hover:bg-[var(--start-hover)] motion-reduce:transition-none"
        style={
          {
            backgroundColor: on ? tint(palette, 14) : undefined,
            color: on ? palette.focus : palette.text,
            '--start-hover': on ? tint(palette, 18) : tint(palette, 7),
          } as CSSProperties
        }
      >
        <Icon />
        <span className="flex-1 whitespace-nowrap">{c.name}</span>
        {/* How many it holds, as a badge (the shared CountBadge), tinted with the chosen category. */}
        <CountBadge
          count={itemsIn(items, c.id).length}
          className="max-sm:hidden"
          background={on ? tint(palette, 22) : palette.column}
          color={on ? palette.focus : palette.muted}
        />
      </button>
    );
  };
  const cascade = switched ? ' lvd-cascade' : '';
  const shown = START_CATEGORIES.find((c) => c.id === category)!;
  // One a row on a phone (each card a row of its own), two on a narrow panel, three on a wide one.
  const grid = 'grid grid-cols-1 gap-3 max-sm:gap-2 sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className="pointer-events-none absolute inset-0 z-[var(--z-panel)] flex items-center justify-center p-4 pb-28 pt-24 max-sm:px-2 max-sm:pt-32">
      <section
        aria-labelledby="start-planning-title"
        // One height whatever the category shows, so the panel never jumps as it changes.
        className="pointer-events-auto flex h-full max-h-[46rem] w-full max-w-5xl animate-fade-in flex-col overflow-hidden rounded-3xl border shadow-2xl max-sm:rounded-2xl"
        style={
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            color: palette.text,
            '--start-accent': palette.focus,
          } as CSSProperties
        }
      >
        <header
          // On a phone: the title and Help on one line, the search under them, the line left out for room.
          className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4 sm:px-6 max-sm:gap-y-2 max-sm:px-4 max-sm:py-3"
          style={{ borderColor: palette.border }}
        >
          <div className="min-w-0 flex-1">
            <h2
              id="start-planning-title"
              className="text-[20px] font-semibold tracking-tight max-sm:text-[18px]"
            >
              Start Planning
            </h2>
            <p className="mt-0.5 text-[13px] max-sm:hidden" style={{ color: palette.muted }}>
              Pick how to run the work. You can add more boards, sheets and dashboards later.
            </p>
          </div>
          <label
            className="flex h-9 w-full items-center gap-2 rounded-xl border px-3 transition focus-within:ring-2 focus-within:ring-[var(--start-accent)] max-sm:order-last sm:w-64"
            style={{
              borderColor: palette.border,
              backgroundColor: palette.surface,
              color: palette.muted,
            }}
          >
            <SearchGlyph />
            <input
              ref={search}
              aria-label="Find a board, sheet or layout"
              placeholder="Find a board, sheet or layout"
              value={query}
              onChange={(e) => {
                setSwitched(true);
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.stopPropagation();
                  setQuery('');
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: palette.text }}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full"
              >
                <ClearGlyph />
              </button>
            ) : null}
          </label>
          <HelpArticleLink article="planBoards" variant="icon" />
        </header>
        <div className="flex min-h-0 flex-1 max-sm:flex-col">
          <nav
            aria-label="Categories"
            className="flex shrink-0 gap-1 overflow-x-auto p-3 sm:w-52 sm:flex-col sm:overflow-visible sm:border-r sm:p-4 max-sm:border-b max-sm:px-2 max-sm:py-2 max-sm:[scrollbar-width:none]"
            style={{ borderColor: palette.border }}
          >
            <div ref={rail} className="contents" onKeyDown={onRailKey}>
              {categories.filter((c) => c.id !== 'inspiration').map(railButton)}
            </div>
            {/* Below a hairline: Inspiration, then Something Else, the ways in that bring a whole way of working. */}
            {inspiration || onQuickStart ? (
              <span
                aria-hidden
                className="my-2 h-px shrink-0 max-sm:hidden"
                style={{ backgroundColor: palette.border }}
              />
            ) : null}
            {inspiration ? (
              <div className="contents" onKeyDown={onRailKey}>
                {railButton(inspiration)}
              </div>
            ) : null}
            {onQuickStart ? (
              <>
                <button
                  type="button"
                  onClick={onQuickStart}
                  className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition duration-micro hover:bg-[var(--start-hover)] motion-reduce:transition-none"
                  style={
                    { color: palette.text, '--start-hover': tint(palette, 7) } as CSSProperties
                  }
                >
                  <TemplatesGlyph />
                  <span className="flex-1 whitespace-nowrap">Something Else</span>
                  <span style={{ color: palette.muted }}>
                    <OutGlyph />
                  </span>
                </button>
              </>
            ) : null}
          </nav>
          <div
            ref={gridScroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 max-sm:p-3"
          >
            {searching ? (
              results.length === 0 ? (
                // The shared empty state in the board's colours (docs/specs/004-interface-design/empty-states.md).
                <CompactEmptyState
                  role="status"
                  className="py-16"
                  ink={palette}
                  icon={<SearchIcon />}
                  title={noMatchTitle('boards, sheets or layouts', query)}
                  description={
                    onQuickStart
                      ? 'Try another word, or browse every template.'
                      : 'Try another word.'
                  }
                  action={
                    onQuickStart ? (
                      <button
                        type="button"
                        onClick={onQuickStart}
                        className="cursor-pointer rounded-xl border px-3 py-1.5 text-[13px] font-medium transition hover:border-[var(--start-accent)]"
                        style={{ borderColor: palette.border, color: palette.text }}
                      >
                        Browse More Templates
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                results.map((g) => (
                  <section
                    key={g.category}
                    aria-label={START_CATEGORIES.find((c) => c.id === g.category)!.name}
                    className="mb-6 last:mb-0"
                  >
                    <h3
                      className="mb-3 text-[12px] font-semibold uppercase tracking-wider"
                      style={{ color: palette.muted }}
                    >
                      {START_CATEGORIES.find((c) => c.id === g.category)!.name}
                    </h3>
                    <div className={`${grid}${cascade}`}>
                      {g.items.map((item) => (
                        <StartCard
                          key={item.id}
                          item={item}
                          palette={palette}
                          showKind={false}
                          onChoose={() => choose(item)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )
            ) : (
              <section key={category} aria-label={shown.name}>
                <h3 className="text-[16px] font-semibold">{shown.name}</h3>
                <p className="mb-4 mt-0.5 text-[13px] max-sm:mb-3" style={{ color: palette.muted }}>
                  {shown.line}
                </p>
                <div className={`${grid}${cascade}`}>
                  {itemsIn(items, category).map((item) => (
                    <StartCard
                      key={item.id}
                      item={item}
                      palette={palette}
                      showKind={category === 'recommended'}
                      onChoose={() => choose(item)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
