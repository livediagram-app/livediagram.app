import { useMemo, useRef, useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import {
  DEFAULT_PALETTE_FAVOURITES,
  loadPaletteFavourites,
  savePaletteFavourites,
} from '@/lib/palette-favourites';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { PALETTE_TILES, type PaletteTileDef } from './palette-tile-defs';
import {
  resolveFavouriteTile,
  searchIconTiles,
  searchStickerTiles,
  searchTechTiles,
} from './palette-dynamic-tiles';
import {
  PaletteTileGrid,
  tileHandler,
  visibleTiles,
  type PaletteTileActions,
} from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteSearchInput } from './PaletteSearchInput';
import { PaletteFavouritesDialog } from '@/components/dialogs/PaletteFavouritesDialog';
import { PaletteFavouritesReorder } from './PaletteFavouritesReorder';

// The Favourites category (spec/78): the user's go-to creation tiles in one
// grid, the palette's default landing. The grid renders the saved tiles
// exactly like their home tabs (same tiles, tinting, draw-to-size, drag);
// curation happens in the edit-favourites MODAL (search + category filter +
// per-row Add / Remove), opened from the footer band below the grid. WHICH
// tiles and WHAT ORDER are deliberately two different jobs: the modal answers
// the first, and Reorder — the footer's other button — answers the second in
// place, on the real grid at its real size, because an order is a spatial
// arrangement and dragging it where you will actually use it beats dragging a
// list in a dialog.
//
// It also carries the palette's CROSS-CATEGORY search (spec/110). Flattening
// the palette put every element one click away but spread them over ten
// categories, so "where does Checklist live now" needed an answer that isn't
// "open each one". Favourites is the default landing, which makes it the
// right place: typing searches the whole fixed catalogue and replaces the
// grid with the matches.
//
// It searches the icon, sticker and technology catalogues too, but always
// AFTER the element types and capped, so a glyph named like an element can
// never push the element itself off the top of the list.

// Per-catalogue cap on search results. Enough to find what you meant, few
// enough that three catalogues can't turn one query into a wall.
const CATALOGUE_MATCH_LIMIT = 12;

// One button in the footer band. They share every dimension and only differ
// in their label, so the class string lives once.
function FooterButton({
  onClick,
  disabled,
  strong,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** The band's primary action (Save), which reads as the way out. */
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition disabled:cursor-default disabled:opacity-40 ${
        strong
          ? 'text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
      } disabled:hover:bg-transparent`}
    >
      {children}
    </button>
  );
}

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
  // Reorder mode. The draft is separate from `favourites` so a drag previews
  // live without being saved: Save commits it, leaving the mode any other way
  // discards it. Null when not reordering.
  const [reorderDraft, setReorderDraft] = useState<string[] | null>(null);
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
    (reorderDraft ?? favourites)
      .map(resolveFavouriteTile)
      .filter((t): t is PaletteTileDef => t !== undefined),
    actions.hasImage,
  );
  const favouriteSet = useMemo(() => new Set(favourites), [favourites]);
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
  // Back to the shipped set. Written through the same `update` as every other
  // edit, so it persists immediately and needs no confirm: restoring a
  // removed tile by hand is one click in this same dialog.
  const reset = () => {
    update([...DEFAULT_PALETTE_FAVOURITES]);
    // 'Changed' rather than a new enum member: the closed telemetry
    // vocabulary already covers "this setting is not what it was".
    track('UI', 'Changed', 'PaletteFavourite');
  };

  // Save the dragged order. The draft holds only the tiles the grid could
  // RESOLVE, so it is written back over the resolvable ones and any
  // unresolvable id (an icon whose catalogue chunk has not landed) keeps its
  // place at the end rather than being silently dropped by a reorder.
  const saveOrder = () => {
    const draft = reorderDraft;
    setReorderDraft(null);
    if (!draft) return;
    const missing = favourites.filter((id) => !draft.includes(id));
    update([...draft, ...missing]);
    track('UI', 'Changed', 'PaletteFavourite');
  };

  // Matches on caption, label and description, so "chart" finds the pie chart
  // and "youtube" finds Video whether or not you know what it is called.
  const q = query.trim().toLowerCase();
  // Element types FIRST, then the catalogues. Ordering rather than excluding
  // them: the catalogues are ~180 line icons, ~40 brand marks and the sticker
  // set, so interleaving by relevance would bury the two dozen element types
  // under near-duplicate glyph names — searching "table" should offer the
  // Table element before nine table-ish icons. Each catalogue is capped for
  // the same reason.
  const matches = q
    ? [
        ...visibleTiles(
          PALETTE_TILES.filter((t) =>
            [t.label, t.caption ?? '', t.blurb ?? '', t.description].some((s) =>
              s.toLowerCase().includes(q),
            ),
          ),
          actions.hasImage,
        ),
        ...searchIconTiles(q).slice(0, CATALOGUE_MATCH_LIMIT),
        ...searchStickerTiles(q).slice(0, CATALOGUE_MATCH_LIMIT),
        ...searchTechTiles(q).slice(0, CATALOGUE_MATCH_LIMIT),
      ]
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

  const reordering = reorderDraft !== null;

  return (
    <div className="flex flex-col">
      {/* No search while reordering: the mode's only verb is "move this one
          there", and a filtered grid cannot express a full order. */}
      <div className={`mb-2 flex items-center${reordering ? ' hidden' : ''}`}>
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
      {reordering ? (
        <PaletteFavouritesReorder tiles={favouriteTiles} onReorder={setReorderDraft} />
      ) : matches ? (
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
            // Search is where you MEET a tool you did not know about, so it is
            // the one list where "and keep it" is worth a control of its own —
            // otherwise favouriting means finding the same thing a second time
            // through the Edit dialog.
            favouriteIds={favouriteSet}
            onToggleFavourite={(id) => (favouriteSet.has(id) ? remove(id) : add(id))}
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
      {/* A full-width FOOTER band flush with the panel's edges (negative
          margins swallow PaletteTabBar's content padding), set off by a top
          hairline — panel chrome, not floating buttons in the grid's corner.
          Two jobs, split by a hairline: Reorder rearranges what you have,
          Edit changes what you have. In reorder mode the same band becomes
          Cancel / Save, so the mode is always one press from ending and the
          panel never grows a third row of chrome.

          Gone entirely while searching. Search replaces the favourites grid
          with cross-category results, so both verbs would act on a grid that
          is not on screen — Reorder on a list you cannot see, Edit on a set
          the results are not from. */}
      <div
        className={`-mx-2 -mb-2.5 mt-2.5 self-stretch border-t border-slate-200 dark:border-slate-700 ${
          matches ? 'hidden' : 'flex'
        }`}
      >
        {reordering ? (
          <>
            <FooterButton onClick={() => setReorderDraft(null)}>Cancel</FooterButton>
            <FooterButton onClick={saveOrder} strong>
              Save
            </FooterButton>
          </>
        ) : (
          <>
            <FooterButton
              onClick={() => {
                track('UI', 'Toggled', 'PaletteFavouritesEdit');
                setReorderDraft([...favourites]);
              }}
              // Nothing to arrange with one tile, and nothing at all with none.
              disabled={favourites.length < 2}
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
                {/* Four-way move arrows: the gesture, not the outcome. */}
                <path d="M7 1.5v11M1.5 7h11" />
                <path d="M5 3.5 7 1.5l2 2M5 10.5l2 2 2-2M3.5 5l-2 2 2 2M10.5 5l2 2-2 2" />
              </svg>
              Reorder
            </FooterButton>
            <FooterButton
              onClick={() => {
                track('UI', 'Toggled', 'PaletteFavouritesEdit');
                setEditing(true);
              }}
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
            </FooterButton>
          </>
        )}
      </div>
      {editing ? (
        <PaletteFavouritesDialog
          favourites={favourites}
          hasImage={actions.hasImage}
          onAdd={add}
          onRemove={remove}
          onReset={reset}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
