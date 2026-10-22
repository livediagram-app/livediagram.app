// Where a listed project belongs to the reader (docs/specs/013-workspace/explorer-structure.md#projects-in-this-browser).

import { describe, expect, it } from 'vitest';
import { projectSpace, isInThisBrowser, readerAccessOf } from './project-space';

describe('isInThisBrowser', () => {
  it('recognises a project saved only in this browser', () => {
    expect(isInThisBrowser({ ownerId: 'offline' })).toBe(true);
  });

  it('rejects a cloud project', () => {
    expect(isInThisBrowser({ ownerId: 'user_1' })).toBe(false);
  });
});

describe('projectSpace', () => {
  it("counts a project in this browser as the reader's own", () => {
    expect(projectSpace({ ownerId: 'offline' })).toBe('mine');
  });

  it("counts a project in My Projects as the reader's own", () => {
    expect(projectSpace({ ownerId: 'user_1' })).toBe('mine');
  });

  it('places a team project in its team', () => {
    expect(projectSpace({ ownerId: 'user_2', team: { id: 't1', name: 'Guild' } })).toBe('team');
  });

  it('places a project shared with the reader under Shared With Me', () => {
    expect(
      projectSpace({ ownerId: '', shared: { ownerName: null, role: 'view', shareCode: 's' } }),
    ).toBe('shared');
  });
});

describe('readerAccessOf', () => {
  it('is Editor for the reader own, team and local projects, and the link role when shared', () => {
    expect(readerAccessOf({})).toBe('edit');
    expect(readerAccessOf({ shared: null })).toBe('edit');
    expect(readerAccessOf({ shared: { role: 'participate' } })).toBe('participate');
    expect(readerAccessOf({ shared: { role: 'view' } })).toBe('view');
  });
});
