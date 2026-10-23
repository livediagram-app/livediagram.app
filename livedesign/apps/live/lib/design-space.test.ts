// Where a listed design belongs to the reader (docs/specs/013-workspace/explorer-structure.md#designs-in-this-browser).

import { describe, expect, it } from 'vitest';
import { designSpace, isInThisBrowser, readerAccessOf } from './design-space';

describe('isInThisBrowser', () => {
  it('recognises a design saved only in this browser', () => {
    expect(isInThisBrowser({ ownerId: 'offline' })).toBe(true);
  });

  it('rejects a cloud design', () => {
    expect(isInThisBrowser({ ownerId: 'user_1' })).toBe(false);
  });
});

describe('designSpace', () => {
  it("counts a design in this browser as the reader's own", () => {
    expect(designSpace({ ownerId: 'offline' })).toBe('mine');
  });

  it("counts a design in My Work as the reader's own", () => {
    expect(designSpace({ ownerId: 'user_1' })).toBe('mine');
  });

  it('places a team design in its team', () => {
    expect(designSpace({ ownerId: 'user_2', team: { id: 't1', name: 'Guild' } })).toBe('team');
  });

  it('places a design shared with the reader under Shared With Me', () => {
    expect(
      designSpace({ ownerId: '', shared: { ownerName: null, role: 'view', shareCode: 's' } }),
    ).toBe('shared');
  });
});

describe('readerAccessOf', () => {
  it('is Editor for the reader own, team and local designs, and the link role when shared', () => {
    expect(readerAccessOf({})).toBe('edit');
    expect(readerAccessOf({ shared: null })).toBe('edit');
    expect(readerAccessOf({ shared: { role: 'participate' } })).toBe('participate');
    expect(readerAccessOf({ shared: { role: 'view' } })).toBe('view');
  });
});
