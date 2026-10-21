// What a document's delete, restore, move or duplicate says (docs/specs/004-interface-design/toasts.md "Naming what
// it acted on"): the document by name, and where it went, shared by every surface that does it. "Document" or "the
// document" stands in when the name is blank or unknown.
import { toastName } from './toast-name';

/** Where a move landed: a named folder or team, or the person's own root. */
export type MoveDestination = { folder: string } | { team: string } | 'my-documents';

const where = (dest: MoveDestination): string => {
  if (dest === 'my-documents') return 'My Documents';
  if ('folder' in dest) return toastName(dest.folder) ?? 'the folder';
  return toastName(dest.team) ?? 'the team library';
};

export const documentMovedMessage = (name: string | null | undefined, dest: MoveDestination) =>
  `${toastName(name) ?? 'Document'} moved to ${where(dest)}`;

export const documentDuplicatedMessage = (name: string | null | undefined) =>
  `${toastName(name) ?? 'Document'} duplicated`;

export const documentDeletedMessage = (name?: string | null) =>
  `${toastName(name) ?? 'Document'} deleted`;

export const documentRestoredMessage = (name?: string | null) =>
  `${toastName(name) ?? 'Document'} restored`;

export const documentRestoreFailedMessage = (name?: string | null) =>
  `Could not restore ${toastName(name) ?? 'the document'}. It is in the Trash, in Settings.`;
