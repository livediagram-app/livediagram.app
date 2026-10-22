// Custom MIME type for the document-to-folder drag flow. A custom type means
// dropping a document outside any registered target (the page background, the
// URL bar, an unrelated app) is a no-op rather than triggering a browser
// navigation to "the dragged URL". Every drag source and drop target, in the
// editor's Explorer and on the Explorer page, goes through the helpers below so
// they agree.
export const DOCUMENT_DRAG_MIME = 'application/x-livedesign-id';

// Present (empty) when the dragged document lives only in this browser
// (docs/specs/006-document/offline-mode.md). A drop target can only read a
// drag's TYPES while it is over it, never its data, so a team target that can't
// take the document learns it from this type and shows no drop.
export const DOCUMENT_LOCAL_ONLY_DRAG_MIME = 'application/x-livedesign-local-only';

// The drag source's half: what a dragged document row or card carries.
export function startDocumentDrag(
  dataTransfer: DataTransfer,
  document: { id: string; localOnly: boolean },
): void {
  dataTransfer.setData(DOCUMENT_DRAG_MIME, document.id);
  if (document.localOnly) dataTransfer.setData(DOCUMENT_LOCAL_ONLY_DRAG_MIME, '');
  dataTransfer.effectAllowed = 'move';
}

// A dragged folder (docs/specs/013-workspace/explorer-structure.md "Dragging to the Trash"): its own type, so the
// document drop targets (folders, My Documents) never take it; only the sidebar's Trash does.
export const FOLDER_DRAG_MIME = 'application/x-livedesign-folder-id';

/** What a dragged folder card or row carries: one of the reader's own folders, never one being renamed. */
export function folderDragProps(
  folder: { id: string; teamId?: string | null },
  renaming: boolean,
): { draggable?: true; onDragStart?: (e: React.DragEvent) => void } {
  if (renaming || folder.teamId) return {};
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData(FOLDER_DRAG_MIME, folder.id);
      e.dataTransfer.effectAllowed = 'move';
    },
  };
}

/** What an Explorer drag carries, read from its types (a drop target can't read the data until the drop). */
export function explorerDragKind(types: readonly string[]): 'document' | 'folder' | null {
  if (types.includes(DOCUMENT_DRAG_MIME)) return 'document';
  if (types.includes(FOLDER_DRAG_MIME)) return 'folder';
  return null;
}
