'use client';

// A folder card's content preview (liveplanner's FolderPreview, docs/specs/013-workspace/folder-content-previews.md):
// a centred 2x2 mosaic of up to four small sheets, the items the folder holds first (the same snapshot their own
// cards show, so nothing new is drawn), then its subfolders, and a "+N" tile when there is more inside than fits.
// An empty folder shows the empty state's art, so an empty card reads as waiting rather than broken.

import type { Folder, FolderPreview, Item } from '@liveworkspace/index-client';
import { EmptyStateArt } from '../ui/EmptyState';
import { FolderSolidIcon, ItemIcon } from '../ui/icons';
import { useExplorer } from './context';

// Four tiles: a 2x2 mosaic is the most a card-sized preview can show before each snapshot is too small to know.
const TILES = 4;

type Tile = { kind: 'item'; item: Item } | { kind: 'folder'; folder: Folder };

/** Items lead, subfolders fill the rest, four at most; overflowing, the last slot becomes "+N". */
export function folderTiles(
  preview: Pick<FolderPreview, 'items' | 'itemCount'>,
  subfolders: readonly Folder[],
): { tiles: Tile[]; hidden: number } {
  const total = preview.itemCount + subfolders.length;
  if (total === 0) return { tiles: [], hidden: 0 };
  const ordered: Tile[] = [
    ...preview.items.map((item): Tile => ({ kind: 'item', item })),
    ...subfolders.map((folder): Tile => ({ kind: 'folder', folder })),
  ];
  if (total <= TILES) return { tiles: ordered.slice(0, TILES), hidden: 0 };
  return { tiles: ordered.slice(0, TILES - 1), hidden: total - (TILES - 1) };
}

// Half the box each way whatever the count, so every folder uses the same tile scale across the grid; the wrap's
// centring puts one tile in the middle and two side by side without a per-count layout.
const TILE =
  'flex h-[calc(50%-0.25rem)] w-[calc(50%-0.25rem)] items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';

export function FolderMosaic({
  preview,
  subfolders,
}: {
  preview: FolderPreview;
  subfolders: readonly Folder[];
}) {
  const { renderThumbnail } = useExplorer();
  const { tiles, hidden } = folderTiles(preview, subfolders);
  if (tiles.length === 0 && hidden === 0) {
    return (
      <span
        data-folder-empty=""
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
      >
        <EmptyStateArt compact icon={<FolderSolidIcon />} />
      </span>
    );
  }
  return (
    <span
      data-folder-mosaic=""
      className="flex h-full w-full flex-wrap content-center items-center justify-center gap-2 p-3"
    >
      {tiles.map((tile) =>
        tile.kind === 'item' ? (
          <span key={`i:${tile.item.id}`} className={TILE}>
            {renderThumbnail?.(tile.item, 'card') ?? (
              <span className="text-slate-300 dark:text-slate-600 [&_svg]:h-5 [&_svg]:w-5">
                <ItemIcon />
              </span>
            )}
          </span>
        ) : (
          <span
            key={`f:${tile.folder.id}`}
            className={`${TILE} text-brand-400 dark:text-brand-300 [&_svg]:h-5 [&_svg]:w-5`}
          >
            <FolderSolidIcon />
          </span>
        ),
      )}
      {hidden > 0 ? (
        <span className={`${TILE} text-xs font-medium text-slate-500 dark:text-slate-400`}>
          {`+${hidden}`}
        </span>
      ) : null}
    </span>
  );
}
