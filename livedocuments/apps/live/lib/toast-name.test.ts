import { describe, expect, it } from 'vitest';
import { TOAST_NAME_MAX, toastName } from './toast-name';
import { DOCUMENT_FAILURE, FOLDER_FAILURE } from './write-failure-copy';
import {
  documentRestoreFailedMessage,
  documentRestoredMessage,
  documentDeletedMessage,
  documentDuplicatedMessage,
  documentMovedMessage,
} from './document-toast-copy';

// docs/specs/004-interface-design/toasts.md "Naming what it acted on".
describe('toastName', () => {
  it('quotes a name and collapses its whitespace', () => {
    expect(toastName('  Q3   roadmap \n')).toBe('“Q3 roadmap”');
  });

  it('is null for a blank or missing name', () => {
    expect(toastName('')).toBeNull();
    expect(toastName('   ')).toBeNull();
    expect(toastName(null)).toBeNull();
    expect(toastName(undefined)).toBeNull();
  });

  it(`keeps a name of ${TOAST_NAME_MAX} characters whole and cuts a longer one with an ellipsis`, () => {
    const exact = 'a'.repeat(TOAST_NAME_MAX);
    expect(toastName(exact)).toBe(`“${exact}”`);
    const cut = toastName('Quarterly planning for the platform team')!;
    expect(cut).toBe('“Quarterly planning for the pl…”');
    expect(Array.from(cut.slice(1, -1))).toHaveLength(TOAST_NAME_MAX);
  });

  it('never splits an emoji and drops a space before the ellipsis', () => {
    const name = `${'x'.repeat(TOAST_NAME_MAX - 2)}🚀🚀🚀`;
    expect(toastName(name)).toBe(`“${'x'.repeat(TOAST_NAME_MAX - 2)}🚀…”`);
    expect(toastName(`${'x'.repeat(TOAST_NAME_MAX - 2)} yz`)).toBe(
      `“${'x'.repeat(TOAST_NAME_MAX - 2)}…”`,
    );
  });
});

describe('the toasts that name a document or folder', () => {
  const longest = 'W'.repeat(200);

  it('fall back to a generic word when the name is unknown', () => {
    expect(documentDeletedMessage(undefined)).toBe('Document deleted');
    expect(documentDuplicatedMessage('')).toBe('Document duplicated');
    expect(documentMovedMessage(null, 'my-documents')).toBe('Document moved to My Documents');
    expect(documentMovedMessage('Roadmap', { team: '' })).toBe(
      '“Roadmap” moved to the team library',
    );
    expect(DOCUMENT_FAILURE.move()).toBe('Could not move the document. Try again.');
    expect(FOLDER_FAILURE.delete(null)).toBe('Could not delete the folder. Try again.');
  });

  it('stay within the 90-character ceiling however long the names are', () => {
    const messages = [
      documentDeletedMessage(longest),
      documentRestoredMessage(longest),
      documentRestoreFailedMessage(longest),
      documentDuplicatedMessage(longest),
      documentMovedMessage(longest, { folder: longest }),
      documentMovedMessage(longest, { team: longest }),
      ...Object.values(DOCUMENT_FAILURE).map((copy) => copy(longest)),
      ...Object.values(FOLDER_FAILURE).map((copy) => copy(longest)),
    ];
    for (const message of messages) expect(Array.from(message).length).toBeLessThanOrEqual(90);
  });
});
