// Where a listed document belongs to the reader (docs/specs/013-workspace/explorer-structure.md#documents-in-this-browser).

import { describe, expect, it } from 'vitest';
import { documentSpace, isInThisBrowser, readerAccessOf } from './document-space';

describe('isInThisBrowser', () => {
  it('recognises a document saved only in this browser', () => {
    expect(isInThisBrowser({ ownerId: 'offline' })).toBe(true);
  });

  it('rejects a cloud document', () => {
    expect(isInThisBrowser({ ownerId: 'user_1' })).toBe(false);
  });
});

describe('documentSpace', () => {
  it("counts a document in this browser as the reader's own", () => {
    expect(documentSpace({ ownerId: 'offline' })).toBe('mine');
  });

  it("counts a document in My Work as the reader's own", () => {
    expect(documentSpace({ ownerId: 'user_1' })).toBe('mine');
  });

  it('places a team document in its team', () => {
    expect(documentSpace({ ownerId: 'user_2', team: { id: 't1', name: 'Guild' } })).toBe('team');
  });

  it('places a document shared with the reader under Shared With Me', () => {
    expect(
      documentSpace({ ownerId: '', shared: { ownerName: null, role: 'view', shareCode: 's' } }),
    ).toBe('shared');
  });
});

describe('readerAccessOf', () => {
  it('is Editor for the reader own, team and local documents, and the link role when shared', () => {
    expect(readerAccessOf({})).toBe('edit');
    expect(readerAccessOf({ shared: null })).toBe('edit');
    expect(readerAccessOf({ shared: { role: 'participate' } })).toBe('participate');
    expect(readerAccessOf({ shared: { role: 'view' } })).toBe('view');
  });
});
