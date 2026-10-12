'use client';

// The start panel (docs/specs/026-plan/plan-mode.md "Starting a board", docs/specs/007-editor/start-diagramming.md):
// an empty tab's one wide panel. A rail of categories beside a grid of large cards, each a picture of what it makes
// over its name and line; a search across all of them. Choosing a card acts at once. Shared by Start Planning and
// Start Diagramming, which say what the categories and cards are; this draws them, in the tab's own light or dark look
// (the palette).
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  CompactEmptyState,
  CountBadge,
  SearchIcon,
  Tooltip,
  lucideGlyph,
  noMatchTitle,
  safeInset,
  useSheetDrag,
} from '@livediagram/ui';
import {
  lucideArrowUpRight,
  lucideSearch,
  lucideSparkles,
  lucideX,
} from '@livediagram/icons/lucide';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { HelpArticleKey } from '@/lib/help-articles';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { tint } from '@/components/plan/plan-card-parts';
import { takeStartQuery } from './start-query';
import { noteStartPanelLeft, startPanelJustLeft } from './start-panel-open';

const TemplatesGlyph = lucideGlyph(lucideSparkles, 16);
const OutGlyph = lucideGlyph(lucideArrowUpRight, 14);
const SearchGlyph = lucideGlyph(lucideSearch, 15);
const ClearGlyph = lucideGlyph(lucideX, 13);
const CloseGlyph = lucideGlyph(lucideX, 16);

type Glyph = ReturnType<typeof lucideGlyph>;

export type StartPanelCategory<C extends string> = {
  id: C;
  name: string;
  line: string;
  icon: Glyph;
  // Drawn below the rail's hairline, with the ways in that bring a whole way of working.
  below?: boolean;
};

export type StartPanelCard = {
  id: string;
  name: string;
  line: string;
  picture: ReactNode;
  // One badge at most, beside the name (a kind where kinds mix, For You).
  badge?: string;
  // A count on the right of the name row (a template's tabs).
  tag?: string;
  // What a screen reader hears after the name (its kind).
  ariaKind?: string;
  // Under the line (a board's card-type chips).
  footer?: ReactNode;
};

// The accent at a strength, as a Plan card's tints are (plan-card-parts).
const startTint = (palette: PlanPalette, pct: number) => tint(palette.focus, pct);

function StartCard({
  card,
  palette,
  onChoose,
}: {
  card: StartPanelCard;
  palette: PlanPalette;
  onChoose: () => void;
}) {
  return (
    // A cell of its own: the cascade moves the cell, the card keeps its hover lift.
    <div className="flex">
      <button
        type="button"
        data-start-card={card.id}
        onClick={onChoose}
        aria-label={`${card.name}${card.ariaKind ? ` ${card.ariaKind}` : ''}: ${card.line}`}
        // On a phone a row: the picture small at the left, the words beside it, so a screen holds several.
        className="group flex w-full cursor-pointer flex-col rounded-2xl border p-2 text-left max-sm:flex-row max-sm:items-center max-sm:gap-1 max-sm:rounded-xl transition duration-micro ease-out hover:-translate-y-0.5 hover:border-[var(--start-accent)] hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:border-[var(--start-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--start-accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        style={{ borderColor: palette.border, backgroundColor: palette.surface }}
      >
        {/* The picture, larger than it draws elsewhere, on a soft panel of the board's column colour. */}
        <span
          className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl p-3 max-sm:h-[4.5rem] max-sm:w-24 max-sm:shrink-0 max-sm:rounded-lg max-sm:p-1.5 [&>*]:!h-full"
          style={{ backgroundColor: palette.column }}
        >
          {card.picture}
        </span>
        <span className="flex min-w-0 flex-col gap-1 px-1.5 pb-1 pt-2.5 max-sm:flex-1 max-sm:py-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold" style={{ color: palette.text }}>
              {card.name}
            </span>
            {card.badge ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: startTint(palette, 14), color: palette.focus }}
              >
                {card.badge}
              </span>
            ) : null}
            {card.tag ? (
              <span
                className="ml-auto shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold tabular-nums"
                style={{ borderColor: palette.border, color: palette.muted }}
              >
                {card.tag}
              </span>
            ) : null}
          </span>
          <span
            // In full: a card's line is short, and cut it misleads (on a phone, two lines at most beside the picture).
            className="text-[12.5px] leading-snug max-sm:line-clamp-2"
            style={{ color: palette.muted }}
          >
            {card.line}
          </span>
          {card.footer ? <span className="max-sm:hidden">{card.footer}</span> : null}
        </span>
      </button>
    </div>
  );
}

export function StartPanel<C extends string>({
  titleId,
  title,
  line,
  searchLabel,
  noMatchNoun,
  helpArticle,
  palette,
  categories,
  initialCategory,
  cardsIn,
  search,
  onChoose,
  onQuickStart,
  onClose,
  lead,
}: {
  titleId: string;
  title: string;
  line: string;
  // The search box's label and placeholder.
  searchLabel: string;
  // What a search that finds nothing found no match among ("boards, sheets or layouts").
  noMatchNoun: string;
  helpArticle: HelpArticleKey;
  palette: PlanPalette;
  // Only the categories holding cards.
  categories: readonly StartPanelCategory<C>[];
  initialCategory: C;
  cardsIn: (category: C) => readonly StartPanelCard[];
  // Every match, grouped by category, in rail order.
  search: (query: string) => readonly { category: C; cards: readonly StartPanelCard[] }[];
  onChoose: (cardId: string) => void;
  // Absent where there is no Quick Start: Something Else is left out.
  onQuickStart?: (() => void) | undefined;
  // Absent where the panel cannot be closed: no × in its header.
  onClose?: (() => void) | undefined;
  // Leading the rail, over a hairline: the mode switch.
  lead?: ReactNode;
}) {
  // Another start panel was on screen a moment ago: the tab changed mode under it. The frame stays put (no fly-up) and
  // its content arrives whole, nothing fading up from nothing or cascading in, so a mode change never blinks; the
  // switch crossfades the two (StartModeSwitch's View Transition). `calm` lasts until the category or search changes.
  const [swapped] = useState(() => startPanelJustLeft());
  const [calm, setCalm] = useState(swapped);
  useEffect(() => () => noteStartPanelLeft(), []);
  const [category, setCategory] = useState<C>(initialCategory);
  // A search handed over by /new?q= (start-query.ts), else none.
  const [query, setQuery] = useState(() => takeStartQuery());
  const rail = useRef<HTMLDivElement>(null);
  // Ready to type into on a desktop (a fine pointer), so a letter typed finds a card rather than a canvas shortcut; a
  // phone's keyboard is not raised unasked.
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches)
      searchInput.current?.focus({ preventScroll: true });
  }, []);
  // On a phone the panel is a sheet risen from the bottom edge; one that can close drags down to close (Dialog's
  // phoneSheet, BottomSheet).
  const sheet = useSheetDrag(onClose ?? (() => {}));
  const searching = query.trim().length > 0;
  const results = searching ? search(query) : [];
  const nameOf = (id: C) => categories.find((c) => c.id === id)?.name ?? id;
  // The cards' scroller: a category picked opens at its top, never part way down the last one's cards.
  const cardsScroller = useRef<HTMLDivElement>(null);
  const pick = (next: C) => {
    setCalm(false);
    setQuery('');
    setCategory(next);
    if (cardsScroller.current) cardsScroller.current.scrollTop = 0;
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
  const railButton = (c: StartPanelCategory<C>) => {
    const Icon = c.icon;
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
            backgroundColor: on ? startTint(palette, 14) : undefined,
            color: on ? palette.focus : palette.text,
            '--start-hover': on ? startTint(palette, 18) : startTint(palette, 7),
          } as CSSProperties
        }
      >
        {/* The glyph and count keep their size; a long name wraps beside them on a wide rail (a phone's rail scrolls
            across, one line each). */}
        <span className="shrink-0">
          <Icon />
        </span>
        <span className="min-w-0 flex-1 whitespace-nowrap leading-snug sm:whitespace-normal">
          {c.name}
        </span>
        {/* How many it holds, as a badge (the shared CountBadge), tinted with the chosen category. */}
        <CountBadge
          count={cardsIn(c.id).length}
          className="shrink-0 max-sm:hidden"
          background={on ? startTint(palette, 22) : palette.column}
          color={on ? palette.focus : palette.muted}
        />
      </button>
    );
  };
  const above = categories.filter((c) => !c.below);
  const below = categories.filter((c) => c.below);
  // The cards cascade in as the panel arrives, and again each time the category or search changes them (the
  // grid is keyed by what it shows, so a change remounts it).
  const cascade = calm ? '' : ' lvd-cascade';
  const shown = categories.find((c) => c.id === category) ?? categories[0]!;
  // One a row on a phone (each card a row of its own), two on a narrow panel, three on a wide one.
  const grid = 'grid grid-cols-1 gap-3 max-sm:gap-2 sm:grid-cols-2 lg:grid-cols-3';
  const cards = (list: readonly StartPanelCard[]) => (
    <div className={`${grid}${cascade}`}>
      {list.map((card) => (
        <StartCard key={card.id} card={card} palette={palette} onChoose={() => onChoose(card.id)} />
      ))}
    </div>
  );
  return (
    // Clear of the top chrome (the menu button and the palette strip, 8.5rem down) and the bottom clusters. On a phone,
    // over the tab bar and docked to the bottom edge below the top bar, as the phone's sheets are.
    <div className="pointer-events-none absolute inset-0 z-[var(--z-panel)] flex items-center justify-center p-4 pb-28 pt-[8.5rem] max-sm:z-[var(--z-overlay)] max-sm:items-end max-sm:px-0 max-sm:pb-0 max-sm:pt-20">
      <section
        aria-labelledby={titleId}
        // One height whatever the category shows, so the panel never jumps as it changes.
        className={`pointer-events-auto flex h-full max-h-[46rem] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl max-sm:max-h-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-b-0 ${
          swapped ? '' : 'animate-dialog-in max-sm:animate-sheet-up'
        }`}
        style={
          {
            ...sheet.style,
            paddingBottom: safeInset('bottom'),
            backgroundColor: palette.card,
            borderColor: palette.border,
            color: palette.text,
            '--start-accent': palette.focus,
          } as CSSProperties
        }
      >
        {/* The grab handle, phone only, as every phone sheet has: the full width of the sheet, 24px tall
            (BottomSheet's). Dragged down it closes a panel that can close; one that cannot settles back. */}
        <div
          aria-hidden
          data-sheet-handle=""
          {...sheet.handleProps}
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
        >
          <span className="h-1 w-10 rounded-full" style={{ backgroundColor: palette.border }} />
        </div>
        <header
          // Room on the right for the help and × pinned in the corner.
          className="relative flex flex-wrap items-center gap-x-4 gap-y-3 border-b py-4 pl-5 pr-24 sm:pl-6 max-sm:pt-1"
          style={{ borderColor: palette.border }}
        >
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[20px] font-semibold tracking-tight max-sm:text-[18px]"
            >
              {title}
            </h2>
            {/* On a phone the line is left out, for room. */}
            <p className="mt-0.5 text-[13px] max-sm:hidden" style={{ color: palette.muted }}>
              {line}
            </p>
          </div>
          <label
            // On a phone the search takes its own row under the title, the help and × staying beside the title.
            className="flex h-9 w-full items-center gap-2 rounded-xl border px-3 transition focus-within:ring-2 focus-within:ring-[var(--start-accent)] max-sm:order-last sm:w-64"
            style={{
              borderColor: palette.border,
              backgroundColor: palette.surface,
              color: palette.muted,
            }}
          >
            <SearchGlyph />
            <input
              ref={searchInput}
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={query}
              onChange={(e) => {
                setCalm(false);
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
          {/* Help and ×, pinned to the panel's top right corner. */}
          <div className="absolute right-3 top-3 flex items-center gap-1 max-sm:top-0">
            <HelpArticleLink article={helpArticle} variant="icon" />
            {onClose ? (
              <Tooltip label="Close">
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[var(--start-hover)]"
                  style={
                    {
                      color: palette.muted,
                      '--start-hover': startTint(palette, 7),
                    } as CSSProperties
                  }
                >
                  <CloseGlyph />
                </button>
              </Tooltip>
            ) : null}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 max-sm:flex-col">
          {/* The rail, led by the mode switch over a hairline. On a phone the switch is its own row over the rail's. */}
          <div
            className="flex shrink-0 flex-col max-sm:contents sm:w-60 sm:border-r"
            style={{ borderColor: palette.border }}
          >
            {lead ? (
              <div className="shrink-0 border-b" style={{ borderColor: palette.border }}>
                {lead}
              </div>
            ) : null}
            <nav
              aria-label="Categories"
              className="flex shrink-0 gap-1 overflow-x-auto p-3 sm:min-h-0 sm:flex-1 sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden sm:p-4 max-sm:border-b max-sm:px-2 max-sm:py-2 max-sm:[scrollbar-width:none]"
              style={{ borderColor: palette.border }}
            >
              <div
                ref={rail}
                className={swapped ? 'contents' : 'contents lvd-cascade'}
                onKeyDown={onRailKey}
              >
                {above.map(railButton)}
              </div>
              {/* Below a hairline: the ways in that bring a whole way of working, then Something Else. */}
              {below.length || onQuickStart ? (
                <span
                  aria-hidden
                  className="my-2 h-px shrink-0 max-sm:hidden"
                  style={{ backgroundColor: palette.border }}
                />
              ) : null}
              {below.length ? (
                <div className="contents" onKeyDown={onRailKey}>
                  {below.map(railButton)}
                </div>
              ) : null}
              {onQuickStart ? (
                <button
                  type="button"
                  onClick={onQuickStart}
                  className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition duration-micro hover:bg-[var(--start-hover)] motion-reduce:transition-none"
                  style={
                    { color: palette.text, '--start-hover': startTint(palette, 7) } as CSSProperties
                  }
                >
                  <TemplatesGlyph />
                  <span className="flex-1 whitespace-nowrap">Something Else</span>
                  <span style={{ color: palette.muted }}>
                    <OutGlyph />
                  </span>
                </button>
              ) : null}
            </nav>
          </div>
          <div
            ref={cardsScroller}
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
                  title={noMatchTitle(noMatchNoun, query)}
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
                    aria-label={nameOf(g.category)}
                    className="mb-6 last:mb-0"
                  >
                    <h3
                      className="mb-3 text-[12px] font-semibold uppercase tracking-wider"
                      style={{ color: palette.muted }}
                    >
                      {nameOf(g.category)}
                    </h3>
                    {cards(g.cards)}
                  </section>
                ))
              )
            ) : (
              <section key={shown.id} aria-label={shown.name}>
                <h3 className="text-[16px] font-semibold">{shown.name}</h3>
                <p className="mb-4 mt-0.5 text-[13px] max-sm:mb-3" style={{ color: palette.muted }}>
                  {shown.line}
                </p>
                {cards(cardsIn(shown.id))}
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
