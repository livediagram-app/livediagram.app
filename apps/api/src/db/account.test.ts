import { describe, expect, it, vi } from 'vitest';
import { deleteAccount } from './account';
import type { Runtime } from '../types';

// deleteAccount wipes an owner's D1 rows AND the R2 objects the cascade
// can't reach: image bytes (keyed by image id) and document SVG snapshots
// (docs/specs/006-document/document-snapshots.md, keyed thumb/<documentId>). A bulk `DELETE FROM documents` drops
// the ids, so the snapshot keys must be enumerated + deleted first or
// they orphan in R2. These pin that cleanup with a fake D1 + R2.

function fakeEnv(opts: {
  documentIds?: string[];
  imageIds?: string[];
  images?: { delete: (keys: string[]) => Promise<void> };
  sqlLog?: string[];
}): Runtime {
  const prepare = (sql: string) => {
    opts.sqlLog?.push(sql);
    return {
      bind: () => ({
        all: async () => {
          if (sql.includes('FROM images')) {
            return { results: (opts.imageIds ?? []).map((id) => ({ id })) };
          }
          if (sql.includes('FROM documents')) {
            return { results: (opts.documentIds ?? []).map((id) => ({ id })) };
          }
          return { results: [] };
        },
        first: async () => null,
        run: async () => ({ meta: { changes: 1 } }),
      }),
    };
  };
  const batch = (stmts: { run: () => Promise<unknown> }[]) =>
    Promise.all(stmts.map((s) => s.run()));
  return { db: { prepare, batch }, objects: opts.images } as unknown as Runtime;
}

describe('deleteAccount snapshot cleanup (docs/specs/006-document/document-snapshots.md)', () => {
  it("bulk-deletes each document's snapshots (its own and the Community's) from R2", async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const env = fakeEnv({ documentIds: ['d1', 'd2'], imageIds: ['i1'], images: { delete: del } });

    await deleteAccount(env, 'owner-1');

    // Image bytes AND document snapshots both leave R2.
    expect(del).toHaveBeenCalledWith(['i1']);
    expect(del).toHaveBeenCalledWith([
      'thumb/d1',
      'thumb-community/d1',
      'thumb/d2',
      'thumb-community/d2',
    ]);
  });

  it('skips R2 cleanup when no bucket is bound (self-host) without throwing', async () => {
    const env = fakeEnv({ documentIds: ['d1'], imageIds: ['i1'], images: undefined });
    await expect(deleteAccount(env, 'owner-1')).resolves.toMatchObject({
      documents: expect.any(Number),
    });
  });

  it('makes no snapshot delete when the owner has no documents', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const env = fakeEnv({ documentIds: [], imageIds: [], images: { delete: del } });

    await deleteAccount(env, 'owner-1');

    expect(del).not.toHaveBeenCalled();
  });
});

describe('deleteAccount leaves team folders to the team (docs/specs/013-workspace/team-shared-documents.md)', () => {
  it('deletes only personal folders', async () => {
    // A team folder carries its creator's owner_id, but teammates' documents
    // live in it; wiping it on the creator's account delete dropped them out
    // of the team library.
    const sqlLog: string[] = [];
    await deleteAccount(fakeEnv({ sqlLog }), 'owner-1');
    const folderDeletes = sqlLog.filter((q) => /DELETE FROM folders/.test(q));
    expect(folderDeletes).toEqual(['DELETE FROM folders WHERE owner_id = ? AND team_id IS NULL']);
  });
});
