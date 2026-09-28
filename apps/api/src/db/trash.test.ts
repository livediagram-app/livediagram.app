import { describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/diagram';
import { TRASH_RETENTION_MS } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { deleteAccount } from './account';
import { getDiagram, getDiagramMeta, listDiagramsByOwner, listDiagramsByTeam } from './diagrams';
import { deleteFolder } from './folders';
import { linkTabToDiagram, upsertTab } from './tabs';
import {
  getTrashedDiagramMeta,
  listTrash,
  purgeDiagrams,
  purgeExpiredTrash,
  restoreDiagram,
  trashDiagram,
  trashedIdsIn,
} from './trash';

// The Trash (docs/specs/013-workspace/trash.md), proven on a real SQLite with
// every migration applied: trashing stamps a time and hides the diagram,
// restoring puts it back where it was, and the purge removes it the way a
// delete always has, shared tabs spared.

const T0 = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function diagram(
  sql: DatabaseSync,
  id: string,
  opts: { owner?: string; team?: string | null; folder?: string | null } = {},
) {
  insert(sql, 'diagrams', {
    id,
    owner_id: opts.owner ?? 'owner',
    name: `Diagram ${id}`,
    shareable: 0,
    team_id: opts.team ?? null,
    folder_id: opts.folder ?? null,
    saved_at: T0,
    created_at: T0,
  });
}

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

function team(sql: DatabaseSync, id: string, members: [string, 'joined' | 'pending'][]) {
  insert(sql, 'teams', { id, name: `Team ${id}`, created_at: T0, updated_at: T0 });
  for (const [user, status] of members) {
    insert(sql, 'team_members', {
      id: `m-${id}-${user}`,
      team_id: id,
      user_id: user,
      role: 'member',
      status,
      created_at: T0,
      updated_at: T0,
    });
  }
}

async function tab(db: SqliteD1, diagramId: string, id: string) {
  await upsertTab(db.env, diagramId, { id, name: id, elements: [] } as unknown as Tab, 0);
}

function column(sql: DatabaseSync, id: string, name: string): unknown {
  return sql.prepare(`SELECT ${name} AS v FROM diagrams WHERE id = ?`).get(id)?.v;
}

function count(sql: DatabaseSync, table: string, where: string, ...args: string[]): number {
  return Number(sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args)?.n);
}

function withImages() {
  const del = vi.fn(async () => {});
  const db = sqliteD1({ IMAGES: { delete: del } as unknown as Env['IMAGES'] });
  return { db, del };
}

describe('migration 0051 (diagrams.trashed_at)', () => {
  it('adds a nullable trashed_at with a partial index', () => {
    const { sql } = sqliteD1();
    const col = sql
      .prepare('PRAGMA table_info(diagrams)')
      .all()
      .find((c) => c.name === 'trashed_at');
    expect(col).toMatchObject({ type: 'INTEGER', notnull: 0, dflt_value: null });
    const idx = sql
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'diagrams_trashed_idx'")
      .get()?.sql as string;
    expect(idx).toContain('WHERE trashed_at IS NOT NULL');
  });
});

describe('trashDiagram', () => {
  it('stamps the time and hides the diagram from every diagram read', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A');
    diagram(sql, 'T', { team: 'team' });

    expect(await trashDiagram(env, 'A', T0)).toBe(true);
    expect(await trashDiagram(env, 'T', T0)).toBe(true);

    expect(column(sql, 'A', 'trashed_at')).toBe(T0);
    expect(await getDiagram(env, 'A')).toBeNull();
    expect(await getDiagramMeta(env, 'A')).toBeNull();
    expect(await listDiagramsByOwner(env, 'owner')).toEqual([]);
    expect(await listDiagramsByTeam(env, 'team')).toEqual([]);
  });

  it('keeps the first deletion time when trashed again', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A');
    await trashDiagram(env, 'A', T0);

    expect(await trashDiagram(env, 'A', T0 + DAY)).toBe(false);
    expect(column(sql, 'A', 'trashed_at')).toBe(T0);
  });

  it('reports a missing diagram', async () => {
    const { env } = sqliteD1();
    expect(await trashDiagram(env, 'nope', T0)).toBe(false);
  });

  it('leaves tabs, links, share links and stars in place', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'A');
    await tab(db, 'A', 't1');
    insert(db.sql, 'share_links', {
      code: 'code1',
      diagram_id: 'A',
      role: 'edit',
      created_at: T0,
    });
    insert(db.sql, 'favourites', { owner_id: 'owner', diagram_id: 'A', created_at: T0 });

    await trashDiagram(db.env, 'A', T0);

    expect(count(db.sql, 'tabs', 'id = ?', 't1')).toBe(1);
    expect(count(db.sql, 'diagram_tabs', 'diagram_id = ?', 'A')).toBe(1);
    expect(count(db.sql, 'share_links', 'diagram_id = ?', 'A')).toBe(1);
    expect(count(db.sql, 'favourites', 'diagram_id = ?', 'A')).toBe(1);
  });
});

describe('getTrashedDiagramMeta', () => {
  it('reads a trashed diagram and nothing else', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A', { team: 'team' });
    diagram(sql, 'live');
    await trashDiagram(env, 'A', T0);

    expect(await getTrashedDiagramMeta(env, 'A')).toEqual({
      id: 'A',
      ownerId: 'owner',
      teamId: 'team',
      name: 'Diagram A',
      trashedAt: T0,
    });
    expect(await getTrashedDiagramMeta(env, 'live')).toBeNull();
    expect(await getTrashedDiagramMeta(env, 'nope')).toBeNull();
  });
});

describe('trashedIdsIn', () => {
  it('names the trashed ids among the given ones', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A');
    diagram(sql, 'B');
    await trashDiagram(env, 'A', T0);

    expect([...(await trashedIdsIn(env, ['A', 'B', 'nope']))]).toEqual(['A']);
    expect([...(await trashedIdsIn(env, []))]).toEqual([]);
  });
});

describe('restoreDiagram', () => {
  it('returns the diagram to its folder', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'F');
    diagram(sql, 'A', { folder: 'F' });
    await trashDiagram(env, 'A', T0);

    expect(await restoreDiagram(env, 'A')).toBe(true);

    expect(column(sql, 'A', 'trashed_at')).toBeNull();
    expect((await getDiagram(env, 'A'))?.folderId).toBe('F');
  });

  it('lands in Unsorted when its folder was deleted meanwhile', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'F');
    diagram(sql, 'A', { folder: 'F' });
    await trashDiagram(env, 'A', T0);
    await deleteFolder(env, 'F');

    await restoreDiagram(env, 'A');

    expect((await getDiagram(env, 'A'))?.folderId).toBeNull();
  });

  it('lands in Unsorted when its folder is no longer in its scope', async () => {
    // Belt and braces: a folder_id that names a folder of another owner or
    // another team must not come back as the diagram's place.
    const { env, sql } = sqliteD1();
    folder(sql, 'theirs', 'someone-else');
    folder(sql, 'teamF', 'owner', 'other-team');
    diagram(sql, 'A', { folder: 'theirs' });
    diagram(sql, 'T', { team: 'team', folder: 'teamF' });
    await trashDiagram(env, 'A', T0);
    await trashDiagram(env, 'T', T0);

    await restoreDiagram(env, 'A');
    await restoreDiagram(env, 'T');

    expect((await getDiagram(env, 'A'))?.folderId).toBeNull();
    expect((await getDiagram(env, 'T'))?.folderId).toBeNull();
    expect((await getDiagram(env, 'T'))?.teamId).toBe('team');
  });

  it('returns a team diagram to its team folder', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'TF', 'owner', 'team');
    diagram(sql, 'T', { team: 'team', folder: 'TF' });
    await trashDiagram(env, 'T', T0);

    await restoreDiagram(env, 'T');

    expect((await listDiagramsByTeam(env, 'team')).map((d) => [d.id, d.folderId])).toEqual([
      ['T', 'TF'],
    ]);
  });

  it('does nothing to a live or missing diagram', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A');
    expect(await restoreDiagram(env, 'A')).toBe(false);
    expect(await restoreDiagram(env, 'nope')).toBe(false);
  });
});

describe('listTrash', () => {
  it('lists the personal Trash and every joined team Trash, newest first', async () => {
    const { env, sql } = sqliteD1();
    team(sql, 'joined', [['user_me', 'joined']]);
    team(sql, 'pending', [['user_me', 'pending']]);
    diagram(sql, 'mine', { owner: 'user_me' });
    diagram(sql, 'live', { owner: 'user_me' });
    diagram(sql, 'teammate', { owner: 'user_bob', team: 'joined' });
    diagram(sql, 'invited', { owner: 'user_bob', team: 'pending' });
    diagram(sql, 'stranger', { owner: 'user_bob' });
    await trashDiagram(env, 'mine', T0);
    await trashDiagram(env, 'teammate', T0 + 1);
    await trashDiagram(env, 'invited', T0);
    await trashDiagram(env, 'stranger', T0);

    expect(await listTrash(env, { owner: 'user_me', verifiedUserId: 'user_me' })).toEqual([
      {
        id: 'teammate',
        name: 'Diagram teammate',
        teamId: 'joined',
        teamName: 'Team joined',
        trashedAt: T0 + 1,
        purgeAt: T0 + 1 + TRASH_RETENTION_MS,
      },
      {
        id: 'mine',
        name: 'Diagram mine',
        teamId: null,
        teamName: null,
        trashedAt: T0,
        purgeAt: T0 + TRASH_RETENTION_MS,
      },
    ]);
  });

  it('lists only the personal Trash for a guest', async () => {
    const { env, sql } = sqliteD1();
    team(sql, 'joined', [['guest-1', 'joined']]);
    diagram(sql, 'mine', { owner: 'guest-1' });
    diagram(sql, 'team', { owner: 'user_bob', team: 'joined' });
    await trashDiagram(env, 'mine', T0);
    await trashDiagram(env, 'team', T0);

    const items = await listTrash(env, { owner: 'guest-1', verifiedUserId: null });

    expect(items.map((i) => i.id)).toEqual(['mine']);
  });

  it('does not list a team diagram under its owner’s personal Trash', async () => {
    const { env, sql } = sqliteD1();
    team(sql, 'left', []);
    diagram(sql, 'T', { owner: 'user_me', team: 'left' });
    await trashDiagram(env, 'T', T0);

    expect(await listTrash(env, { owner: 'user_me', verifiedUserId: 'user_me' })).toEqual([]);
  });
});

describe('purgeDiagrams', () => {
  it('removes the diagram, its own tabs and its snapshot', async () => {
    const { db, del } = withImages();
    diagram(db.sql, 'A');
    await tab(db, 'A', 't1');
    await trashDiagram(db.env, 'A', T0);

    expect(await purgeDiagrams(db.env, ['A'])).toBe(1);

    expect(count(db.sql, 'diagrams', 'id = ?', 'A')).toBe(0);
    expect(count(db.sql, 'tabs', 'id = ?', 't1')).toBe(0);
    expect(del).toHaveBeenCalledWith(['thumb/A']);
  });

  it('keeps a tab another diagram still holds', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'A');
    diagram(db.sql, 'B');
    await tab(db, 'A', 'shared');
    await linkTabToDiagram(db.env, 'B', 'shared');
    await trashDiagram(db.env, 'A', T0);

    await purgeDiagrams(db.env, ['A']);

    expect(count(db.sql, 'tabs', 'id = ?', 'shared')).toBe(1);
    expect(count(db.sql, 'diagram_tabs', 'tab_id = ?', 'shared')).toBe(1);
  });

  it('never purges a live diagram', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'live');

    expect(await purgeDiagrams(db.env, ['live'])).toBe(0);
    expect(count(db.sql, 'diagrams', 'id = ?', 'live')).toBe(1);
  });

  it('sweeps the diagram’s Timeline events', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'A');
    diagram(db.sql, 'B');
    for (const [id, source, snapshot] of [
      ['e1', 'A', '{"diagramId":"A"}'],
      ['e2', 'thread-1', '{"diagramId":"A"}'],
      ['e3', 'B', '{"diagramId":"B"}'],
    ] as const) {
      insert(db.sql, 'timeline_events', {
        id,
        actor_id: 'owner',
        source_type: 'diagram',
        source_id: source,
        event_type: 'diagram_created',
        title: 'Diagram Created',
        occurred_at: T0,
        snapshot,
        created_at: T0,
      });
    }
    await trashDiagram(db.env, 'A', T0);

    await purgeDiagrams(db.env, ['A']);

    expect(
      db.sql
        .prepare('SELECT id FROM timeline_events ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['e3']);
  });

  it('is a no-op for no ids', async () => {
    const { db, del } = withImages();
    expect(await purgeDiagrams(db.env, [])).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });

  it('still purges when the snapshot delete fails', async () => {
    const del = vi.fn(async () => {
      throw new Error('r2 down');
    });
    const db = sqliteD1({ IMAGES: { delete: del } as unknown as Env['IMAGES'] });
    diagram(db.sql, 'A');
    await trashDiagram(db.env, 'A', T0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await purgeDiagrams(db.env, ['A'])).toBe(1);
    expect(warn).toHaveBeenCalledWith('[trash] snapshot delete failed', 1, expect.any(Error));
    warn.mockRestore();
  });
});

describe('purgeExpiredTrash', () => {
  it('purges what has been in the Trash for 30 days, and nothing younger', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'old');
    diagram(db.sql, 'due');
    diagram(db.sql, 'young');
    diagram(db.sql, 'live');
    const now = T0 + 40 * DAY;
    await trashDiagram(db.env, 'old', T0);
    await trashDiagram(db.env, 'due', now - TRASH_RETENTION_MS);
    await trashDiagram(db.env, 'young', now - TRASH_RETENTION_MS + 1);

    expect(await purgeExpiredTrash(db.env, now)).toBe(2);

    expect(
      db.sql
        .prepare('SELECT id FROM diagrams ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['live', 'young']);
  });

  it('drains a backlog larger than one batch', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 7; i++) {
      diagram(db.sql, `d${i}`);
      await trashDiagram(db.env, `d${i}`, T0);
    }

    expect(await purgeExpiredTrash(db.env, T0 + 31 * DAY, { batch: 3, maxBatches: 5 })).toBe(7);
    expect(count(db.sql, 'diagrams', '1 = 1')).toBe(0);
  });

  it('stops at the per-run cap and leaves the rest for tomorrow', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 7; i++) {
      diagram(db.sql, `d${i}`);
      await trashDiagram(db.env, `d${i}`, T0 + i);
    }

    expect(await purgeExpiredTrash(db.env, T0 + 31 * DAY, { batch: 2, maxBatches: 2 })).toBe(4);
    // Oldest first, so nothing waits longer than it must.
    expect(
      db.sql
        .prepare('SELECT id FROM diagrams ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['d4', 'd5', 'd6']);
  });
});

describe('deleteAccount with a Trash', () => {
  it('hard-deletes trashed diagrams with the rest', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'live', { owner: 'user_leaver' });
    diagram(db.sql, 'binned', { owner: 'user_leaver' });
    await trashDiagram(db.env, 'binned', T0);

    await deleteAccount(db.env, 'user_leaver');

    expect(count(db.sql, 'diagrams', 'owner_id = ?', 'user_leaver')).toBe(0);
  });
});
