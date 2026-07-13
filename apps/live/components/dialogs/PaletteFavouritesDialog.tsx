'use client';

// Edit-favourites modal (spec/78). Opened from the Favourites tab's footer
// Edit button: a search box + category pills (Shapes first — there is
// deliberately no "All") over the fixed creation tiles of the picked
// category, laid out as a compact 5-per-row tile grid. Each tile carries a
// corner badge — red minus on current favourites, green plus on the rest —
// and clicking the tile toggles membership. Edits apply (and persist)
// immediately; Done just closes. On desktop the backdrop stays light so
// the palette's Favourites grid visibly updates behind the modal.

import { useState } from 'react';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { matches } from '@/lib/search';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import {
  ComponentsTabIcon,
  DataTabIcon,
  DevicesTabIcon,
  IconsTabIcon,
  ShapesTabIcon,
  TechTabIcon,
  ToolsTabIcon,
} from '@/components/palette/palette-tab-icons';
import {
  tileDisplayName,
  tilesInSection,
  type PaletteTileDef,
  type PaletteTileSection,
} from '@/components/palette/palette-tile-defs';
import { searchIconTiles, searchTechTiles } from '@/components/palette/palette-dynamic-tiles';

type PaletteFavouritesDialogProps = {
  favourites: string[];
  // Whether image uploads are available; hides the needsImage tiles the
  // grids themselves would hide (see PaletteTileGrid.visibleTiles).
  hasImage: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

// The category pills, each with its palette-category glyph (Data borrows a
// bar-chart mark — it's a Tools sub-section elsewhere, spec/53). Icons and
// Technology surface their open-ended catalogues here too, so individual
// icons are favouritable alongside the fixed creation tiles.
const CATEGORY_PILLS: { id: PaletteTileSection; label: string; icon: React.ReactNode }[] = [
  { id: 'shapes', label: 'Shapes', icon: <ShapesTabIcon /> },
  { id: 'tools', label: 'Tools', icon: <ToolsTabIcon /> },
  { id: 'data', label: 'Data', icon: <DataTabIcon /> },
  { id: 'components', label: 'Components', icon: <ComponentsTabIcon /> },
  { id: 'devices', label: 'Devices', icon: <DevicesTabIcon /> },
  { id: 'icons', label: 'Icons', icon: <IconsTabIcon /> },
  { id: 'technology', label: 'Technology', icon: <TechTabIcon /> },
];

// One toggleable tile: glyph + caption with the add / remove corner badge.
function ToggleTile({
  def,
  isFavourite,
  onToggle,
}: {
  def: PaletteTileDef;
  isFavourite: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isFavourite}
      aria-label={`${isFavourite ? 'Remove' : 'Add'} favourite: ${tileDisplayName(def)}`}
      onClick={onToggle}
      // Every tile is a bordered card even at rest — with 100+ icons in
      // one grid, hover-only boundaries read as one undifferentiated mush.
      className={`relative flex w-full flex-col items-center justify-start gap-1 rounded-md border px-0.5 py-2 transition ${
        isFavourite
          ? 'border-brand-200 bg-brand-50/70 text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-slate-200 dark:hover:bg-brand-500/15'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      <span className="flex h-6 items-center justify-center">{def.icon}</span>
      <span className="w-full truncate text-center text-[9px] leading-none">
        {tileDisplayName(def)}
      </span>
      <span
        aria-hidden
        className={`pointer-events-none absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white shadow-sm ${
          isFavourite ? 'bg-red-500' : 'bg-emerald-500'
        }`}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path
            d={isFavourite ? 'M1 4h6' : 'M4 1v6M1 4h6'}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </button>
  );
}

export function PaletteFavouritesDialog({
  favourites,
  hasImage,
  onAdd,
  onRemove,
  onClose,
}: PaletteFavouritesDialogProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PaletteTileSection>('shapes');
  // The Icons / Technology pills read the async icon catalogues; subscribing
  // re-renders when the chunk lands so their grids fill in.
  const iconCatalogsLoaded = useIconCatalogs();

  const tiles =
    category === 'icons'
      ? searchIconTiles(query)
      : category === 'technology'
        ? searchTechTiles(query)
        : tilesInSection(category).filter(
            (t) =>
              (!t.needsImage || hasImage) &&
              (matches(query, tileDisplayName(t)) || matches(query, t.label)),
          );
  const loadingCategory =
    (category === 'icons' || category === 'technology') && !iconCatalogsLoaded;

  return (
    <Dialog
      open
      onClose={onClose}
      titleId="favourites-dialog-title"
      // 3xl + a denser desktop grid: long categories (Icons, Technology)
      // were a narrow five-wide column that scrolled forever (spec/78).
      size="3xl"
      className="max-h-[80vh]"
      backdrop="desktop-light"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2
            id="favourites-dialog-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Edit Favourites
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Tap a control to add or remove it. Changes apply immediately.
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
          {CATEGORY_PILLS.map((s) => {
            const active = category === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(s.id)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition [&>svg]:h-3.5 [&>svg]:w-3.5 ${
                  active
                    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            );
          })}
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search controls…"
          aria-label="Search controls"
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tiles.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            {/* While the catalogue chunk is in flight an empty grid means
                "not here yet", not "nothing matches". */}
            {loadingCategory ? 'Loading icons…' : 'No controls match.'}
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-9">
            {tiles.map((t) => {
              const isFavourite = favourites.includes(t.id);
              return (
                <ToggleTile
                  key={t.id}
                  def={t}
                  isFavourite={isFavourite}
                  onToggle={() => (isFavourite ? onRemove(t.id) : onAdd(t.id))}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <Button onClick={onClose} size="sm">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2.5 6.5 5 9l4.5-6" />
          </svg>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
