import { describe, expect, it } from 'vitest';
import { folderDeleteConfirmation } from './folder-delete-confirmation';

// One folder delete wording (docs/specs/013-workspace/folders.md "Deleting a folder").

describe('folderDeleteConfirmation', () => {
  it('names the parent the contents move to', () => {
    expect(
      folderDeleteConfirmation({ name: 'Sprints', parentName: 'Projects', scope: 'personal' }),
    ).toEqual({
      title: 'Delete "Sprints"?',
      message: 'Its documents and subfolders move to "Projects".',
      confirmLabel: 'Delete folder',
    });
  });

  it('names the space root for a top-level folder', () => {
    expect(
      folderDeleteConfirmation({ name: 'A', parentName: null, scope: 'personal' }).message,
    ).toBe('Its documents and subfolders move to My documents.');
    expect(folderDeleteConfirmation({ name: 'A', parentName: null, scope: 'team' }).message).toBe(
      "Its documents and subfolders move to the team's root.",
    );
  });

  it('warns when the folder is one of the reader’s default folders', () => {
    expect(
      folderDeleteConfirmation({
        name: 'Workshops',
        parentName: null,
        scope: 'personal',
        defaultKeys: ['template:retrospective', 'mode:draw'],
      }).message,
    ).toBe(
      'Its documents and subfolders move to My documents.\nNew whiteboards and retrospectives are saved here by default. Choose another default folder in Settings.',
    );
  });

  it('falls back to "this folder" for a nameless folder', () => {
    expect(folderDeleteConfirmation({ name: '', parentName: null, scope: 'personal' }).title).toBe(
      'Delete "this folder"?',
    );
  });
});
