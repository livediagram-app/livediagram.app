'use client';

// The start panel every editor draws (docs/specs/007-editor/ in each: start-diagramming.md, start-panel.md in a
// planner): an empty tab's one wide panel. A rail of categories beside a grid of large cards, each a picture of what
// it makes over its name and line; a search across all of them, and, where the editor has modes, across every other
// mode's templates. Choosing a card acts at once. The editor's start says what the categories and cards are; this
// draws them, in the tab's own light or dark look (the palette).
//
// Each editor binds it once (`createStartPanel(config)` in its components/start/StartPanel.tsx) with what it draws
// in its own way: its card grid and tint, its help link, the chosen row's ink, the other modes' block, whether the
// panel is a phone sheet with a grab handle. The component it returns is the editor's StartPanel itself, so the tree
// under it is the one the editor drew before.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  CompactEmptyState,
  CountBadge,
  SearchIcon,
  Tooltip,
  lucideGlyph,
  noMatchTitle,
  safeInset,
  SheetHandle,
  useSheetDrag,
} from '@liveworkspace/ui';
import { lucideSearch, lucideX } from '@liveworkspace/icons/lucide';
import { useChromeFloor } from '../toast/useToastFloor';
import { ConnectRailEntry } from '../connect/ConnectRailEntry';
import { usePalettePopoverOpen } from '../../lib/palette-popover-open';
import { focusIsFree } from '../../lib/focus-is-free';
import { liftBestMatch } from './best-match';
import { RailFoot, RailFootButton, type RailFootColours } from './RailFoot';
import { isStartCardKey, nextCardIndex } from './start-card-keys';
import { noteStartPanelLeft, startPanelJustLeft } from './start-panel-open';
import { takeStartQuery } from './start-query';
import { StartHeaderBand } from './StartHeaderBand';
import { StartTitleMark } from './StartTitleMark';
import { useStartHeaderTheme } from './useStartHeaderTheme';
import type {
  StartPanelCardBase,
  StartPanelCategory,
  StartPanelConfig,
  StartPanelPaletteBase,
  StartPanelProps,
  StartPanelResult,
} from './start-panel-types';

export type {
  StartPanelCardBase,
  StartPanelCategory,
  StartPanelConfig,
  StartPanelFootAction,
  StartPanelPaletteBase,
  StartPanelProps,
  StartPanelResult,
} from './start-panel-types';

const TAB_BAR_SELECTOR = '[data-editor-tabbar]';

const SearchGlyph = lucideGlyph(lucideSearch, 15);
const ClearGlyph = lucideGlyph(lucideX, 13);
const CloseGlyph = lucideGlyph(lucideX, 16);

// The chosen rail row's tint and its hover, as strengths of the accent.
const CHOSEN_TINT = 14;
const CHOSEN_HOVER_TINT = 18;

// A panel that cannot close: a drag down on its phone sheet is refused before it slides out, so it settles back.
const STAYS_OPEN = () => false;

// A panel that is never a sheet calls no sheet hook.
function useNoSheet(_onDismiss: () => void, _open?: boolean, _before?: () => boolean): null {
  return null;
}

export function createStartPanel<
  P extends StartPanelPaletteBase,
  K extends StartPanelCardBase,
  H,
  G = never,
  M = never,
>(config: StartPanelConfig<P, K, H, G, M>) {
  const { app, HelpLink, CardGrid, tint: startTint, OtherModes, sheet: isSheet } = config;
  const useSheet = isSheet ? useSheetDrag : useNoSheet;
  const inkOf = config.chosenInk;
  // The chosen row's label: the accent, darkened as far as it needs to read at AA on its tint, where the editor
  // does; else the accent as it is.
  const useChosenInk = inkOf
    ? function useChosenLabel(palette: P) {
        return useMemo(() => inkOf(palette), [palette]);
      }
    : function useAccentLabel(palette: P) {
        return palette.focus;
      };

  return function StartPanel<C extends string>({
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
    countIn,
    search,
    onChoose,
    elsewhere,
    onChooseElsewhere,
    onClose,
    lead,
    footer,
    connect,
    footActions = [],
    footLead = [],
  }: StartPanelProps<C, P, K, H, G, M>) {
    // A category's flyout, More or Search hangs from the palette: the start steps aside for it (palette-popover-open).
    const paletteOpen = usePalettePopoverOpen();
    // The header wears this app's Explorer hero backdrop, in the panel's own colours (start-diagramming.md "The
    // header band").
    const header = useStartHeaderTheme(app, palette);
    // Another start panel was on screen a moment ago: the tab changed under it (a mode change, or one empty tab for
    // another). The frame stays put (no fly-up) and its content arrives whole, nothing fading up from nothing or
    // cascading in, so the change never blinks. `calm` lasts until the category or search changes.
    const [swapped] = useState(() => startPanelJustLeft());
    const [calm, setCalm] = useState(swapped);
    useEffect(() => () => noteStartPanelLeft(), []);
    const [category, setCategory] = useState<C>(initialCategory);
    // Connect File chosen in the rail: its list stands in the cards' place until a category is picked.
    const [connecting, setConnecting] = useState(false);
    // A search handed over by /new?q= (start-query.ts), else none.
    const [query, setQuery] = useState(() => takeStartQuery());
    const rail = useRef<HTMLDivElement>(null);
    // Ready to type into on a desktop (a fine pointer), so a letter typed finds a card rather than a canvas
    // shortcut; a phone's keyboard is not raised unasked. Only while focus is free: the panel's code loads when it is
    // first drawn, so on a busy machine it can arrive after a menu was opened from the keyboard, and it never takes
    // focus from one.
    const searchInput = useRef<HTMLInputElement>(null);
    useEffect(() => {
      if (window.matchMedia?.('(pointer: fine)').matches && focusIsFree())
        searchInput.current?.focus({ preventScroll: true });
    }, []);
    // On a phone the panel is a sheet risen from the bottom edge; one that can close drags down to close (Dialog's
    // phoneSheet, BottomSheet), one that cannot settles back.
    const sheet = useSheet(onClose ?? STAYS_OPEN, true, onClose ? undefined : STAYS_OPEN);
    // Where the tab bar stands, for the phone and short-window sheet to stand on (useChromeFloor, as toasts do).
    const tabBarFloor = useChromeFloor(true, 0, TAB_BAR_SELECTOR);
    const searching = query.trim().length > 0;
    // A title match leads, under Best Match, lifted out of its group (start-diagramming.md "A title match leads").
    const { best, groups: results } = searching
      ? liftBestMatch<K, StartPanelResult<C, K>>(search(query), query)
      : { best: [], groups: [] };
    const others = searching && elsewhere && onChooseElsewhere ? elsewhere(query) : [];
    const nameOf = (id: C) => categories.find((c) => c.id === id)?.name ?? id;
    // The cards' scroller: a category picked opens at its top, never part way down the last one's cards.
    const cardsScroller = useRef<HTMLDivElement>(null);
    const pick = (next: C) => {
      setCalm(false);
      setQuery('');
      setConnecting(false);
      setCategory(next);
      // The scroller is drawn with the rail, so it is there whenever the rail is clicked.
      cardsScroller.current!.scrollTop = 0;
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
        categories[
          (at + (e.key === 'ArrowDown' ? 1 : -1) + categories.length) % categories.length
        ]!;
      pick(next.id);
      rail.current?.parentElement
        ?.querySelector<HTMLButtonElement>(`[data-rail="${next.id}"]`)
        ?.focus();
    };
    const chosenInk = useChosenInk(palette);
    const railButton = (c: StartPanelCategory<C>) => {
      const Icon = c.icon;
      const on = !searching && !connecting && c.id === category;
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
              backgroundColor: on ? startTint(palette, CHOSEN_TINT) : undefined,
              color: on ? chosenInk : palette.text,
              '--start-hover': on ? startTint(palette, CHOSEN_HOVER_TINT) : startTint(palette, 7),
            } as CSSProperties
          }
        >
          {/* The glyph and count keep their size; a long name wraps beside them on a wide rail (a phone's rail
              scrolls across, one line each). */}
          <span className="shrink-0">
            <Icon />
          </span>
          <span className="min-w-0 flex-1 whitespace-nowrap leading-snug sm:whitespace-normal">
            {c.name}
          </span>
          {/* How many it holds, as a badge (the shared CountBadge), tinted with the chosen category. */}
          <CountBadge
            count={countIn ? countIn(c.id) : cardsIn(c.id).length}
            className="shrink-0 max-sm:hidden"
            background={on ? startTint(palette, 22) : palette.column}
            color={on ? palette.text : palette.muted}
          />
        </button>
      );
    };
    const above = categories.filter((c) => !c.below);
    const below = categories.filter((c) => c.below);
    // The foot's rows wear the rail's own colours.
    const footColours: RailFootColours = {
      text: palette.text,
      border: palette.border,
      card: palette.card,
      chosenText: chosenInk,
      chosenTint: startTint(palette, CHOSEN_TINT),
      hoverTint: startTint(palette, 7),
      chosenHoverTint: startTint(palette, CHOSEN_HOVER_TINT),
    };
    // Each a row like Connect File's, a rail gap between it and the one after it on a desktop.
    const leadRows = footLead.map((a, i) => (
      <RailFootButton
        key={a.id}
        railId={a.id}
        onPick={a.onPick}
        colours={footColours}
        icon={<span className="shrink-0">{a.icon}</span>}
        name={a.name}
        opensDialog
        className={i > 0 ? 'sm:mt-1' : ''}
      />
    ));
    const leadBefore = leadRows.length > 0;
    // Each a row like Connect File's, a rail gap under the one before it on a desktop.
    const footRows = footActions.map((a, i) => (
      <RailFootButton
        key={a.id}
        railId={a.id}
        onPick={a.onPick}
        colours={footColours}
        icon={<span className="shrink-0">{a.icon}</span>}
        name={a.name}
        opensDialog
        className={connect || leadBefore || i > 0 ? 'sm:mt-1' : ''}
      />
    ));
    // The cards cascade in as the panel arrives, and again each time the category or search changes them (the
    // grid is keyed by what it shows, so a change remounts it).
    const shown = categories.find((c) => c.id === category) ?? categories[0]!;
    const cards = (list: readonly K[]) => (
      <CardGrid cards={list} palette={palette} cascade={!calm} onChoose={onChoose} />
    );
    // The arrow keys move among the cards, Up from the first row back to the search (start-card-keys.ts).
    const onCardsKey = (e: KeyboardEvent<HTMLDivElement>) => {
      if (!isStartCardKey(e.key) || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // The keys are the scroller's own, so it is there.
      const all = [...cardsScroller.current!.querySelectorAll<HTMLElement>('[data-start-card]')];
      const from = all.indexOf(e.target as HTMLElement);
      if (from < 0) return;
      const to = nextCardIndex(
        e.key,
        from,
        all.map((el) => el.getBoundingClientRect()),
      );
      if (to === null) {
        if (e.key === 'ArrowUp' && searching) {
          e.preventDefault();
          searchInput.current?.focus();
        }
        return;
      }
      e.preventDefault();
      all[to]!.focus();
      all[to]!.scrollIntoView?.({ block: 'nearest' });
    };
    const section = (key: string, name: string, list: readonly K[]) => (
      <section key={key} aria-label={name} className="mb-6 last:mb-0">
        <h3
          className="mb-3 text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: palette.muted }}
        >
          {name}
        </h3>
        {cards(list)}
      </section>
    );
    return (
      // Clear of the top chrome (the menu button and the palette strip, 8.5rem down) and the bottom clusters. On a
      // phone, a sheet below the top bar standing on the tab bar. On a short window (a phone held sideways, 390px tall
      // with its bars folded, or a desktop zoomed to 200%, 450px) those two clearances left the list 56px to 96px:
      // there it clears only the strip and lies over the bottom cluster, clear of the home indicator, the one place it
      // still meets the bottom edge.
      <div
        // While a palette popover hangs from the strip the start steps aside, mounted so its search and group are
        // kept (start-diagramming.md "When it shows"). On its own root, never a wrapper: the start's View Transition
        // names this element, and a `display: contents` wrapper has no box to picture.
        data-start-stepped-aside={paletteOpen || undefined}
        className={`${paletteOpen ? 'hidden' : 'flex'} pointer-events-none absolute inset-0 z-[var(--z-panel)] items-center justify-center p-4 pb-28 pt-[8.5rem] max-sm:z-[var(--z-overlay)] max-sm:items-end max-sm:px-0 max-sm:pb-[calc(var(--start-floor)-8px)] max-sm:pt-20 short-window:z-[var(--z-overlay)] short-window:pb-[var(--start-floor)] short-window:pt-16`}
        // On a phone, and on a short window, the sheet stands on the tab bar while it shows (measured as the toast
        // stack measures its floor; a sideways phone folds its bars away), so the tabs stay in reach: a start that
        // cannot close, over the bar, left a new tab no way back to the others but a template. Flush on a phone.
        style={{ '--start-floor': `${tabBarFloor}px` } as CSSProperties}
      >
        <section
          aria-labelledby={titleId}
          // Escape closes a start that can close, as its × does, once the search has nothing to clear (the search
          // box takes the first Escape) and outside an open menu (the mode menu's Escape closes only the menu).
          onKeyDown={(e) => {
            if (e.key !== 'Escape' || !onClose || e.defaultPrevented) return;
            if ((e.target as HTMLElement).closest?.('[role="menu"]')) return;
            e.stopPropagation();
            onClose();
          }}
          // One height whatever the category shows, so the panel never jumps as it changes.
          className={`pointer-events-auto flex h-full max-h-[46rem] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl max-sm:max-h-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-b-0 short-window:pb-[var(--start-inset)] ${
            swapped ? '' : 'animate-dialog-in max-sm:animate-sheet-up'
          }`}
          style={
            {
              ...sheet?.style,
              '--start-inset': safeInset('bottom'),
              backgroundColor: palette.card,
              borderColor: palette.border,
              color: palette.text,
              '--start-accent': palette.focus,
            } as CSSProperties
          }
        >
          {/* The grab handle, phone only, as every phone sheet has (BottomSheet's). Dragged down it closes a panel
              that can close; one that cannot settles back. */}
          {sheet ? (
            <SheetHandle
              handleProps={sheet.handleProps}
              className="relative z-10 sm:hidden"
              pillColor={palette.border}
            />
          ) : null}
          <header
            // Room on the right for the help and × pinned in the corner. On a phone only the title's row needs it: the
            // search below runs the full width, so a long placeholder ("Find a board, sheet, form or layout") fits.
            // From `sm` it stands 100px tall, its row centred, so the band shows.
            className={
              isSheet
                ? 'relative isolate flex flex-wrap content-center items-center gap-x-4 gap-y-3 border-b py-4 pl-5 pr-24 sm:min-h-[100px] sm:pl-6 max-sm:pr-5 max-sm:pt-1'
                : 'relative isolate flex flex-wrap content-center items-center gap-x-4 gap-y-3 border-b py-4 pl-5 pr-14 sm:min-h-[100px] sm:pl-6 max-sm:pr-5'
            }
            style={{ borderColor: palette.border }}
          >
            <StartHeaderBand
              kind={header.kind}
              band={header.band}
              underHandle={isSheet || undefined}
            />
            {/* The title mark, the app's motif as one glyph, then the title and its line. */}
            <div
              className={`flex min-w-0 flex-1 items-center gap-3 ${isSheet ? 'max-sm:pr-20' : 'max-sm:pr-10'}`}
            >
              <StartTitleMark kind={header.kind} band={header.band} />
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className={`text-[20px] leading-tight max-sm:text-[18px] ${header.face}`}
                >
                  {title}
                </h2>
                {/* On a phone the line is left out, for room. From `xl` it wraps short of the gap piece, so the two
                    never meet (its start spec, "Where the pieces show"). */}
                <p
                  className="mt-0.5 text-[13px] max-sm:hidden xl:max-w-[30rem]"
                  style={{ color: header.band.muted }}
                >
                  {line}
                </p>
              </div>
            </div>
            <label
              // On a phone the search takes its own row under the title, the help and × staying beside the title.
              className="flex h-9 w-full items-center gap-2 rounded-xl border px-3 shadow-sm transition focus-within:ring-2 focus-within:ring-[var(--start-accent)] max-sm:order-last sm:w-68"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
                color: palette.muted,
              }}
            >
              <SearchGlyph />
              <input
                ref={searchInput}
                data-editor-history=""
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
                  // Down moves to the first card the search found (its own, else another mode's).
                  if (e.key === 'ArrowDown' && searching) {
                    const first =
                      cardsScroller.current?.querySelector<HTMLElement>('[data-start-card]');
                    if (first) {
                      e.preventDefault();
                      first.focus();
                    }
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
            <div
              className={
                isSheet
                  ? 'absolute right-3 top-3 flex items-center gap-1 max-sm:top-0'
                  : 'absolute right-3 top-3 flex items-center'
              }
            >
              <HelpLink article={helpArticle} variant="icon" />
              {onClose ? (
                <Tooltip label="Close">
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[var(--start-hover)]"
                    style={
                      {
                        color: header.band.muted,
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
            {/* The rail, led by the mode switch over a hairline where there is one. On a phone the switch is its own
                row over the rail's. */}
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
                {/* Below a hairline: the ways in that bring a whole way of working. */}
                {below.length ? (
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
                {connect ? (
                  <ConnectRailEntry
                    on={!searching && connecting}
                    onPick={() => {
                      setCalm(false);
                      setQuery('');
                      setConnecting(true);
                      cardsScroller.current!.scrollTop = 0;
                    }}
                    colours={footColours}
                    lead={leadBefore ? leadRows : undefined}
                  >
                    {footRows}
                  </ConnectRailEntry>
                ) : footRows.length || leadBefore ? (
                  <RailFoot colours={footColours}>
                    {leadRows}
                    {footRows}
                  </RailFoot>
                ) : null}
              </nav>
            </div>
            <div
              ref={cardsScroller}
              onKeyDown={onCardsKey}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 max-sm:p-3"
            >
              {searching ? (
                best.length === 0 && results.length === 0 && others.length === 0 ? (
                  // The shared empty state in the panel's colours (docs/specs/004-interface-design/empty-states.md).
                  <CompactEmptyState
                    role="status"
                    className="py-16"
                    ink={palette}
                    icon={<SearchIcon />}
                    title={noMatchTitle(noMatchNoun, query)}
                    description="Try another word."
                  />
                ) : (
                  <>
                    {best.length === 0 && results.length === 0 ? (
                      // Nothing of this mode, something of another's: one line, then the other modes' blocks.
                      <p
                        role="status"
                        className="mb-5 flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px]"
                        style={{ backgroundColor: palette.column }}
                      >
                        <span
                          aria-hidden
                          className="mt-px shrink-0"
                          style={{ color: palette.muted }}
                        >
                          <SearchGlyph />
                        </span>
                        <span>
                          <span className="font-semibold">{noMatchTitle(noMatchNoun, query)}.</span>{' '}
                          <span style={{ color: palette.muted }}>Found in other modes.</span>
                        </span>
                      </p>
                    ) : (
                      <>
                        {best.length > 0 ? section('best-match', 'Best Match', best) : null}
                        {results.map((g) =>
                          section(g.category, g.name ?? nameOf(g.category), g.cards),
                        )}
                      </>
                    )}
                    {others.length && onChooseElsewhere && OtherModes ? (
                      <OtherModes
                        // A new search starts folded.
                        key={query.trim().toLowerCase()}
                        groups={others}
                        palette={palette}
                        divided={best.length + results.length > 0}
                        cascade={!calm}
                        onChoose={onChooseElsewhere}
                      />
                    ) : null}
                  </>
                )
              ) : connect && connecting ? (
                connect(palette)
              ) : (
                <section key={shown.id} aria-label={shown.name}>
                  <h3 className="text-[16px] font-semibold">{shown.name}</h3>
                  <p
                    className="mb-4 mt-0.5 text-[13px] max-sm:mb-3"
                    style={{ color: palette.muted }}
                  >
                    {shown.line}
                  </p>
                  {cards(cardsIn(shown.id))}
                </section>
              )}
            </div>
          </div>
          {footer ? (
            <footer
              // The new version prompt stands above it on a phone (start-panel-open.ts START_FOOTER_SELECTOR).
              data-start-footer=""
              className={
                config.hideEmptyFooter
                  ? 'shrink-0 border-t px-4 py-1.5 empty:hidden sm:px-6'
                  : 'shrink-0 border-t px-4 py-1.5 sm:px-6'
              }
              style={{ borderColor: palette.border }}
            >
              {footer(palette)}
            </footer>
          ) : null}
        </section>
      </div>
    );
  };
}
