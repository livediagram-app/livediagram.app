import { describe, expect, it } from 'vitest';
import {
  DELETE_CONFIRM_LABEL,
  DELETE_CONFIRM_TITLE,
  deleteConfirmation,
  deleteConfirmationMessage,
} from './delete-confirmation';

// Every document delete asks the same short question (docs/specs/013-workspace/trash.md,
// "Deleting"), with a second line only when something applies.

describe('deleteConfirmation', () => {
  it('asks one question, titled Confirm (its Delete the ordinary primary button)', () => {
    expect(deleteConfirmation({ name: 'Plan', hasShareLinks: false })).toEqual({
      title: DELETE_CONFIRM_TITLE,
      message: 'Delete "Plan"?',
      confirmLabel: DELETE_CONFIRM_LABEL,
    });
    expect(DELETE_CONFIRM_TITLE).toBe('Confirm');
  });

  it('adds a second line only for what applies', () => {
    expect(deleteConfirmationMessage({ name: 'Plan', hasShareLinks: true })).toBe(
      'Delete "Plan"?\nIts share links stop working.',
    );
    expect(
      deleteConfirmationMessage({
        name: 'Plan',
        hasShareLinks: false,
        sharedTabsNotice: 'Its tab "Map" stays in 1 other document.',
      }),
    ).toBe('Delete "Plan"?\nIts tab "Map" stays in 1 other document.');
    expect(deleteConfirmationMessage({ name: 'Plan', hasShareLinks: true, team: true })).toBe(
      'Delete "Plan"?\nIt is deleted for the whole team. Its share links stop working.',
    );
  });

  it('never mentions the Trash, and names a nameless document', () => {
    const message = deleteConfirmationMessage({ name: '', hasShareLinks: false });
    expect(message).toBe('Delete "this document"?');
    expect(message).not.toMatch(/Trash|restored/);
  });
});
