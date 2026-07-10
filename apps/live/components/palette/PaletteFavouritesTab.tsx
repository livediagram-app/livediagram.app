import { useMemo, useState } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { loadPaletteFavourites, savePaletteFavourites } from '@/lib/palette-favourites';
import {
  PALETTE_TILES,
  PALETTE_TILE_SECTIONS,
  tileById,
  tilesInSection,
  type PaletteTileDef,
} from './palette-tile-defs';
import {
  PaletteSectionLabel,
  PaletteTileGrid,
  visibleTiles,
  type PaletteTileActions,
} from './PaletteTileGrid';

// The Favourites category (spec/78): the user's go-to creation tiles in one
// grid, editable in place in the spirit of iOS Control Centre. View mode
// renders the saved tiles exactly like their home tabs (same grid, tinting,
// draw-to-size, drag); Edit mode overlays remove badges on the current set
// and add badges on the rest of the catalogue, grouped by home category.

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

  // Everything not yet favourited, grouped by its home category so a
  // control is findable by where the user already knows it from. Sections
  // whose remaining tiles are all hidden (image tiles in sessions without
  // uploads) drop out entirely rather than leaving a bare heading.
  const pool = PALETTE_TILE_SECTIONS.map((section) => ({
    section,
    tiles: visibleTiles(
      tilesInSection(section.id).filter((t) => !favourites.includes(t.id)),
      actions.hasImage,
    ),
  })).filter((group) => group.tiles.length > 0);

  return (
    <div className="flex flex-col">
      {favouriteTiles.length === 0 ? (
        <p className="px-1 py-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
          No favourites yet — Edit to add some.
        </p>
      ) : (
        <PaletteTileGrid
          tiles={favouriteTiles}
          actions={actions}
          pendingDraw={pendingDraw}
          editBadge={editing ? 'remove' : undefined}
          onEditToggle={editing ? remove : undefined}
        />
      )}
      {editing ? (
        <>
          {pool.map(({ section, tiles }) => (
            <div key={section.id}>
              <PaletteSectionLabel>{section.label}</PaletteSectionLabel>
              <PaletteTileGrid
                tiles={tiles}
                actions={actions}
                pendingDraw={pendingDraw}
                editBadge="add"
                onEditToggle={add}
              />
            </div>
          ))}
        </>
      ) : null}
      <div className="flex justify-end pt-1.5">
        <button
          type="button"
          onClick={() => {
            if (!editing) track('UI', 'Toggled', 'PaletteFavouritesEdit');
            setEditing((e) => !e);
          }}
          className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
            editing
              ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
    </div>
  );
}
