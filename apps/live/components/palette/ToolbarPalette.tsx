'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, EllipsisIcon } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { loadPaletteFavourites } from '@/lib/palette-favourites';
import { loadRecentTiles, recordTileUse, saveRecentTiles } from '@/lib/toolbar-recent-tiles';
import { Tooltip } from '@/components/primitives/Tooltip';
import { SnapWidth } from '@/components/primitives/SnapWidth';
import { PaletteTintProvider } from './palette-controls';
import { PaletteGroupProvider } from './palette-group-state';
import { PaletteRecentContext } from './palette-recent-context';
import { PaletteDropdown, TOOLBAR_TRIGGER_TONE } from './PaletteDropdown';
import { CATEGORY_BANDS } from './PaletteTabBar';
import { PaletteTile } from './PaletteTileGrid';
import { PALETTE_TILES } from './palette-tile-defs';
import { STRIP_TILE_LIMIT, phoneStripTileLimit, stripTilesFor } from './toolbar-strip-tiles';
import { useViewportWidth } from '@/hooks/ui/useViewportWidth';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { RAIL_LEAVE_MS, ToolbarStripRail } from './ToolbarStripRail';
import { usePaletteCatalogue } from './usePaletteCatalogue';
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
    // Rendered at the far left of the strip, before the selection mode: the
    // Explorer menu button on a phone, which has no room for it in a corner.
    leading?: ReactNode;
  };
// Clicks inside these don't count as "outside" the More popover: the icon
// filter's portalled dropdown menus, and the Edit Favourites dialog that the
// Favourites body opens (closing the popover would unmount it mid-edit).
const INSIDE_SELECTOR = '[data-palette-dropdown-menu], [role="dialog"], [data-tour-popover]';

function Divider() {
  return <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

export function ToolbarPalette(props: Props) {
  const { canvasTool, esBoard, themeTint, pendingDraw, hidden, leading } = props;
  const [moreOpen, setMoreOpen] = useState(false);
  // Tiles by use (docs/specs/007-editor/toolbar-layout.md): using one brings it to the front of the strip,
  // pushing the rest along, and the last drops back behind More. Read once
  // per page load; written on every use.
  const [recent, setRecent] = useState<readonly string[]>(loadRecentTiles);
  const onUse = useCallback((id: string) => {
    setRecent((prev) => {
      const next = recordTileUse(prev, id);
      if (next !== prev) saveRecentTiles(next);
      return next;
    });
  }, []);
  const recentState = useMemo(() => ({ recent, onUse }), [recent, onUse]);
  const { tabs, tileActions, canvasToolOptions, onCanvasToolChange } = usePaletteCatalogue({
    ...props,
    // The Icons / Stickers / Technology bodies place a glyph straight
    // through these rather than through a tile, so the use is recorded here,
    // under the id the glyph's strip tile carries (palette-dynamic-tiles).
    onAddIcon: (id) => {
      onUse(`icon:${id}`);
      props.onAddIcon(id);
    },
    onAddSticker: (id) => {
      onUse(`sticker:${id}`);
      props.onAddSticker(id);
    },
    onAddTechIcon: (id) => {
      onUse(`tech:${id}`);
      props.onAddTechIcon(id);
    },
    // A tile used from the More popover closes it, so the canvas is clear to
    // draw on. There is no dock to reopen after a draw, so no onDrawArmed.
    onMobileClose: () => setMoreOpen(false),
  });
  // Same landing rule as the floating Palette (docs/specs/010-palette/palette-favourites.md, docs/specs/021-event-storming/event-storming.md): the user's
  // Favourites, or the notation on an event-storming board.
  const defaultId = esBoard ? 'event-storming' : 'favourites';
  // Crossing an ES / non-ES tab boundary re-lands on the right default: the
  // host keys this component on `esBoard`, as the Palette keys PaletteTabBar.
  const [categoryId, setCategoryId] = useState(defaultId);
  const category = tabs.find((t) => t.id === categoryId) ?? tabs[0];

  // Favourites are read from storage when the category or the popover
  // changes, not every render: the chrome re-renders on every drag frame, and
  // the Favourites body writes its edits straight to storage, so closing the
  // popover is exactly when the strip needs to catch up.
  const validIds = useMemo(() => new Set(PALETTE_TILES.map((t) => t.id)), []);
  const favouriteIds = useMemo(
    () => loadPaletteFavourites(validIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on close
    [validIds, moreOpen, categoryId],
  );
  // A phone gets a shorter strip; the rest of the category is behind More.
  const isMobile = useIsMobileViewport();
  const viewportWidth = useViewportWidth();
  const stripLimit = isMobile ? phoneStripTileLimit(viewportWidth) : STRIP_TILE_LIMIT;
  const { tiles, hasMore } = stripTilesFor(category?.id ?? defaultId, {
    favouriteIds,
    hasImage: tileActions.hasImage,
    limit: stripLimit,
    recent,
  });

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
        limit: stripLimit,
        recent,
      })
    : null;

  // Outside pointer-down closes the More popover.
  const rootRef = useRef<HTMLDivElement>(null);
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
      setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

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
      {/* An ellipsis rather than the word: the tooltip and aria-label name
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
      // `hidden` (zen, the welcome flow) hides rather than unmounts, so the
      // chosen category survives the chrome going away and back.
      //
      // Centred by flexbox across the full width, not `left-1/2
      // -translate-x-1/2`: a translate of half an odd width leaves the whole
      // strip on a half pixel, and every icon in it soft. The row itself lets
      // clicks through; the card and the popover take them.
      className={`pointer-events-none absolute inset-x-0 top-3 z-[var(--z-toolbar)] flex-col items-center [&>*]:pointer-events-auto ${hidden ? 'hidden' : 'flex'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <PaletteGroupProvider>
        <PaletteRecentContext.Provider value={recentState}>
          <PaletteTintProvider tint={themeTint}>
            {/* Whole-pixel wide, and the same parity as the canvas, so centring
              it can't leave the strip on a half pixel (see SnapWidth). */}
            <SnapWidth matchParentParity>
              {/* The tour's Palette anchor (docs/specs/007-editor/editor-tour.md) is the card, not the
                full-width row around it, so the ring frames the strip. */}
              <div
                data-tour-id="palette"
                className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
              >
                {/* Event-storming boards hide the selection mode (docs/specs/021-event-storming/event-storming.md): the
                notation is the palette there. */}
                {leading ? (
                  <>
                    {leading}
                    <Divider />
                  </>
                ) : null}
                {esBoard ? null : (
                  <>
                    <PaletteDropdown
                      ariaLabel="Selection mode"
                      dataTourId="canvas-tool"
                      tooltipTitle="Selection Mode"
                      tooltipDescription="Choose how the pointer acts on the canvas."
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
                  railKey={category?.id ?? defaultId}
                  items={[
                    ...tiles.map((def) => (
                      <PaletteTile
                        key={def.id}
                        def={def}
                        actions={tileActions}
                        pendingDraw={pendingDraw}
                        compact
                      />
                    )),
                  ]}
                  leavingItems={
                    leaving
                      ? [
                          ...leaving.tiles.map((def) => (
                            <PaletteTile
                              key={def.id}
                              def={def}
                              actions={tileActions}
                              pendingDraw={null}
                              compact
                            />
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
                      <Tooltip
                        title={`More ${category?.label ?? ''}`.trim()}
                        description={category?.description ?? 'Everything in this category.'}
                      >
                        {moreButton}
                      </Tooltip>
                    )}
                  </>
                ) : null}
              </div>
            </SnapWidth>
            {moreOpen && category ? (
              // The category's full Palette body, the exact node the floating
              // Palette renders. Capped to the window so a long category
              // (Components, Behaviours) scrolls rather than running off it.
              <div
                data-toolbar-more=""
                // Hangs from the More button, not the middle of the strip. Wide
                // rather than tall, so a category body rarely has to scroll.
                // A phone has no room to hang it from the button: it spans the
                // screen between the side gutters instead.
                style={isMobile ? undefined : { right: moreRight }}
                className={`absolute top-full mt-2 max-h-[calc(100dvh-14rem)] ${isMobile ? 'inset-x-3' : 'w-[26rem]'} origin-top-right animate-dropdown-down overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white px-2 py-2.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40`}
              >
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {category.label}
                </div>
                {category.content}
              </div>
            ) : null}
          </PaletteTintProvider>
        </PaletteRecentContext.Provider>
      </PaletteGroupProvider>
    </div>
  );
}
