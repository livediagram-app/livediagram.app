import { describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { TRASH_RETENTION_MS } from '@livedesign/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { DAY, T0, liveDoc, insert, team } from './test-trash-fixtures';
import type { Env } from '../types';
import { deleteAccount } from './account';
import { purgeRooms } from '../room-purge-client';

// The rooms are another worker's storage; here only whether they are asked to purge is pinned.
vi.mock('../room-purge-client', () => ({
  purgeRooms: vi.fn(() => Promise.resolve({ rooms: 0, unreached: 0 })),
}));
import {
  getDesign,
  getDesignMeta,
  listDesignsByOwner,
  listDesignsByTeam,
} from './designs';
import { deleteFolder } from './folders';
import { linkTabToDesign, upsertTab } from './tabs';
import {
  getTrashedDesignMeta,
  listTrash,
  purgeDesigns,
  purgeExpiredTrash,
  restoreDesign,
  trashDesign,
  trashedIdsIn,
} from './trash';

// The Trash (docs/specs/013-workspace/trash.md), proven on a real SQLite with
// every migration applied: trashing stamps a time and hides the design,
// restoring puts it back where it was, and the purge removes it the way a
// delete always has, shared tabs spared.

function folder(sql: DatabaseSync, id: string, owner = 'owner', team: string | null = null) {
  insert(sql, 'folders', {
    id,
    owner_id: owner,
    name: id,
    team_id: team,
    created_at: T0,
    updated_at: T0,
  });
}

async function tab(db: SqliteD1, designId: string, id: string) {
  await upsertTab(db.env, designId, { id, name: id, elements: [] }, 0);
}

function column(sql: DatabaseSync, id: string, name: string): unknown {
  return sql.prepare(`SELECT ${name} AS v FROM designs WHERE id = ?`).get(id)?.v;
}

function count(sql: DatabaseSync, table: string, where: string, ...args: string[]): number {
  return Number(sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args)?.n);
}

function withImages() {
  const del = vi.fn(async () => {});
  const db = sqliteD1({ IMAGES: { delete: del } as unknown as Env['IMAGES'] });
  return { db, del };
}

describe('diagrams.trashed_at', () => {
  it('adds a nullable trashed_at with a partial index', () => {
    const { sql } = sqliteD1();
    const col = sql
      .prepare('PRAGMA table_info(designs)')
      .all()
      .find((c) => c.name === 'trashed_at');
    expect(col).toMatchObject({ type: 'INTEGER', notnull: 0, dflt_value: null });
    const idx = sql
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'designs_trashed_idx'")
      .get()?.sql as string;
    expect(idx).toContain('WHERE trashed_at IS NOT NULL');
  });
});

describe('trashDesign', () => {
  it('stamps the time and hides the design from every design read', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    liveDoc(sql, 'T', { team: 'team' });

    expect(await trashDesign(env, 'A', T0)).toBe(true);
    expect(await trashDesign(env, 'T', T0)).toBe(true);

    expect(column(sql, 'A', 'trashed_at')).toBe(T0);
    expect(await getDesign(env, 'A')).toBeNull();
    expect(await getDesignMeta(env, 'A')).toBeNull();
    expect(await listDesignsByOwner(env, 'owner')).toEqual([]);
    expect(await listDesignsByTeam(env, 'team')).toEqual([]);
  });

  it('keeps the first deletion time when trashed again', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    await trashDesign(env, 'A', T0);

    expect(await trashDesign(env, 'A', T0 + DAY)).toBe(false);
    expect(column(sql, 'A', 'trashed_at')).toBe(T0);
  });

  it('reports a missing design', async () => {
    const { env } = sqliteD1();
    expect(await trashDesign(env, 'nope', T0)).toBe(false);
  });

  it('leaves tabs, links, share links and stars in place', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');
    insert(db.sql, 'share_links', {
      code: 'code1',
      design_id: 'A',
      role: 'edit',
      created_at: T0,
    });
    insert(db.sql, 'favourites', { owner_id: 'owner', design_id: 'A', created_at: T0 });

    await trashDesign(db.env, 'A', T0);

    expect(count(db.sql, 'tabs', 'id = ?', 't1')).toBe(1);
    expect(count(db.sql, 'design_tabs', 'design_id = ?', 'A')).toBe(1);
    expect(count(db.sql, 'share_links', 'design_id = ?', 'A')).toBe(1);
    expect(count(db.sql, 'favourites', 'design_id = ?', 'A')).toBe(1);
  });
});

describe('getTrashedDesignMeta', () => {
  it('reads a trashed design and nothing else', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A', { team: 'team' });
    liveDoc(sql, 'live');
    await trashDesign(env, 'A', T0);

    expect(await getTrashedDesignMeta(env, 'A')).toEqual({
      id: 'A',
      ownerId: 'owner',
      teamId: 'team',
      name: 'Design A',
      trashedAt: T0,
    });
    expect(await getTrashedDesignMeta(env, 'live')).toBeNull();
    expect(await getTrashedDesignMeta(env, 'nope')).toBeNull();
  });
});

describe('trashedIdsIn', () => {
  it('names the trashed ids among the given ones', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    liveDoc(sql, 'B');
    await trashDesign(env, 'A', T0);

    expect([...(await trashedIdsIn(env, ['A', 'B', 'nope']))]).toEqual(['A']);
    expect([...(await trashedIdsIn(env, []))]).toEqual([]);
  });
});

describe('restoreDesign', () => {
  it('returns the design to its folder', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'F');
    liveDoc(sql, 'A', { folder: 'F' });
    await trashDesign(env, 'A', T0);

    expect(await restoreDesign(env, 'A', T0 + DAY)).toBe(true);

    expect(column(sql, 'A', 'trashed_at')).toBeNull();
    expect((await getDesign(env, 'A'))?.folderId).toBe('F');
  });

  it('lands at the root when its top-level folder was deleted meanwhile', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'F');
    liveDoc(sql, 'A', { folder: 'F' });
    await trashDesign(env, 'A', T0);
    await deleteFolder(env, 'F');

    await restoreDesign(env, 'A', T0 + DAY);

    expect((await getDesign(env, 'A'))?.folderId).toBeNull();
  });

  it('lands in the deleted folder’s parent when that folder was nested', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'P');
    folder(sql, 'F');
    sql.prepare("UPDATE folders SET parent_id = 'P' WHERE id = 'F'").run();
    liveDoc(sql, 'A', { folder: 'F' });
    await trashDesign(env, 'A', T0);
    await deleteFolder(env, 'F');

    await restoreDesign(env, 'A', T0 + DAY);

    expect((await getDesign(env, 'A'))?.folderId).toBe('P');
  });

  it('lands at the root when its folder is no longer in its scope', async () => {
    // Belt and braces: a folder_id that names a folder of another owner or
    // another team must not come back as the design's place.
    const { env, sql } = sqliteD1();
    folder(sql, 'theirs', 'someone-else');
    folder(sql, 'teamF', 'owner', 'other-team');
    liveDoc(sql, 'A', { folder: 'theirs' });
    liveDoc(sql, 'T', { team: 'team', folder: 'teamF' });
    await trashDesign(env, 'A', T0);
    await trashDesign(env, 'T', T0);

    await restoreDesign(env, 'A', T0 + DAY);
    await restoreDesign(env, 'T', T0 + DAY);

    expect((await getDesign(env, 'A'))?.folderId).toBeNull();
    expect((await getDesign(env, 'T'))?.folderId).toBeNull();
    expect((await getDesign(env, 'T'))?.teamId).toBe('team');
  });

  it('returns a team design to its team folder', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'TF', 'owner', 'team');
    liveDoc(sql, 'T', { team: 'team', folder: 'TF' });
    await trashDesign(env, 'T', T0);

    await restoreDesign(env, 'T', T0 + DAY);

    expect((await listDesignsByTeam(env, 'team')).map((d) => [d.id, d.folderId])).toEqual([
      ['T', 'TF'],
    ]);
  });

  it('does nothing to a live or missing design', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    expect(await restoreDesign(env, 'A', T0 + DAY)).toBe(false);
    expect(await restoreDesign(env, 'nope', T0 + DAY)).toBe(false);
  });
});

describe('listTrash', () => {
  it('lists the personal Trash and every joined team Trash, newest first', async () => {
    const { env, sql } = sqliteD1();
    team(sql, 'joined', [['user_me', 'joined']]);
    team(sql, 'pending', [['user_me', 'pending']]);
    liveDoc(sql, 'mine', { owner: 'user_me' });
    liveDoc(sql, 'live', { owner: 'user_me' });
    liveDoc(sql, 'teammate', { owner: 'user_bob', team: 'joined' });
    liveDoc(sql, 'invited', { owner: 'user_bob', team: 'pending' });
    liveDoc(sql, 'stranger', { owner: 'user_bob' });
    await trashDesign(env, 'mine', T0);
    await trashDesign(env, 'teammate', T0 + 1);
    await trashDesign(env, 'invited', T0);
    await trashDesign(env, 'stranger', T0);

    expect(await listTrash(env, { owner: 'user_me', verifiedUserId: 'user_me' })).toEqual([
      {
        id: 'teammate',
        name: 'Design teammate',
        teamId: 'joined',
        teamName: 'Team joined',
        trashedAt: T0 + 1,
        purgeAt: T0 + 1 + TRASH_RETENTION_MS,
        reason: 'deleted',
      },
      {
        id: 'mine',
        name: 'Design mine',
        teamId: null,
        teamName: null,
        trashedAt: T0,
        purgeAt: T0 + TRASH_RETENTION_MS,
        reason: 'deleted',
      },
    ]);
  });

  it('lists only the personal Trash for a guest', async () => {
    const { env, sql } = sqliteD1();
    team(sql, 'joined', [['guest-1', 'joined']]);
    liveDoc(sql, 'mine', { owner: 'guest-1' });
    liveDoc(sql, 'team', { owner: 'user_bob', team: 'joined' });
    await trashDesign(env, 'mine', T0);
    await trashDesign(env, 'team', T0);

    const items = await listTrash(env, { owner: 'guest-1', verifiedUserId: null });

    expect(items.map((i) => i.id)).toEqual(['mine']);
  });

  it('does not list a team design under its owner’s personal Trash', async () => {
    const { env, sql } = sqliteD1();
    team(sql, 'left', []);
    liveDoc(sql, 'T', { owner: 'user_me', team: 'left' });
    await trashDesign(env, 'T', T0);

    expect(await listTrash(env, { owner: 'user_me', verifiedUserId: 'user_me' })).toEqual([]);
  });
});

describe('purgeDesigns', () => {
  it('removes the design, its own tabs and its snapshot', async () => {
    const { db, del } = withImages();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');
    await trashDesign(db.env, 'A', T0);

    expect(await purgeDesigns(db.env, ['A'])).toBe(1);

    expect(count(db.sql, 'designs', 'id = ?', 'A')).toBe(0);
    expect(count(db.sql, 'tabs', 'id = ?', 't1')).toBe(0);
    expect(del).toHaveBeenCalledWith(['thumb/A', 'og/A']);
    // Its room's storage, where the ledger keeps comment and idea text (docs/specs/015-api/api.md "Purging a room").
    expect(vi.mocked(purgeRooms)).toHaveBeenCalledWith(db.env, ['A']);
  });

  it('keeps a tab another design still holds', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await tab(db, 'A', 'shared');
    await linkTabToDesign(db.env, 'B', 'shared');
    await trashDesign(db.env, 'A', T0);

    await purgeDesigns(db.env, ['A']);

    expect(count(db.sql, 'tabs', 'id = ?', 'shared')).toBe(1);
    expect(count(db.sql, 'design_tabs', 'tab_id = ?', 'shared')).toBe(1);
  });

  it('never purges a live design', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'live');

    vi.mocked(purgeRooms).mockClear();
    expect(await purgeDesigns(db.env, ['live'])).toBe(0);
    expect(count(db.sql, 'designs', 'id = ?', 'live')).toBe(1);
    expect(vi.mocked(purgeRooms)).not.toHaveBeenCalled();
  });

  it('sweeps the design’s Timeline events', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    for (const [id, source, snapshot] of [
      ['e1', 'A', '{"designId":"A"}'],
      ['e2', 'thread-1', '{"designId":"A"}'],
      ['e3', 'B', '{"designId":"B"}'],
    ] as const) {
      insert(db.sql, 'timeline_events', {
        id,
        actor_id: 'owner',
        source_type: 'design',
        source_id: source,
        event_type: 'design_created',
        title: 'Design Created',
        occurred_at: T0,
        snapshot,
        created_at: T0,
      });
    }
    await trashDesign(db.env, 'A', T0);

    await purgeDesigns(db.env, ['A']);

    expect(
      db.sql
        .prepare('SELECT id FROM timeline_events ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['e3']);
  });

  it('is a no-op for no ids', async () => {
    const { db, del } = withImages();
    expect(await purgeDesigns(db.env, [])).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });

  it('still purges when the snapshot delete fails', async () => {
    const del = vi.fn(async () => {
      throw new Error('r2 down');
    });
    const db = sqliteD1({ IMAGES: { delete: del } as unknown as Env['IMAGES'] });
    liveDoc(db.sql, 'A');
    await trashDesign(db.env, 'A', T0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await purgeDesigns(db.env, ['A'])).toBe(1);
    expect(warn).toHaveBeenCalledWith('[trash] snapshot delete failed', 1, expect.any(Error));
    warn.mockRestore();
  });
});

describe('purgeExpiredTrash', () => {
  it('purges what has been in the Trash for 30 days, and nothing younger', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'old');
    liveDoc(db.sql, 'due');
    liveDoc(db.sql, 'young');
    liveDoc(db.sql, 'live');
    const now = T0 + 40 * DAY;
    await trashDesign(db.env, 'old', T0);
    await trashDesign(db.env, 'due', now - TRASH_RETENTION_MS);
    await trashDesign(db.env, 'young', now - TRASH_RETENTION_MS + 1);

    expect(await purgeExpiredTrash(db.env, now)).toBe(2);

    expect(
      db.sql
        .prepare('SELECT id FROM designs ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['live', 'young']);
  });

  it('drains a backlog larger than one batch', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 7; i++) {
      liveDoc(db.sql, `d${i}`);
      await trashDesign(db.env, `d${i}`, T0);
    }

    expect(await purgeExpiredTrash(db.env, T0 + 31 * DAY, { batch: 3, maxBatches: 5 })).toBe(7);
    expect(count(db.sql, 'designs', '1 = 1')).toBe(0);
  });

  it('stops at the per-run cap and leaves the rest for tomorrow', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 7; i++) {
      liveDoc(db.sql, `d${i}`);
      await trashDesign(db.env, `d${i}`, T0 + i);
    }

    expect(await purgeExpiredTrash(db.env, T0 + 31 * DAY, { batch: 2, maxBatches: 2 })).toBe(4);
    // Oldest first, so nothing waits longer than it must.
    expect(
      db.sql
        .prepare('SELECT id FROM designs ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['d4', 'd5', 'd6']);
  });
});

describe('deleteAccount with a Trash', () => {
  it('hard-deletes trashed designs with the rest', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'live', { owner: 'user_leaver' });
    liveDoc(db.sql, 'binned', { owner: 'user_leaver' });
    await trashDesign(db.env, 'binned', T0);

    await deleteAccount(db.env, 'user_leaver');

    expect(count(db.sql, 'designs', 'owner_id = ?', 'user_leaver')).toBe(0);
  });
});
