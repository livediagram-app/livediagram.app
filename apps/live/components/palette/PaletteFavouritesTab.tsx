import { useMemo, useRef, useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { loadPaletteFavourites, savePaletteFavourites } from '@/lib/palette-favourites';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { PALETTE_TILES, type PaletteTileDef } from './palette-tile-defs';
import { resolveFavouriteTile } from './palette-dynamic-tiles';
import {
  PaletteTileGrid,
  tileHandler,
  visibleTiles,
  type PaletteTileActions,
} from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteSearchInput } from './PaletteSearchInput';
import { PaletteFavouritesDialog } from '@/components/dialogs/PaletteFavouritesDialog';

// The Favourites category (spec/78): the user's go-to creation tiles in one
// grid, the palette's default landing. The grid renders the saved tiles
// exactly like their home tabs (same tiles, tinting, draw-to-size, drag);
// curation happens in the edit-favourites MODAL (search + category filter +
// per-row Add / Remove), opened from the footer band below the grid.
//
// It also carries the palette's CROSS-CATEGORY search (spec/110). Flattening
// the palette put every element one click away but spread them over ten
// categories, so "where does Checklist live now" needed an answer that isn't
// "open each one". Favourites is the default landing, which makes it the
// right place: typing searches the whole fixed catalogue and replaces the
// grid with the matches.
//
// The Icons and Technology catalogues are deliberately NOT searched here —
// 183 glyphs would bury the twenty-odd element types under near-duplicate
// icon names, and each of those tabs has its own search over its own
// catalogue (spec/109).

export function PaletteFavouritesTab({
  pendingDraw,
  actions,
}: {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
}) {
  const validIds = useMemo(() => new Set(PALETTE_TILES.map((t) => t.id)), []);
  const [query, setQuery] = useState('');
  const [favourites, setFavourites] = useState<string[]>(() => loadPaletteFavourites(validIds));
  const [editing, setEditing] = useState(false);
  // Dynamic icon favourites (`icon:` / `tech:` ids) resolve from the async
  // icon catalogues; subscribing re-renders this grid when the chunk lands
  // so they pop in rather than silently missing until a later re-render.
  const iconCatalogsLoaded = useIconCatalogs();

  // Capability-filtered like the grid itself renders (PaletteTileGrid
  // applies visibleTiles internally), so the empty-state check below sees
  // what the user will actually see: favourites that are ALL image tiles
  // on an uploads-less deployment must show the "No favourites yet" hint,
  // not a silently empty grid. While the icon catalogues are still loading,
  // unresolved dynamic ids are simply absent for a moment; the empty hint
  // is suppressed then so it can't flash over a set that's about to appear.
  const favouriteTiles = visibleTiles(
    favourites.map(resolveFavouriteTile).filter((t): t is PaletteTileDef => t !== undefined),
    actions.hasImage,
  );
  const showEmptyHint =
    favouriteTiles.length === 0 && (iconCatalogsLoaded || favourites.length === 0);

  const update = (next: string[]) => {
    setFavourites(next);
    savePaletteFavourites(next);
  };
  const remove = (id: string) => {
    update(favourites.filter((f) => f !== id));
    track('UI', 'Removed', 'PaletteFavourite');
  };
  const add = (id: string) => {
    update([...favourites, id]);
    track('UI', 'Added', 'PaletteFavourite');
  };

  // Matches on caption, label and description, so "chart" finds the pie chart
  // and "youtube" finds Video whether or not you know what it is called.
  const q = query.trim().toLowerCase();
  const matches = q
    ? visibleTiles(
        PALETTE_TILES.filter((t) =>
          [t.label, t.caption ?? '', t.blurb ?? '', t.description].some((s) =>
            s.toLowerCase().includes(q),
          ),
        ),
        actions.hasImage,
      )
    : null;
  // One 'Searched' event per mount, on the first keystroke — the same
  // engagement-signal pattern the other palette searches use.
  const searchedRef = useRef(false);
  // Which result the arrow keys are pointing at. -1 = none, so the first
  // ArrowDown lands on the first row rather than the second. Focus never
  // leaves the input (the combobox pattern), so typing to refine still works
  // with a row highlighted.
  const [active, setActive] = useState(-1);
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!matches || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Enter with nothing walked adds the FIRST match: having typed enough
      // to leave one obvious result, pressing Enter should take it.
      const pick = matches[active >= 0 ? active : 0];
      if (!pick) return;
      e.preventDefault();
      tileHandler(pick, actions)();
      setQuery('');
      setActive(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery('');
      setActive(-1);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center">
        <PaletteSearchInput
          value={query}
          onChange={(next) => {
            setQuery(next);
            // A new query is a new result list, so the old position is
            // meaningless — start again from "nothing walked".
            setActive(-1);
            if (!searchedRef.current && next.trim()) {
              searchedRef.current = true;
              track('UI', 'Searched', 'PaletteSearch');
            }
          }}
          placeholder="Search all elements"
          ariaLabel="Search all elements"
          clearAriaLabel="Clear element search"
          clearDescription="Clear the element search query."
          onKeyDown={onSearchKeyDown}
          activeDescendantId={active >= 0 ? `palette-search-${active}` : undefined}
        />
      </div>
      {matches ? (
        // Searching cuts across every category, so it replaces the favourites
        // grid entirely. Rows rather than tiles: a result can come from any
        // category, and the blurb is what says which thing you found.
        matches.length > 0 ? (
          <PaletteToolRows
            tiles={matches}
            actions={actions}
            pendingDraw={pendingDraw}
            activeIndex={active}
            optionIdPrefix="palette-search"
          />
        ) : (
          <p className="px-1 py-2 text-center text-[11px] text-slate-400">
            No elements match “{query}”.
          </p>
        )
      ) : favouriteTiles.length === 0 ? (
        showEmptyHint ? (
          <p className="px-1 py-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
            No favourites yet — Edit to add some.
          </p>
        ) : null
      ) : (
        <PaletteTileGrid tiles={favouriteTiles} actions={actions} pendingDraw={pendingDraw} />
      )}
      {/* Edit as a full-width FOOTER band flush with the panel's edges
          (negative margins swallow PaletteTabBar's content padding), set
          off by a top hairline — panel chrome, not a floating button in
          the grid's corner. Opens the edit-favourites modal. */}
      <button
        type="button"
        onClick={() => {
          track('UI', 'Toggled', 'PaletteFavouritesEdit');
          setEditing(true);
        }}
        className="-mx-2 -mb-2.5 mt-2.5 flex items-center justify-center gap-1.5 self-stretch border-t border-slate-200 px-3 py-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9.7 1.8 12.2 4.3 5 11.5l-3.2.7.7-3.2z" />
        </svg>
        Edit
      </button>
      {editing ? (
        <PaletteFavouritesDialog
          favourites={favourites}
          hasImage={actions.hasImage}
          onAdd={add}
          onRemove={remove}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
