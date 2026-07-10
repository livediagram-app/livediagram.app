import { useMemo, useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { loadPaletteFavourites, savePaletteFavourites } from '@/lib/palette-favourites';
import { PALETTE_TILES, tileById, type PaletteTileDef } from './palette-tile-defs';
import { PaletteTileGrid, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteFavouritesDialog } from '@/components/dialogs/PaletteFavouritesDialog';

// The Favourites category (spec/78): the user's go-to creation tiles in one
// grid, the palette's default landing. The grid renders the saved tiles
// exactly like their home tabs (same tiles, tinting, draw-to-size, drag);
// curation happens in the edit-favourites MODAL (search + category filter +
// per-row Add / Remove), opened from the footer band below the grid.

export function PaletteFavouritesTab({
  pendingDraw,
  actions,
}: {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
}) {
  const validIds = useMemo(() => new Set(PALETTE_TILES.map((t) => t.id)), []);
  const [favourites, setFavourites] = useState<string[]>(() => loadPaletteFavourites(validIds));
  const [editing, setEditing] = useState(false);

  // Capability-filtered like the grid itself renders (PaletteTileGrid
  // applies visibleTiles internally), so the empty-state check below sees
  // what the user will actually see: favourites that are ALL image tiles
  // on an uploads-less deployment must show the "No favourites yet" hint,
  // not a silently empty grid.
  const favouriteTiles = visibleTiles(
    favourites.map(tileById).filter((t): t is PaletteTileDef => t !== undefined),
    actions.hasImage,
  );

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

  return (
    <div className="flex flex-col">
      {favouriteTiles.length === 0 ? (
        <p className="px-1 py-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
          No favourites yet — Edit to add some.
        </p>
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
