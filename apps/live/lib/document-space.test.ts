// Where a listed document belongs to the reader (docs/specs/013-workspace/explorer-structure.md#local-only-documents).

import { describe, expect, it } from 'vitest';
import { documentSpace, isLocalOnly } from './document-space';

describe('isLocalOnly', () => {
  it('recognises a document saved only in this browser', () => {
    expect(isLocalOnly({ ownerId: 'offline' })).toBe(true);
  });

  it('rejects a cloud document', () => {
    expect(isLocalOnly({ ownerId: 'user_1' })).toBe(false);
  });
});

describe('documentSpace', () => {
  it("counts a document in this browser as the reader's own", () => {
    expect(documentSpace({ ownerId: 'offline' })).toBe('mine');
  });

  it("counts a document in My documents as the reader's own", () => {
    expect(documentSpace({ ownerId: 'user_1' })).toBe('mine');
  });

  it('places a team document in its team', () => {
    expect(documentSpace({ ownerId: 'user_2', team: { id: 't1', name: 'Guild' } })).toBe('team');
  });

  it('places a document shared with the reader under Shared with me', () => {
    expect(
      documentSpace({ ownerId: '', shared: { ownerName: null, role: 'view', shareCode: 's' } }),
    ).toBe('shared');
  });
});
