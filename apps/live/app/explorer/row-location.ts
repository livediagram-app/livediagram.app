// Where a row in a view that lists more than one place lives (docs/specs/013-workspace/recent-folder-chip.md): the
// chip on Recent, Favourites, Search results and Tags rows, and on a lens that reaches into subfolders. A pure
// reading of the row, so the rule is tested on its own; the pane supplies where each place opens.
import type { Folder } from '@/lib/api-client';
import type { PaneDocument, SelectedNode } from './views';
import { VIEW_TITLES } from './view-titles';
import { isLocalOnly } from '@/lib/document-space';

export type RowLocation = { label: string; opens: SelectedNode };

export function rowLocation(
  d: PaneDocument,
  {
    selected,
    lensActive,
    folderById,
  }: {
    selected: SelectedNode;
    lensActive: boolean;
    folderById: ReadonlyMap<string, Folder>;
  },
): RowLocation | null {
  // Rows shared WITH you carry no folderId at all (they live in the sharer's
  // library, not yours), so they get no chip rather than a misleading one.
  if (d.shared) return null;
  const aggregates =
    selected.kind === 'recent' ||
    selected.kind === 'favourites' ||
    selected.kind === 'search' ||
    selected.kind === 'tags';
  const reaching = lensActive && (selected.kind === 'all' || selected.kind === 'folder');
  if (!aggregates && !reaching) return null;
  // A row in the folder the reader is in needs no chip.
  const here = selected.kind === 'folder' ? selected.id : null;
  if (reaching && d.folderId === here) return null;
  // A team document's folder belongs to the team's library, which `folderById` (your
  // personal folders) doesn't index: the chip names the TEAM and opens its library.
  if (d.team) return { label: d.team.name, opens: { kind: 'team', id: d.team.id } };
  // A document in this browser lives there (docs/specs/013-workspace/explorer-structure.md "Places"), not in My
  // documents, which does not list it: its chip said My Documents and opened a list it was not in.
  if (isLocalOnly(d)) return { label: VIEW_TITLES.offline, opens: { kind: 'offline' } };
  // The root is a location too: My Documents.
  if (!d.folderId) return { label: VIEW_TITLES.all, opens: { kind: 'all' } };
  const folder = folderById.get(d.folderId);
  if (!folder) return null;
  return { label: folder.name, opens: { kind: 'folder', id: folder.id } };
}
