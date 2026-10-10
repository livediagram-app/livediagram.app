// What dropping a dragged document onto a place means (docs/specs/013-workspace/folders.md
// "Drag-and-drop"). A place is a space (My documents when `teamId` is null, else that team's
// library) and a folder in it (null = the space's root).
export type DropPlace = { teamId: string | null; folderId: string | null };

export type DropPlan =
  // The document is already there: nothing to do, nothing to say.
  | 'already-there'
  // A team's library lives on the server; a document only in this browser can't land there.
  | 'refused-local-only'
  | 'move';

export function planDocumentDrop({
  from,
  to,
  localOnly,
}: {
  from: DropPlace;
  to: DropPlace;
  localOnly: boolean;
}): DropPlan {
  if (from.teamId === to.teamId && from.folderId === to.folderId) return 'already-there';
  if (localOnly && to.teamId !== null) return 'refused-local-only';
  return 'move';
}
