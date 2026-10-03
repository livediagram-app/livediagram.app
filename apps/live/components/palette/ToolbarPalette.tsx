'use client';

import {
  Fragment,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronDownIcon, EllipsisIcon, HoverCard } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { loadPaletteFavourites } from '@/lib/palette-favourites';
import { SnapWidth } from '@/components/primitives/SnapWidth';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { safeInlinePadding } from '@/lib/safe-area';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from './palette-group-state';
import { PaletteDropdown, TOOLBAR_TRIGGER_TONE } from './PaletteDropdown';
import { CATEGORY_BANDS } from './PaletteTabBar';
import { EsPhotoStripButton } from './EsPhotoStripButton';
import { PaletteTile } from './PaletteTileGrid';
import { PALETTE_TILES } from './palette-tile-defs';
import { desktopStripTileLimit, phoneStripTileLimit, stripTilesFor } from './toolbar-strip-tiles';
import { useStripTileLimit } from './useStripTileLimit';
import { useViewportWidth } from '@/hooks/ui/useViewportWidth';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle, uiUnscaleStyle } from '@/lib/ui-scale';
import { RAIL_LEAVE_MS, ToolbarStripRail } from './ToolbarStripRail';
import { usePaletteCatalogue } from './usePaletteCatalogue';
import { paletteLandingCategory } from './palette-mode-categories';
import type { CommandPaletteProps } from './CommandPalette.types';
import type { PaletteAddHandlers } from './palette-add-handlers';

// The Toolbar layout's Palette (docs/specs/007-editor/toolbar-layout.md): one horizontal strip pinned to the
// top centre of the canvas, the way Excalidraw's tool bar works. Selection
// mode on the left, then the category picker, then that category's first
// tiles, and a More popover holding the category's full Palette body for
// everything that doesn't fit.
//
// Same tiles, same handlers, same category bodies as the floating Palette:
// usePaletteCatalogue builds them for both, so this file is only layout.

type Props = Pick<
  CommandPaletteProps,
  | 'canvasTool'
  | 'onSetCanvasTool'
  | 'onExitAvatarMode'
  | 'onToggleZen'
  | 'canvasEmpty'
  | 'pendingDraw'
  | 'esBoard'
  | 'esBoardControls'
  | 'themeTint'
> &
  PaletteAddHandlers & {
    // The chrome is hidden (zen, the welcome flow). Hidden rather than
    // unmounted, so the strip keeps its state for the page load.
    hidden?: boolean;
    // Its own card at the far left of the strip's row, the strip beside it: the
    // Explorer menu button and mode switch on a phone, which has no room for
    // them in a corner card above the strip.
    leading?: ReactNode;
  };
// Clicks inside these don't count as "outside" the More popover: the icon
// filter's portalled dropdown menus, and the Edit Favourites dialog that the
// Favourites body opens (closing the popover would unmount it mid-edit).
const INSIDE_SELECTOR = '[data-palette-dropdown-menu], [role="dialog"], [data-tour-popover]';

// The strip's card, and the leading card beside it on a phone.
const CARD_CLASS = `flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 ${PHONE_TOOLBAR_ITEMS}`;

// With a leading card (a phone), the menu card sits at the left gutter and the
// strip beside it rather than centred (docs/specs/007-editor/toolbar-layout.md
// "On a phone"). Without one, the strip alone, centred by its parent.
function StripRow({
  leading,
  leadingRef,
  children,
}: {
  leading?: ReactNode;
  leadingRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  if (!leading) return <>{children}</>;
  return (
    <div
      // 12px gutters, or a landscape notch's inset where that is bigger (lib/safe-area).
      style={safeInlinePadding('0.75rem')}
      className="pointer-events-none flex w-full items-start gap-2 [&>*]:pointer-events-auto"
    >
      <div ref={leadingRef} data-strip-leading="" className={CARD_CLASS}>
        {leading}
      </div>
      {children}
    </div>
  );
}

// Centred alone (desktop), the card is whole-pixel wide with the canvas's
// parity (see SnapWidth). Beside the menu card (a phone) it is left-aligned
// and may shrink to the row, its rail scrolling, so it is not snapped there.
function CardWidth({ swipe, children }: { swipe: boolean; children: ReactNode }) {
  if (swipe) return <div className="flex min-w-0">{children}</div>;
  return <SnapWidth matchParentParity>{children}</SnapWidth>;
}

function Divider() {
  // Hairline margins on a phone, where every pixel of the strip is a tile's.
  return (
    <span
      aria-hidden
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 phone:mx-px dark:bg-slate-700"
    />
  );
}

export function ToolbarPalette(props: Props) {
  const { canvasTool, esBoard, themeTint, pendingDraw, hidden, leading } = props;
  const [moreOpen, setMoreOpenState] = useState(false);
  // Favourites are read from storage when the More popover opens or closes and when the category
  // changes, not every render: the chrome re-renders on every drag frame, and the Favourites body
  // writes its edits straight to storage, so closing the popover is exactly when the strip needs to
  // catch up. Both transitions go through setMoreOpen, which re-reads.
  const validIds = useMemo(() => new Set(PALETTE_TILES.map((t) => t.id)), []);
  const [favouriteIds, setFavouriteIds] = useState(() => loadPaletteFavourites(validIds));
  const setMoreOpen = (open: boolean) => {
    setMoreOpenState(open);
    setFavouriteIds(loadPaletteFavourites(validIds));
  };
  const { tabs, tileActions, canvasToolOptions, onCanvasToolChange, editorMode } =
    usePaletteCatalogue({
      ...props,
      // A tile used from the More popover closes it, so the canvas is clear to
      onTileUsed: () => setMoreOpen(false),
    });
  // Same landing rule as the floating Palette (docs/specs/010-palette/palette-favourites.md, docs/specs/021-event-storming/event-storming.md): the user's
  // Favourites, or the notation on an event-storming board.
  const defaultId = paletteLandingCategory(editorMode, !!esBoard);
  // Crossing an ES / non-ES tab boundary re-lands on the right default: the
  // host keys this component on `esBoard`, as the Palette keys PaletteTabBar.
  const [categoryId, setCategoryId] = useState(defaultId);
  const category = tabs.find((t) => t.id === categoryId) ?? tabs[0];

  // The strip holds as many tiles as the window fits, up to twelve; the rest
  // of the category is behind More.
  const isMobile = useIsMobileViewport();
  const viewportWidth = useViewportWidth();
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip zooms at its root,
  // so a scaled tile takes more of the window.
  const scale = useUiScale('toolbar');
  // Measured from the strip itself (useStripTileLimit); the estimate only
  // covers the first paint.
  const cardRef = useRef<HTMLDivElement>(null);
  const leadingRef = useRef<HTMLDivElement>(null);
  const stripLimit = useStripTileLimit(cardRef, {
    leadingRef,
    isMobile,
    scale,
    fallback: isMobile
      ? phoneStripTileLimit(viewportWidth)
      : desktopStripTileLimit(viewportWidth / scale),
  });
  // On a phone the strip holds the WHOLE category and swipes sideways
  // (docs/specs/007-editor/toolbar-layout.md "On a phone"); the fitted count
  // still decides whether More is needed for what is out of view.
  const swipe = leading != null;
  const tileLimit = swipe ? Infinity : stripLimit;
  const fitted = stripTilesFor(category?.id ?? defaultId, {
    favouriteIds,
    hasImage: tileActions.hasImage,
    limit: stripLimit,
  });
  const { tiles, dividersAfter } = swipe
    ? stripTilesFor(category?.id ?? defaultId, {
        favouriteIds,
        hasImage: tileActions.hasImage,
        limit: tileLimit,
      })
    : fitted;
  const { hasMore } = fitted;

  // The category being switched AWAY from, while its tiles animate out
  // (ToolbarStripRail). Rebuilt from data rather than kept as stale nodes, and
  // cleared once the exit has played.
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const leaveTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );
  // The category picker: the strip swaps to the new tiles (animated) and any
  // open More popover closes, since it was showing the old category.
  const switchCategory = (id: string) => {
    if (id === categoryId) return;
    setLeavingId(categoryId);
    setCategoryId(id);
    setMoreOpen(false);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeavingId(null), RAIL_LEAVE_MS);
    track('UI', 'Changed', 'ToolbarCategory');
  };
  const leaving = leavingId
    ? stripTilesFor(leavingId, {
        favouriteIds,
        hasImage: tileActions.hasImage,
        limit: tileLimit,
      })
    : null;

  // Outside pointer-down closes the More popover.
  const rootRef = useRef<HTMLDivElement>(null);
  const closeMore = useEffectEvent(() => setMoreOpen(false));
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      // Only the popover and its own button count as inside: pressing the
      // selection mode, the category picker or a tile elsewhere on the strip
      // closes it, so two strip menus are never open at once.
      if (t.closest('[data-toolbar-more], [data-toolbar-more-button]')) return;
      if (t.closest(INSIDE_SELECTOR)) return;
      closeMore();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMore();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  // Opening More focuses the body's search field, so typing filters straight
  // away (docs/specs/007-editor/toolbar-layout.md). A body that loads its catalogue lazily
  // (Icons, Technology) mounts the field a beat later, so watch for it. Not
  // on a phone: focusing would raise the keyboard over the popover.
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const popover = moreRef.current;
    if (!moreOpen || isMobile || !popover) return;
    const focusSearch = () => {
      const field = popover.querySelector<HTMLInputElement>(
        'input[type="search"], input[type="text"], input:not([type])',
      );
      if (!field) return false;
      field.focus();
      return true;
    };
    if (focusSearch()) return;
    const observer = new MutationObserver(() => {
      if (focusSearch()) observer.disconnect();
    });
    observer.observe(popover, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [moreOpen, isMobile]);

  // Where the More popover hangs: its right edge under the More button's
  // right edge, as an offset into the strip. Measured on the click that opens
  // it; the strip is centred, so a window resize moves both together and the
  // offset stays right.
  const [moreRight, setMoreRight] = useState(0);
  const openMore = (button: HTMLElement) => {
    const root = rootRef.current?.getBoundingClientRect();
    const btn = button.getBoundingClientRect();
    if (root) setMoreRight(root.right - btn.right);
    track('UI', 'Opened', 'ToolbarMore');
    setMoreOpen(true);
  };
  const moreButton = (
    <button
      type="button"
      data-toolbar-more-button=""
      aria-label={`More ${category?.label ?? ''}`.trim()}
      aria-expanded={moreOpen}
      onClick={(e) => {
        if (moreOpen) setMoreOpen(false);
        else openMore(e.currentTarget);
      }}
      className={`flex h-9 items-center gap-1 rounded-md px-2 transition ${
        moreOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : TOOLBAR_TRIGGER_TONE
      }`}
    >
      {/* An ellipsis rather than the word: the hover card and aria-label name
          it, and a glyph sits with the icon tiles instead of reading as a
          stray label among them. */}
      <EllipsisIcon />
      <ChevronDownIcon className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div
      ref={rootRef}
      data-toolbar-palette=""
      // The strip is the Palette in this layout, so the panel-opacity
      // preference (docs/specs/007-editor/user-preferences.md) fades it and its More popover
      // like every other panel; hovering either restores it.
      data-panel-translucent=""
      // `hidden` (zen, the welcome flow) hides rather than unmounts, so the
      // chosen category survives the chrome going away and back.
      //
      // Centred by flexbox across the full width, not `left-1/2
      // -translate-x-1/2`: a translate of half an odd width leaves the whole
      // strip on a half pixel, and every icon in it soft. The row itself lets
      // clicks through; the card and the popover take them.
      // Zoomed at the root, which still spans the canvas, so the card stays
      // centred; `top` is restated so the strip keeps its 12px from the top.
      style={scale === 1 ? undefined : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale) }}
      className={`pointer-events-none absolute inset-x-0 top-3 z-[var(--z-toolbar)] flex-col items-center [&>*]:pointer-events-auto ${hidden ? 'hidden' : 'flex'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <PaletteGroupProvider>
        <PaletteTintProvider tint={themeTint}>
          {/* Whole-pixel wide where centred (see CardWidth). */}
          <StripRow leading={leading} leadingRef={leadingRef}>
            <CardWidth swipe={swipe}>
              {/* The tour's Palette anchor (docs/specs/007-editor/editor-tour.md) is the card, not the
                full-width row around it, so the ring frames the strip. */}
              <div
                ref={cardRef}
                data-tour-id="palette"
                // Beside the menu card only the rail gives way (and scrolls): the
                // selection mode, the category picker and More keep their size.
                className={
                  swipe ? `${CARD_CLASS} min-w-0 [&>:not([data-strip-rail])]:shrink-0` : CARD_CLASS
                }
              >
                {/* Event-storming boards hide the selection mode (docs/specs/021-event-storming/event-storming.md): the
                notation is the palette there. */}
                {/* ...and lead with the board's own control instead, as the floating palette's
                Event Storming category does. */}
                {esBoard && props.esBoardControls?.onImportPhoto ? (
                  <>
                    <EsPhotoStripButton controls={props.esBoardControls} />
                    <Divider />
                  </>
                ) : null}
                {esBoard ? null : (
                  <>
                    <PaletteDropdown
                      ariaLabel="Selection mode"
                      dataTourId="canvas-tool"
                      hoverCardTitle="Selection Mode"
                      hoverCardDescription="Choose how the pointer acts on the canvas."
                      value={canvasTool}
                      variant="toolbar"
                      iconOnly
                      autoHeight
                      grid
                      menuClassName=""
                      groupLabels={{ 0: 'Edit', 1: 'Present', 2: 'Preview' }}
                      onChange={onCanvasToolChange}
                      options={canvasToolOptions}
                    />
                    <Divider />
                    {/* The category picker sits between the selection mode and the
                    tiles it chooses, so it reads as a label for them (docs/specs/007-editor/toolbar-layout.md).
                    Its width follows its label's text, which is fractional:
                    snapped, so the tiles after it stay on whole pixels. */}
                    <SnapWidth>
                      <PaletteDropdown
                        ariaLabel="Palette category"
                        dataTourId="palette-category"
                        value={category?.id ?? defaultId}
                        variant="toolbar"
                        // A phone shows the category's icon alone, so the
                        // strip has room for more tiles.
                        iconOnly={isMobile}
                        autoHeight
                        grid
                        menuClassName=""
                        groupLabels={CATEGORY_BANDS}
                        onChange={switchCategory}
                        options={tabs.map((tab) => ({
                          id: tab.id,
                          label: tab.label,
                          icon: tab.icon,
                          group: tab.group,
                          fullWidth: tab.fullWidth,
                        }))}
                      />
                    </SnapWidth>
                    <Divider />
                  </>
                )}
                <ToolbarStripRail
                  scrollable={swipe}
                  railKey={category?.id ?? defaultId}
                  items={[
                    ...tiles.map((def) => {
                      const tile = (
                        <PaletteTile
                          def={def}
                          actions={tileActions}
                          pendingDraw={pendingDraw}
                          compact
                        />
                      );
                      // A fixed divider rides with the tile it follows.
                      return dividersAfter.has(def.id) ? (
                        <span key={def.id} className="flex items-center">
                          {tile}
                          <Divider />
                        </span>
                      ) : (
                        <Fragment key={def.id}>{tile}</Fragment>
                      );
                    }),
                  ]}
                  leavingItems={
                    leaving
                      ? [
                          ...leaving.tiles.map((def) => (
                            <span key={def.id} className="flex items-center">
                              <PaletteTile
                                def={def}
                                actions={tileActions}
                                pendingDraw={null}
                                compact
                              />
                              {leaving.dividersAfter.has(def.id) ? <Divider /> : null}
                            </span>
                          )),
                        ]
                      : null
                  }
                />
                {/* Outside the rail so it rides the rail's width change rather
                than popping out and back in with the tiles. Only there when
                the category has more than the strip shows. */}
                {hasMore ? (
                  <>
                    <Divider />
                    {moreOpen ? (
                      moreButton
                    ) : (
                      <HoverCard
                        title={`More ${category?.label ?? ''}`.trim()}
                        description={category?.description ?? 'Everything in this category.'}
                      >
                        {moreButton}
                      </HoverCard>
                    )}
                  </>
                ) : null}
              </div>
            </CardWidth>
          </StripRow>
          {moreOpen && category ? (
            // The category's full Palette body, the exact node the floating
            // Palette renders. Capped to the window so a long category
            // (Components, Collaborate) scrolls rather than running off it.
            <div
              ref={moreRef}
              data-toolbar-more=""
              // Hangs from the More button, not the middle of the strip. Wide
              // rather than tall, so a category body rarely has to scroll.
              // A phone has no room to hang it from the button: it spans the
              // screen between the side gutters instead.
              // A menu, so it stays at design size while the strip is scaled
              // (docs/specs/007-editor/ui-scale.md): the counter-zoom brings it
              // back to 1, so moreRight (screen px) and the classes' width and
              // height cap apply as written.
              style={isMobile ? undefined : { ...uiUnscaleStyle(scale), right: moreRight }}
              className={`absolute top-full mt-2 max-h-[calc(100dvh-14rem)] ${isMobile ? 'inset-x-3' : 'w-[26rem]'} origin-top-right animate-dropdown-down overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white px-2 py-2.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40`}
            >
              <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {category.label}
              </div>
              {category.content}
            </div>
          ) : null}
        </PaletteTintProvider>
      </PaletteGroupProvider>
    </div>
  );
}
