// Custom MIME type for the project-to-folder drag flow. A custom type means
// dropping a project outside any registered target (the page background, the
// URL bar, an unrelated app) is a no-op rather than triggering a browser
// navigation to "the dragged URL". Every drag source and drop target, in the
// editor's Explorer and on the Explorer page, goes through the helpers below so
// they agree.
export const PROJECT_DRAG_MIME = 'application/x-liveplanner-id';

// Present (empty) when the dragged project lives only in this browser
// (docs/specs/006-project/offline-mode.md). A drop target can only read a
// drag's TYPES while it is over it, never its data, so a team target that can't
// take the project learns it from this type and shows no drop.
export const PROJECT_LOCAL_ONLY_DRAG_MIME = 'application/x-liveplanner-local-only';

// The drag source's half: what a dragged project row or card carries.
export function startProjectDrag(
  dataTransfer: DataTransfer,
  project: { id: string; localOnly: boolean },
): void {
  dataTransfer.setData(PROJECT_DRAG_MIME, project.id);
  if (project.localOnly) dataTransfer.setData(PROJECT_LOCAL_ONLY_DRAG_MIME, '');
  dataTransfer.effectAllowed = 'move';
}

// A dragged folder (docs/specs/013-workspace/explorer-structure.md "Dragging to the Trash"): its own type, so the
// project drop targets (folders, My Work) never take it; only the sidebar's Trash does.
export const FOLDER_DRAG_MIME = 'application/x-liveplanner-folder-id';

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
export function explorerDragKind(types: readonly string[]): 'project' | 'folder' | null {
  if (types.includes(PROJECT_DRAG_MIME)) return 'project';
  if (types.includes(FOLDER_DRAG_MIME)) return 'folder';
  return null;
}
