// Which tiles a folder card's content preview shows (spec/99), kept
// pure and separate from the rendering so the rule ("diagrams first,
// subfolders fill the rest, four max, the overflow becomes +N") is
// unit-testable without a DOM.

import type { Folder } from '@/lib/api-client';
import type { PaneDiagram } from './views';

// Four tiles: a 2x2 mosaic is the most a card-sized preview can show
// before each snapshot is too small to recognise.
export const FOLDER_PREVIEW_TILES = 4;

export type FolderPreviewTile =
  | { kind: 'diagram'; diagram: PaneDiagram }
  | { kind: 'folder'; folder: Folder };

export type FolderPreviewContents = { folders: Folder[]; diagrams: PaneDiagram[] };

export function folderPreviewTiles({ folders, diagrams }: FolderPreviewContents): {
  tiles: FolderPreviewTile[];
  // Everything the mosaic couldn't fit, rendered as a trailing "+N"
  // tile. Zero when it all fits.
  hidden: number;
} {
  const total = folders.length + diagrams.length;
  if (total === 0) return { tiles: [], hidden: 0 };

  // Diagrams lead: a snapshot is the only tile you can actually
  // recognise the folder by. Subfolders take whatever is left over.
  const ordered: FolderPreviewTile[] = [
    ...diagrams.map((diagram): FolderPreviewTile => ({ kind: 'diagram', diagram })),
    ...folders.map((folder): FolderPreviewTile => ({ kind: 'folder', folder })),
  ];
  if (total <= FOLDER_PREVIEW_TILES) return { tiles: ordered, hidden: 0 };

  // Overflowing: the last slot becomes the counter, so only three
  // previews survive.
  return {
    tiles: ordered.slice(0, FOLDER_PREVIEW_TILES - 1),
    hidden: total - (FOLDER_PREVIEW_TILES - 1),
  };
}
