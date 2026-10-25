// The plan against the hand-made old site (./scenario.ts): the bundle's SQL run into the new side's real schemas
// (built from this repository's migrations), so every statement is checked against the tables it writes.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MigrationRoomPayload } from '@liveworkspace/migration';
import { verifySharePassword } from '../../index/src/password-hash.ts';
import { mediaGuestOwnerSync } from '../src/ids.ts';
import type { R2Entry } from '../src/plan/files.ts';
import { bundleKeys, verify, verifyQueries } from '../src/verify.ts';
import { DAY, GUEST_A, NOW, newDatabases, put } from './fixture.ts';
import { all, planScenario, recordApplied, runSql, tempDir } from './helpers.ts';
import { scenario } from './scenario.ts';

const seedNewSide = () => {
  const dbs = newDatabases();
  // Bo's account was made on the new side before the migration.
  dbs.accounts.exec(
    `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES ('user_newbo', 'Bo', 'bo@example.com', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  );
  return dbs;
};

const room = (outDir: string, app: string, id: string) =>
  JSON.parse(
    readFileSync(join(outDir, 'rooms', app, `${id}.json`), 'utf8'),
  ) as MigrationRoomPayload;

function filesOf(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p)] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

describe('plan, first run', async () => {
  const { manifest, outDir } = await planScenario(scenario());
  const dbs = seedNewSide();
  runSql(outDir, manifest, dbs);
  const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as {
    counts: Record<string, number>;
    shareCodeCaseCollisions: { items: unknown[] };
    imageCollisions: { items: unknown[] };
    droppedHistory: Record<string, number>;
    skipped: { items: { what: string; id: string }[] };
  };

  it('writes the bundle the spec lays out, steps in apply order', () => {
    expect(manifest.steps.map((s) => (s.step === 'sql' ? `sql:${s.db}` : s.step))).toEqual([
      'sql:accounts',
      'sql:index',
      'sql:media',
      'r2',
      'rooms',
      'sql:community',
      'kv',
    ]);
    for (const f of [
      'owner-map.json',
      'manifest.json',
      'report.json',
      'moved-parts.json',
      'r2/images.json',
      'kv/mcp-clients.json',
      'rooms/rooms.jsonl',
    ]) {
      expect(statSync(join(outDir, f)).isFile()).toBe(true);
    }
  });

  it('maps a Clerk account whose email the new side already has onto that account, everywhere', () => {
    const map = JSON.parse(readFileSync(join(outDir, 'owner-map.json'), 'utf8')) as {
      accounts: Record<string, string>;
    };
    expect(map.accounts).toMatchObject({
      user_ali: 'user_ali',
      user_bo: 'user_newbo',
      user_cy: 'user_cy',
    });
    expect(all(dbs.accounts, 'SELECT id FROM "user" ORDER BY id').map((r) => r.id)).toEqual([
      'user_ali',
      'user_cy',
      'user_newbo',
    ]);
    expect(all(dbs.index, 'SELECT person_id FROM favourites')).toEqual([
      { person_id: 'user_newbo' },
    ]);
    expect(all(dbs.accounts, "SELECT userId FROM team_member WHERE id = 'm2'")).toEqual([
      { userId: 'user_newbo' },
    ]);
  });

  it('gives a team creator row without an email its account email, and maps old invitation states', () => {
    const members = all<{
      id: string;
      email: string;
      status: string;
      clockStartedAt: number | null;
      expiredAt: number | null;
    }>(
      dbs.accounts,
      'SELECT id, email, status, clockStartedAt, expiredAt FROM team_member ORDER BY id',
    );
    expect(members).toEqual([
      {
        id: 'm1',
        email: 'ali@example.com',
        status: 'joined',
        clockStartedAt: null,
        expiredAt: null,
      },
      {
        id: 'm2',
        email: 'bo@example.com',
        status: 'joined',
        clockStartedAt: null,
        expiredAt: null,
      },
      { id: 'm3', email: 'new@x.com', status: 'invited', clockStartedAt: null, expiredAt: null },
      {
        id: 'm4',
        email: 'old@x.com',
        status: 'declined',
        clockStartedAt: null,
        expiredAt: NOW - 8 * DAY,
      },
    ]);
    // Every team write took a rev from team_seq, as the accounts Worker's own do.
    const seq = all<{ value: number }>(dbs.accounts, 'SELECT value FROM team_seq')[0]!.value;
    expect(seq).toBeGreaterThan(0);
    expect(all(dbs.accounts, 'SELECT MAX(rev) AS r FROM team_member')[0]!.r).toBeLessThanOrEqual(
      seq,
    );
  });

  it('copies only live tokens, with their lvd_ hashes, a name for an unnamed one, and none for a missing account', () => {
    expect(
      all(
        dbs.accounts,
        'SELECT id, userId, tokenHash, name, readOnly, revokedAt FROM api_token ORDER BY id',
      ),
    ).toEqual([
      {
        id: 'tk-live',
        userId: 'user_ali',
        tokenHash: 'lvd_hash_live',
        name: 'CLI',
        readOnly: 1,
        revokedAt: null,
      },
      {
        id: 'tk-unnamed',
        userId: 'user_newbo',
        tokenHash: 'lvd_hash_bo',
        name: 'API token',
        readOnly: 0,
        revokedAt: null,
      },
    ]);
    expect(report.skipped.items).toContainEqual(
      expect.objectContaining({ what: 'api_token', id: 'tk-ghost' }),
    );
  });

  it('splits old preferences into the new scopes under their current names', () => {
    const rows = all<{ scope: string; prefs: string }>(
      dbs.accounts,
      "SELECT scope, prefs FROM settings WHERE owner_id = 'user_ali' ORDER BY scope",
    );
    const byScope = Object.fromEntries(
      rows.map((r) => [r.scope, JSON.parse(r.prefs) as Record<string, unknown>]),
    );
    expect(byScope['livediagram.app']).toMatchObject({ notifyDocumentJoin: false });
    expect(byScope['liveplanner.app']).toEqual({ notifyFormResponses: false });
    expect(JSON.stringify(byScope)).not.toContain('planModeEnabled');
    expect(JSON.stringify(byScope)).not.toContain('notifyDiagramJoin');
  });

  it('stamps every onboarding email already due, so the import sends none', () => {
    const [ali] = all<Record<string, number | null>>(
      dbs.accounts,
      "SELECT * FROM email_lifecycle WHERE user_id = 'user_ali'",
    );
    expect(ali).toMatchObject({
      welcome_sent_at: NOW - 199 * DAY,
      week1_sent_at: NOW - 193 * DAY,
      week2_sent_at: NOW,
      activation_sent_at: NOW,
      signup_app: 'livediagram.app',
    });
    // Bo's account was already on the new side with no old row: its series is left as it stands.
    expect(all(dbs.accounts, "SELECT 1 FROM email_lifecycle WHERE user_id = 'user_newbo'")).toEqual(
      [],
    );
  });

  it("writes each guest a legacy_guest row and keeps a guest's document under its new guest id", () => {
    const guest = `guest_${GUEST_A}`;
    expect(all(dbs.accounts, 'SELECT id, claimedAt FROM legacy_guest')).toEqual([
      { id: guest, claimedAt: null },
    ]);
    expect(all(dbs.accounts, 'SELECT owner_id, name FROM profile')).toEqual([
      { owner_id: guest, name: 'Quiet Fox' },
    ]);
    expect(all(dbs.index, "SELECT owner_id, scope FROM items WHERE id = 'doc-guest'")).toEqual([
      { owner_id: guest, scope: `p:${guest}` },
    ]);
    expect(room(outDir, 'livediagram', 'doc-guest').ownerId).toBe(guest);
    // Its image belongs to the guest as the media service keys guests.
    expect(all(dbs.media, "SELECT owner FROM images WHERE id = 'img-2'")).toEqual([
      { owner: mediaGuestOwnerSync('livediagram.app', guest) },
    ]);
    // An aliased guest's document is its account's, and no legacy guest is made for it.
    expect(all(dbs.index, "SELECT owner_id FROM items WHERE id = 'doc-alias'")).toEqual([
      { owner_id: 'user_cy' },
    ]);
  });

  it('splits a mixed document into one item per app, each with the same name, team and sharing', () => {
    const parts = all<{
      id: string;
      app: string;
      kind: string;
      scope: string;
      title: string;
      summary: string;
    }>(
      dbs.index,
      "SELECT id, app, kind, scope, title, summary FROM items WHERE title = 'Launch' ORDER BY app",
    );
    expect(parts.map((p) => [p.app, p.kind, p.scope])).toEqual([
      ['livediagram', 'canvas', 't:team1'],
      ['livedocuments', 'document', 't:team1'],
      ['liveplanner', 'plan', 't:team1'],
    ]);
    expect(parts.every((p) => p.summary === '{"imported":"1"}')).toBe(true);
    expect(parts.find((p) => p.app === 'livediagram')!.id).toBe('doc-mixed');
    const moved = JSON.parse(readFileSync(join(outDir, 'moved-parts.json'), 'utf8')) as {
      oldId: string;
    }[];
    expect(moved.map((m) => m.oldId)).toEqual(['doc-mixed']);
    // Cy, who it was shared with, sees every part in Shared with me, each through a link of its own item.
    const shared = all<{ item_id: string; share_code: string }>(
      dbs.index,
      "SELECT item_id, share_code FROM shared_with WHERE person_id = 'user_cy'",
    );
    expect(shared).toHaveLength(3);
    for (const s of shared) {
      expect(
        all(dbs.index, 'SELECT item_id FROM share_links WHERE code = ?', s.share_code),
      ).toEqual([{ item_id: s.item_id }]);
    }
    // A tab's link goes to the part holding the tab.
    const board = parts.find((p) => p.app === 'liveplanner')!;
    expect(
      all(
        dbs.index,
        "SELECT item_id, tab_id, expiry FROM share_links WHERE code = 'MIXEDTAB234567'",
      ),
    ).toEqual([{ item_id: board.id, tab_id: 'tb', expiry: 'week' }]);
    expect(room(outDir, 'liveplanner', board.id).plan?.items.map((i) => i.id)).toEqual(['card1']);
  });

  it('draws the picture a frozen tab window keeps, uploads it and points the slot at it', () => {
    const docs = all<{ id: string }>(
      dbs.index,
      "SELECT id FROM items WHERE app = 'livedocuments' AND title = 'Launch'",
    )[0]!;
    const part = room(outDir, 'livedocuments', docs.id);
    const slot = (
      JSON.parse(part.tabs[0]!.data) as {
        elements: { id: string; type: string; imageId: string | null }[];
      }
    ).elements[0]!;
    expect(slot).toMatchObject({ id: 'w1', type: 'image' });
    expect(slot.imageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(part.imageOwners).toEqual([{ imageId: slot.imageId, owner: 'user_ali' }]);
    expect(
      all(dbs.media, 'SELECT app, owner, width FROM images WHERE id = ?', slot.imageId),
    ).toEqual([{ app: 'livedocuments.app', owner: 'user_ali', width: 64 }]);
    expect(
      all(dbs.media, 'SELECT app, document FROM refs WHERE image_id = ?', slot.imageId),
    ).toEqual([{ app: 'livedocuments.app', document: docs.id }]);
    const r2 = JSON.parse(readFileSync(join(outDir, 'r2', 'images.json'), 'utf8')) as R2Entry[];
    const entry = r2.find((e) => e.key === slot.imageId)!;
    expect(readFileSync(join(outDir, entry.file!)).toString()).toBe('png:doc-mixed:td:null');
  });

  it('upper-cases share codes and reports the one that only differed by case', () => {
    expect(all(dbs.index, "SELECT item_id FROM share_links WHERE code = 'ABCDEFGH234567'")).toEqual(
      [{ item_id: 'doc-diagram' }],
    );
    expect(report.shareCodeCaseCollisions.items).toEqual([
      { code: 'ABCDEFGH234567', kept: 'abcdefgh234567', document: 'doc-mixed' },
    ]);
    // The person it was shared with reaches it through the kept code.
    expect(
      all(dbs.index, "SELECT share_code FROM shared_with WHERE item_id = 'doc-diagram'"),
    ).toEqual([{ share_code: 'ABCDEFGH234567' }]);
  });

  it('hashes a plain share password the way the index checks it', async () => {
    const [row] = all<{ hash: string }>(
      dbs.index,
      "SELECT hash FROM share_passwords WHERE item_id = 'doc-diagram'",
    );
    expect(await verifySharePassword(row!.hash, 'hunter2')).toBe(true);
    expect(await verifySharePassword(row!.hash, 'nope')).toBe(false);
  });

  it('carries history with its old times as imported, and reports what has no new kind', () => {
    expect(
      all(
        dbs.index,
        'SELECT id, app, item_id, type, detail, occurred_at FROM timeline_events ORDER BY id',
      ),
    ).toEqual([
      {
        id: 'imp:e1',
        app: 'livediagram',
        item_id: 'doc-diagram',
        type: 'created',
        detail: '{"imported":"1"}',
        occurred_at: NOW - 9 * DAY,
      },
      {
        id: 'imp:e2',
        app: 'liveworkspace',
        item_id: null,
        type: 'team_joined',
        detail: '{"imported":"1"}',
        occurred_at: NOW - 9 * DAY,
      },
      {
        id: 'imp:e4',
        app: 'livediagram',
        item_id: 'doc-mixed',
        type: 'edited',
        detail: '{"imported":"1"}',
        occurred_at: NOW - 8 * DAY,
      },
    ]);
    expect(
      all(
        dbs.index,
        "SELECT scope FROM timeline_event_scopes WHERE event_id = 'imp:e1' ORDER BY scope",
      ),
    ).toEqual([{ scope: 'p:user_ali' }, { scope: 'p:user_newbo' }]);
    expect(report.droppedHistory).toEqual({ theme_created: 1 });
  });

  it('keeps Recent and only the last 90 days of Most Used', () => {
    expect(
      all(
        dbs.index,
        "SELECT person_id FROM opens WHERE item_id = 'doc-diagram' ORDER BY person_id",
      ),
    ).toEqual([{ person_id: 'user_ali' }, { person_id: 'user_newbo' }]);
    expect(all(dbs.index, "SELECT person_id FROM use_days WHERE item_id = 'doc-diagram'")).toEqual([
      { person_id: 'user_newbo' },
    ]);
  });

  it('reports the image that collides once an aliased guest is its account', () => {
    expect(report.imageCollisions.items).toEqual([
      { image: 'img-4', keptImage: 'img-3', owner: 'user_cy' },
    ]);
  });

  it('carries the Community post, its tags, likes, copies and reports', () => {
    expect(
      all(
        dbs.community,
        'SELECT id, app, document, share_code, owner, author_name, document_state FROM posts',
      ),
    ).toEqual([
      {
        id: 'post1',
        app: 'livediagram.app',
        document: 'doc-guest',
        share_code: 'COMMUNITY23456',
        owner: `guest_${GUEST_A}`,
        author_name: 'Quiet Fox',
        document_state: 'public',
      },
    ]);
    for (const t of ['post_tags', 'likes', 'copies', 'reports'])
      expect(all(dbs.community, `SELECT 1 FROM ${t}`)).toHaveLength(1);
  });

  it('finds nothing missing on verify, and names a row that goes missing', async () => {
    const queries = verifyQueries(bundleKeys(outDir));
    const execute = async (db: keyof typeof dbs, sql: string) => Promise.resolve(all(dbs[db], sql));
    expect((await verify(queries, execute)).filter((t) => t.missing > 0)).toEqual([]);
    dbs.index.exec("DELETE FROM items WHERE id = 'doc-slides'");
    const after = (await verify(queries, execute)).filter((t) => t.missing > 0);
    expect(after.map((t) => [t.table, t.missing, t.sample])).toEqual([
      ['items', 1, ['doc-slides']],
    ]);
  });

  it('plans the same bundle twice from the same snapshot', async () => {
    const again = await planScenario(scenario());
    expect(filesOf(again.outDir)).toEqual(filesOf(outDir));
  });
});

describe('plan, catch-up run', () => {
  it('rewrites what changed on the old side, but never a row someone changed on the new side since', async () => {
    const ledgerPath = join(tempDir('ledger'), 'ledger.sqlite');
    const old = scenario();
    const first = await planScenario(old);
    const dbs = seedNewSide();
    runSql(first.outDir, first.manifest, dbs);
    recordApplied(first.outDir, first.manifest, ledgerPath);

    // On the old site: both teams renamed, a document renamed, a token revoked, a new document.
    old.exec(`UPDATE teams SET name = name || ' 2', updated_at = ${NOW - DAY}`);
    old.exec(
      `UPDATE documents SET name = 'Roadmap v2', saved_at = ${NOW - DAY} WHERE id IN ('doc-diagram', 'doc-guest')`,
    );
    old.exec("UPDATE api_tokens SET revoked = 1 WHERE id = 'tk-live'");
    put(old, 'documents', {
      id: 'doc-new',
      owner_id: 'user_ali',
      name: 'New',
      saved_at: NOW - DAY,
      created_at: NOW - DAY,
    });
    // On the new side, since the first run: someone renamed team2 and doc-guest.
    dbs.accounts.exec(
      `UPDATE team SET name = 'Ops (renamed here)', updatedAt = ${NOW + DAY} WHERE id = 'team2'`,
    );
    dbs.index.exec(
      `UPDATE items SET title = 'Renamed here', updated_at = ${NOW + DAY} WHERE id = 'doc-guest'`,
    );

    const second = await planScenario(old, { ledgerPath });
    expect(second.manifest.ledgerGeneration).toBe(1);
    runSql(second.outDir, second.manifest, dbs);
    expect(all(dbs.accounts, 'SELECT id, name FROM team ORDER BY id')).toEqual([
      { id: 'team1', name: 'Design 2' },
      { id: 'team2', name: 'Ops (renamed here)' },
    ]);
    expect(
      all(
        dbs.index,
        "SELECT id, title FROM items WHERE id IN ('doc-diagram', 'doc-guest', 'doc-new') ORDER BY id",
      ),
    ).toEqual([
      { id: 'doc-diagram', title: 'Roadmap v2' },
      { id: 'doc-guest', title: 'Renamed here' },
      { id: 'doc-new', title: 'New' },
    ]);
    expect(all(dbs.accounts, "SELECT revokedAt FROM api_token WHERE id = 'tk-live'")).toEqual([
      { revokedAt: NOW },
    ]);
    // Rooms and rows that didn't change aren't sent again.
    const lines = readFileSync(join(second.outDir, 'rooms', 'rooms.jsonl'), 'utf8')
      .trim()
      .split('\n');
    expect(lines.map((l) => (JSON.parse(l) as string[])[1]).sort()).toEqual([
      'doc-diagram',
      'doc-guest',
      'doc-new',
    ]);
    const report = JSON.parse(readFileSync(join(second.outDir, 'report.json'), 'utf8')) as {
      tables: { index: { favourites?: { unchanged: number } } };
    };
    expect(report.tables.index.favourites?.unchanged).toBe(1);
  });
});
