// The folder delete confirmation (docs/specs/013-workspace/folders.md "Deleting a folder"; blueprint
// folder-delete.md): one wording for every surface that deletes a folder, personal or team. It
// names where the contents go, and warns when the folder is one of the reader's default folders
// (docs/specs/013-workspace/default-folders.md "Deleting a default folder").
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { defaultKeyEntry, inListOrder, joinNouns } from './placement-defaults/default-key-entries';

export type FolderDeleteInput = {
  name: string;
  /** The parent folder's name; null for a top-level folder. */
  parentName: string | null;
  scope: 'personal' | 'team';
  /** The keys this folder is the reader's default for. */
  defaultKeys?: readonly PlacementDefaultKey[];
};

function destination({ parentName, scope }: FolderDeleteInput): string {
  if (parentName !== null) return `"${parentName}"`;
  return scope === 'team' ? "the team's root" : 'My documents';
}

export function folderDeleteMessage(input: FolderDeleteInput): string {
  const lines = [`Its documents and subfolders move to ${destination(input)}.`];
  const keys = inListOrder(input.defaultKeys ?? []);
  if (keys.length > 0) {
    const nouns = joinNouns(keys.map((k) => defaultKeyEntry(k).noun));
    lines.push(
      `New ${nouns} are saved here by default. Choose another default folder in Settings.`,
    );
  }
  return lines.join('\n');
}

export function folderDeleteConfirmation(input: FolderDeleteInput) {
  return {
    title: `Delete "${input.name || 'this folder'}"?`,
    message: folderDeleteMessage(input),
    confirmLabel: 'Delete folder',
  };
}
