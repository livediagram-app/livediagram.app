// The plan against the hand-made old site (./scenario.ts): the bundle's SQL run into the new side's real schemas
// (built from this repository's migrations), so every statement is checked against the tables it writes.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MigrationPersonPayload, MigrationRoomPayload } from '@liveworkspace/migration';
import { verifySharePassword } from '../../index/src/password-hash.ts';
import { mediaGuestOwnerSync } from '../src/ids.ts';
import type { R2Entry } from '../src/plan/files.ts';
import { bundleKeys, verify, verifyQueries } from '../src/verify.ts';
import { clerkCsv, DAY, GUEST_A, NOW, newDatabases, put } from './fixture.ts';
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

describe('plan, old accounts merged into one', () => {
  it('keeps one membership per team, with the account email', async () => {
    // Bo had two old accounts, both landing on user_newbo; each was a member of team9.
    const snapshot = scenario();
    put(snapshot, 'teams', {
      id: 'team9',
      name: 'Shared',
      created_at: NOW - 10 * DAY,
      updated_at: NOW - 10 * DAY,
    });
    for (const [id, user, email, age] of [
      ['m6', 'user_bo2', 'bo.old@example.com', 9],
      ['m7', 'user_bo', 'bo@example.com', 8],
    ] as const) {
      put(snapshot, 'team_members', {
        id,
        team_id: 'team9',
        user_id: user,
        email,
        role: 'admin',
        created_at: NOW - age * DAY,
        updated_at: NOW - age * DAY,
        status: 'joined',
      });
    }
    const clerk = clerkCsv([
      { id: 'user_ali', email: 'ali@example.com', first: 'Ali', last: 'Khan' },
      { id: 'user_bo', email: 'Bo@Example.com', first: 'Bo', last: 'Li' },
      { id: 'user_bo2', email: 'bo@example.com', first: 'Bo', last: 'Li' },
      { id: 'user_cy', email: 'cy@example.com', first: 'Cy' },
    ]);
    const { outDir, manifest } = await planScenario(snapshot, { clerkCsv: clerk });
    const dbs = seedNewSide();
    runSql(outDir, manifest, dbs);
    expect(
      all(dbs.accounts, "SELECT id, userId, email FROM team_member WHERE teamId = 'team9'"),
    ).toEqual([{ id: 'm6', userId: 'user_newbo', email: 'bo@example.com' }]);
    const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as {
      skipped: { items: { what: string; id: string }[] };
    };
    expect(report.skipped.items).toContainEqual(
      expect.objectContaining({ what: 'team_member', id: 'm7' }),
    );
  });
});

describe('plan, first run', async () => {
  const { manifest, outDir } = await planScenario(scenario());
  const dbs = seedNewSide();
  runSql(outDir, manifest, dbs);
  const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as {
    counts: Record<string, number>;
    shareCodeCaseCollisions: { items: unknown[] };
    imageCollisions: { items: unknown[] };
    droppedHistory: Record<string, number>;
    skipped: { items: { what: string; id: string; why: string }[] };
  };

  it('writes the bundle the spec lays out, steps in apply order', () => {
    expect(manifest.steps.map((s) => (s.step === 'sql' ? `sql:${s.db}` : s.step))).toEqual([
      'sql:accounts',
      'sql:index',
      'sql:media',
      'r2',
      'rooms',
      'people',
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
      'people/people.jsonl',
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
      // A pending invitation keeps its reminder clock; one from before the clock starts at its invitation.
      {
        id: 'm3',
        email: 'new@x.com',
        status: 'invited',
        clockStartedAt: NOW - 2 * DAY,
        expiredAt: null,
      },
      {
        id: 'm4',
        email: 'old@x.com',
        status: 'declined',
        clockStartedAt: null,
        expiredAt: NOW - 8 * DAY,
      },
      {
        id: 'm5',
        email: 'early@x.com',
        status: 'invited',
        clockStartedAt: NOW - 4 * DAY,
        expiredAt: null,
      },
    ]);
    // The old reminder stamps come too, so the sweep sends none twice.
    expect(
      all(dbs.accounts, "SELECT reminder1SentAt, reminder2SentAt FROM team_member WHERE id = 'm3'"),
    ).toEqual([{ reminder1SentAt: NOW - DAY, reminder2SentAt: null }]);
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
    expect(byScope['liveplanner.app']).toEqual({
      notifyFormResponses: false,
      planTourSeen: true,
      planTourTracks: ['boards'],
      formTourSeen: true,
    });
    // The Pages tour goes to both apps that have one, each with its own page kinds; the logo guides to livedesign.
    expect(byScope['livedocuments.app']).toEqual({
      pagesTourSeen: false,
      pagesTourKinds: ['slide'],
    });
    expect(byScope['livedesign.app']).toEqual({
      pagesTourSeen: false,
      pagesTourKinds: ['logo'],
      logoGuides: false,
      logoGuidesHidden: ['grid'],
      logoGuideStrength: 'faint',
    });
    for (const key of ['planTourSeen', 'pagesTourSeen', 'logoGuides', 'recentExcludedIds'])
      expect(byScope['livediagram.app'], key).not.toHaveProperty(key);
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
        "SELECT id, app, item_id, type, detail, occurred_at FROM timeline_events WHERE id IN ('imp:e1', 'imp:e2', 'imp:e3', 'imp:e4') ORDER BY id",
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

  it('maps the old kinds the index has under another name', () => {
    const rows = all<{
      id: string;
      app: string;
      item_id: string | null;
      actor_id: string | null;
      actor_name: string | null;
      type: string;
      title: string;
      detail: string;
    }>(
      dbs.index,
      "SELECT id, app, item_id, actor_id, actor_name, type, title, detail FROM timeline_events WHERE id NOT IN ('imp:e1', 'imp:e2', 'imp:e4') ORDER BY CAST(substr(id, 6) AS INTEGER)",
    );
    expect(rows.map((r) => [r.id, r.app, r.item_id, r.type])).toEqual([
      ['imp:e5', 'livediagram', 'doc-diagram', 'opened_by_visitor'],
      ['imp:e6', 'livediagram', 'doc-diagram', 'copied_by_visitor'],
      ['imp:e7', 'livediagram', 'doc-diagram', 'synced'],
      ['imp:e8', 'livediagram', null, 'taken_offline'],
      ['imp:e9', 'livediagram', null, 'taken_offline'],
      ['imp:e10', 'liveworkspace', null, 'team_joined'],
      ['imp:e11', 'liveworkspace', null, 'team_member_removed'],
      ['imp:e12', 'liveworkspace', null, 'team_member_removed'],
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    // A visitor with no identity has no actor, but keeps the name the old event had.
    expect(by['imp:e5']).toMatchObject({ actor_id: null, actor_name: 'Visitor' });
    // Taken offline names the document as it was, from its snapshot or, failing that, its description.
    expect(by['imp:e8']!.title).toBe('Offline plan');
    expect(by['imp:e9']!.title).toBe('Described');
    // A member leaving reads as Member Left (the Explorer's `left`), with the team and name it had.
    expect(JSON.parse(by['imp:e11']!.detail)).toEqual({
      imported: '1',
      left: '1',
      teamId: 'team1',
      memberName: 'Bo',
    });
    expect(JSON.parse(by['imp:e12']!.detail)).toMatchObject({ left: '1', teamId: null });
    expect(
      all(dbs.index, "SELECT scope FROM timeline_event_scopes WHERE event_id = 'imp:e8'"),
    ).toEqual([{ scope: 'p:user_ali' }]);
  });

  it('marks what each person hid from Recent on their opens row, opened or not', () => {
    expect(
      all(
        dbs.index,
        "SELECT person_id, item_id, last_opened_at, hidden FROM opens WHERE item_id IN ('doc-diagram', 'doc-slides') ORDER BY item_id, person_id",
      ),
    ).toEqual([
      { person_id: 'user_ali', item_id: 'doc-diagram', last_opened_at: NOW - 200 * DAY, hidden: 1 },
      { person_id: 'user_newbo', item_id: 'doc-diagram', last_opened_at: NOW - 2 * DAY, hidden: 0 },
      { person_id: 'user_ali', item_id: 'doc-slides', last_opened_at: 0, hidden: 1 },
    ]);
    // A hide with no open counts no day towards Most Used.
    expect(all(dbs.index, "SELECT 1 FROM use_days WHERE item_id = 'doc-slides'")).toEqual([]);
  });

  it('sends each person’s shape libraries to livediagram’s person door, through the owner map', () => {
    const lines = readFileSync(join(outDir, 'people', 'people.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as [string, string, string]);
    expect(lines.map(([app, id]) => [app, id])).toEqual([
      ['livediagram', 'user_ali'],
      ['livediagram', 'user_cy'],
    ]);
    const ali = JSON.parse(
      readFileSync(join(outDir, 'people', 'livediagram', 'user_ali.json'), 'utf8'),
    ) as MigrationPersonPayload;
    expect(ali).toEqual({
      v: 1,
      app: 'livediagram',
      personId: 'user_ali',
      shapeLibraries: [
        {
          id: 'lib-a1',
          name: 'Icons',
          source: 'drawio',
          items: '[{"id":"s1"}]',
          createdAt: NOW - 6 * DAY,
          updatedAt: NOW - 6 * DAY + 1,
        },
        {
          id: 'lib-a2',
          name: 'Flows',
          source: 'drawio',
          items: '[{"id":"s1"}]',
          createdAt: NOW - 5 * DAY,
          updatedAt: NOW - 5 * DAY + 1,
        },
      ],
    });
    expect(report.skipped.items).toContainEqual({
      what: 'shape_library',
      id: 'lib-zz',
      why: 'no account',
    });
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
    // Its opens row (Ali hid it from Recent) goes with it.
    expect(after.map((t) => [t.table, t.missing, t.sample])).toEqual([
      ['items', 1, ['doc-slides']],
      ['opens', 1, ['user_ali|doc-slides']],
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
