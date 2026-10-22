import { describe, expect, it } from 'vitest';
import type { Folder } from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { rowLocation } from './row-location';
import type { PaneDocument, SelectedNode } from './views';

// docs/specs/013-workspace/recent-folder-chip.md and explorer-structure.md "Places": a row on a view that lists more
// than one place says where it lives.
const doc = (over: Partial<PaneDocument> = {}): PaneDocument =>
  ({ id: 'd1', name: 'Doc', folderId: null, savedAt: 0, ownerId: 'me', ...over }) as PaneDocument;
const folders = new Map<string, Folder>([['f1', { id: 'f1', name: 'Plans' } as Folder]]);
const on = (selected: SelectedNode, lensActive = false) => ({
  selected,
  lensActive,
  folderById: folders,
});
const tags: SelectedNode = { kind: 'tags' };

describe('rowLocation', () => {
  it('names a document kept in this browser by that place, and opens it', () => {
    expect(rowLocation(doc({ ownerId: OFFLINE_OWNER_ID }), on(tags))).toEqual({
      label: 'This Browser',
      opens: { kind: 'offline' },
    });
  });

  it('names My Documents for a cloud document at the root, its folder or its team otherwise', () => {
    expect(rowLocation(doc(), on(tags))).toEqual({ label: 'My Documents', opens: { kind: 'all' } });
    expect(rowLocation(doc({ folderId: 'f1' }), on(tags))).toEqual({
      label: 'Plans',
      opens: { kind: 'folder', id: 'f1' },
    });
    expect(rowLocation(doc({ team: { id: 't1', name: 'Design' } }), on(tags))).toEqual({
      label: 'Design',
      opens: { kind: 'team', id: 't1' },
    });
  });

  it('shows no chip where every row sits in the view itself, or on a row shared with you', () => {
    expect(rowLocation(doc(), on({ kind: 'all' }))).toBeNull();
    const shared = doc({
      shared: { ownerName: 'A', role: 'edit', shareCode: 'x' },
    });
    expect(rowLocation(shared, on(tags))).toBeNull();
    expect(rowLocation(doc({ folderId: 'f1' }), on({ kind: 'folder', id: 'f1' }, true))).toBeNull();
  });
});
