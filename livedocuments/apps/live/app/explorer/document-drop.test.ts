import { describe, expect, it } from 'vitest';
import { planDocumentDrop } from './document-drop';

const personalRoot = { teamId: null, folderId: null };

describe('planDocumentDrop', () => {
  it('moves a document onto another personal folder', () => {
    expect(
      planDocumentDrop({
        from: personalRoot,
        to: { teamId: null, folderId: 'f1' },
        localOnly: false,
      }),
    ).toBe('move');
  });

  it('ignores a drop onto the place the document already is', () => {
    expect(
      planDocumentDrop({
        from: { teamId: null, folderId: 'f1' },
        to: { teamId: null, folderId: 'f1' },
        localOnly: false,
      }),
    ).toBe('already-there');
    expect(
      planDocumentDrop({
        from: { teamId: 't1', folderId: null },
        to: { teamId: 't1', folderId: null },
        localOnly: false,
      }),
    ).toBe('already-there');
  });

  it('moves a document into a team and out of one', () => {
    expect(
      planDocumentDrop({
        from: personalRoot,
        to: { teamId: 't1', folderId: 'tf' },
        localOnly: false,
      }),
    ).toBe('move');
    expect(
      planDocumentDrop({
        from: { teamId: 't1', folderId: 'tf' },
        to: personalRoot,
        localOnly: false,
      }),
    ).toBe('move');
  });

  it('refuses a team destination for a document that lives only in this browser', () => {
    expect(
      planDocumentDrop({
        from: personalRoot,
        to: { teamId: 't1', folderId: null },
        localOnly: true,
      }),
    ).toBe('refused-local-only');
  });

  it('files a document that lives only in this browser into a personal folder', () => {
    expect(
      planDocumentDrop({
        from: personalRoot,
        to: { teamId: null, folderId: 'f1' },
        localOnly: true,
      }),
    ).toBe('move');
  });
});
