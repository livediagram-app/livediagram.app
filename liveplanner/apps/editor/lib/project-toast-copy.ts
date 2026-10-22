// What a project's delete, restore, move or duplicate says (docs/specs/004-interface-design/toasts.md "Naming what
// it acted on"): the project by name, and where it went, shared by every surface that does it. "Project" or "the
// project" stands in when the name is blank or unknown.
import { toastName } from './toast-name';

/** Where a move landed: a named folder or team, or the person's own root. */
export type MoveDestination = { folder: string } | { team: string } | 'my-projects';

const where = (dest: MoveDestination): string => {
  if (dest === 'my-projects') return 'My Projects';
  if ('folder' in dest) return toastName(dest.folder) ?? 'the folder';
  return toastName(dest.team) ?? 'the team library';
};

export const projectMovedMessage = (name: string | null | undefined, dest: MoveDestination) =>
  `${toastName(name) ?? 'Project'} moved to ${where(dest)}`;

export const projectDuplicatedMessage = (name: string | null | undefined) =>
  `${toastName(name) ?? 'Project'} duplicated`;

export const projectDeletedMessage = (name?: string | null) =>
  `${toastName(name) ?? 'Project'} deleted`;

export const projectRestoredMessage = (name?: string | null) =>
  `${toastName(name) ?? 'Project'} restored`;

export const projectRestoreFailedMessage = (name?: string | null) =>
  `Could not restore ${toastName(name) ?? 'the project'}. It is in the Trash, in Settings.`;
