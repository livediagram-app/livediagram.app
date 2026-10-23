// What a design's delete, restore, move or duplicate says (docs/specs/004-interface-design/toasts.md "Naming what
// it acted on"): the design by name, and where it went, shared by every surface that does it. "Design" or "the
// design" stands in when the name is blank or unknown.
import { toastName } from './toast-name';

/** Where a move landed: a named folder or team, or the person's own root. */
export type MoveDestination = { folder: string } | { team: string } | 'my-designs';

const where = (dest: MoveDestination): string => {
  if (dest === 'my-designs') return 'My Work';
  if ('folder' in dest) return toastName(dest.folder) ?? 'the folder';
  return toastName(dest.team) ?? 'the team library';
};

export const designMovedMessage = (name: string | null | undefined, dest: MoveDestination) =>
  `${toastName(name) ?? 'Design'} moved to ${where(dest)}`;

export const designDuplicatedMessage = (name: string | null | undefined) =>
  `${toastName(name) ?? 'Design'} duplicated`;

export const designDeletedMessage = (name?: string | null) =>
  `${toastName(name) ?? 'Design'} deleted`;

export const designRestoredMessage = (name?: string | null) =>
  `${toastName(name) ?? 'Design'} restored`;

export const designRestoreFailedMessage = (name?: string | null) =>
  `Could not restore ${toastName(name) ?? 'the design'}. It is in the Trash, in Settings.`;
