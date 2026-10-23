// Custom MIME type for the design-to-folder drag flow. A custom type means
// dropping a design outside any registered target (the page background, the
// URL bar, an unrelated app) is a no-op rather than triggering a browser
// navigation to "the dragged URL". Every drag source and drop target, in the
// editor's Explorer and on the Explorer page, goes through the helpers below so
// they agree.
export const DESIGN_DRAG_MIME = 'application/x-livedesign-id';

// Present (empty) when the dragged design lives only in this browser
// (docs/specs/006-design/offline-mode.md). A drop target can only read a
// drag's TYPES while it is over it, never its data, so a team target that can't
// take the design learns it from this type and shows no drop.
export const DESIGN_LOCAL_ONLY_DRAG_MIME = 'application/x-livedesign-local-only';

// The drag source's half: what a dragged design row or card carries.
export function startDesignDrag(
  dataTransfer: DataTransfer,
  design: { id: string; localOnly: boolean },
): void {
  dataTransfer.setData(DESIGN_DRAG_MIME, design.id);
  if (design.localOnly) dataTransfer.setData(DESIGN_LOCAL_ONLY_DRAG_MIME, '');
  dataTransfer.effectAllowed = 'move';
}

// A dragged folder (docs/specs/013-workspace/explorer-structure.md "Dragging to the Trash"): its own type, so the
// design drop targets (folders, My Work) never take it; only the sidebar's Trash does.
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
export function explorerDragKind(types: readonly string[]): 'design' | 'folder' | null {
  if (types.includes(DESIGN_DRAG_MIME)) return 'design';
  if (types.includes(FOLDER_DRAG_MIME)) return 'folder';
  return null;
}
