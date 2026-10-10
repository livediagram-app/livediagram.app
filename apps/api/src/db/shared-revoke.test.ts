import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { deleteShareLink } from './share';
import { hasSharedAccess, listSharedWith, recordSharedAccess } from './shared';

// docs/specs/013-workspace/share-roles.md "Share links": a visit is through one link, and revoking that link
// ends the visits it granted, even while another link of the same role lives. Against real SQLite.
function arrange() {
  const db = sqliteD1();
  db.sql
    .prepare(
      `INSERT INTO documents (id, owner_id, name, saved_at, created_at, shareable)
       VALUES ('d1', 'owner', 'Plan', 1, 1, 1)`,
    )
    .run();
  const link = db.sql.prepare(
    `INSERT INTO share_links (code, document_id, role, created_at, purpose) VALUES (?, 'd1', 'edit', ?, 'share')`,
  );
  // L1 is the older link: the old rule would hand every edit visitor L1, and L2 after L1 went.
  link.run('LINKONE1', 1);
  link.run('LINKTWO2', 2);
  return db;
}

describe('a revoked share link', () => {
  it('ends the visits it granted, though another link of the role lives', async () => {
    const { env } = arrange();
    await recordSharedAccess(env, 'contractor', 'd1', 'edit', null, 'LINKONE1');
    await recordSharedAccess(env, 'colleague', 'd1', 'edit', null, 'LINKTWO2');
    expect((await listSharedWith(env, 'contractor')).map((r) => r.shareCode)).toEqual(['LINKONE1']);
    expect((await listSharedWith(env, 'colleague')).map((r) => r.shareCode)).toEqual(['LINKTWO2']);

    await deleteShareLink(env, 'LINKONE1');

    expect(await listSharedWith(env, 'contractor')).toEqual([]);
    expect(await hasSharedAccess(env, 'contractor', 'd1')).toBe(false);
    expect((await listSharedWith(env, 'colleague')).map((r) => r.shareCode)).toEqual(['LINKTWO2']);
    expect(await hasSharedAccess(env, 'colleague', 'd1')).toBe(true);
  });

  it('keeps the older rule for a visit recorded before links were', async () => {
    const { env, sql } = arrange();
    sql
      .prepare(
        `INSERT INTO shared_with (owner_id, document_id, role, last_seen) VALUES ('legacy', 'd1', 'edit', 1)`,
      )
      .run();
    expect((await listSharedWith(env, 'legacy')).map((r) => r.shareCode)).toEqual(['LINKONE1']);
    await deleteShareLink(env, 'LINKONE1');
    expect((await listSharedWith(env, 'legacy')).map((r) => r.shareCode)).toEqual(['LINKTWO2']);
  });
});
