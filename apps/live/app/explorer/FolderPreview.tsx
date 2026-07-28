'use client';

// The folder card's content preview (spec/99): a centred 2x2 mosaic of
// up to four small sheets — the diagrams the folder holds (the same
// cached SVG snapshot the diagram cards use, so nothing new is fetched
// or rendered server-side), its subfolders, and a "+N" tile when there
// is more inside than fits.
//
// An empty folder falls back to the card's plain folder glyph: there is
// nothing to preview, and the glyph is the honest answer.

import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { FolderCardGlyph } from './explorer-folder-cards';
import { FolderIcon } from './icons';
import { folderPreviewTiles, type FolderPreviewContents } from './folder-preview-tiles';

// Half the box each way whatever the count, so a one-diagram folder and
// a four-diagram folder use the same tile scale across the grid. The
// flex-wrap centring is what puts one tile in the middle and two side by
// side without a per-count layout.
const tileBox =
  'flex h-[calc(50%-0.25rem)] w-[calc(50%-0.25rem)] items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';

export function FolderPreview({
  contents,
  ownerId,
}: {
  contents: FolderPreviewContents;
  // Viewer identity for each tile's authenticated thumbnail fetch.
  ownerId: string | null;
}) {
  const { tiles, hidden } = folderPreviewTiles(contents);
  if (tiles.length === 0) return <FolderCardGlyph />;
  return (
    <span className="flex h-full w-full flex-wrap content-center items-center justify-center gap-2 p-3">
      {tiles.map((tile) =>
        tile.kind === 'diagram' ? (
          <span key={`d:${tile.diagram.id}`} className={tileBox}>
            <DiagramThumbnail
              ownerId={ownerId}
              diagramId={tile.diagram.id}
              version={tile.diagram.savedAt}
              shareCode={tile.diagram.shared?.shareCode}
              offline={tile.diagram.ownerId === OFFLINE_OWNER_ID}
              className="h-full w-full"
            />
          </span>
        ) : (
          <span
            key={`f:${tile.folder.id}`}
            className={`${tileBox} text-brand-400 dark:text-brand-300 [&_svg]:h-5 [&_svg]:w-5`}
          >
            <FolderIcon open={false} />
          </span>
        ),
      )}
      {hidden > 0 ? (
        <span
          className={`${tileBox} text-xs font-medium text-slate-400 dark:text-slate-500`}
        >{`+${hidden}`}</span>
      ) : null}
    </span>
  );
}
