import { describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/document';
import { TRASH_RETENTION_MS } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { deleteAccount } from './account';
import {
  getDocument,
  getDocumentMeta,
  listDocumentsByOwner,
  listDocumentsByTeam,
} from './documents';
import { deleteFolder } from './folders';
import { linkTabToDocument, upsertTab } from './tabs';
import {
  getTrashedDocumentMeta,
  listTrash,
  purgeDocuments,
  purgeExpiredTrash,
  restoreDocument,
  trashDocument,
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

function liveDoc(
  sql: DatabaseSync,
  id: string,
  opts: { owner?: string; team?: string | null; folder?: string | null } = {},
) {
  insert(sql, 'documents', {
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

async function tab(db: SqliteD1, documentId: string, id: string) {
  await upsertTab(db.env, documentId, { id, name: id, elements: [] } as unknown as Tab, 0);
}

function column(sql: DatabaseSync, id: string, name: string): unknown {
  return sql.prepare(`SELECT ${name} AS v FROM documents WHERE id = ?`).get(id)?.v;
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
      .prepare('PRAGMA table_info(documents)')
      .all()
      .find((c) => c.name === 'trashed_at');
    expect(col).toMatchObject({ type: 'INTEGER', notnull: 0, dflt_value: null });
    const idx = sql
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'documents_trashed_idx'")
      .get()?.sql as string;
    expect(idx).toContain('WHERE trashed_at IS NOT NULL');
  });
});

describe('trashDocument', () => {
  it('stamps the time and hides the diagram from every diagram read', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    liveDoc(sql, 'T', { team: 'team' });

    expect(await trashDocument(env, 'A', T0)).toBe(true);
    expect(await trashDocument(env, 'T', T0)).toBe(true);

    expect(column(sql, 'A', 'trashed_at')).toBe(T0);
    expect(await getDocument(env, 'A')).toBeNull();
    expect(await getDocumentMeta(env, 'A')).toBeNull();
    expect(await listDocumentsByOwner(env, 'owner')).toEqual([]);
    expect(await listDocumentsByTeam(env, 'team')).toEqual([]);
  });

  it('keeps the first deletion time when trashed again', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    await trashDocument(env, 'A', T0);

    expect(await trashDocument(env, 'A', T0 + DAY)).toBe(false);
    expect(column(sql, 'A', 'trashed_at')).toBe(T0);
  });

  it('reports a missing diagram', async () => {
    const { env } = sqliteD1();
    expect(await trashDocument(env, 'nope', T0)).toBe(false);
  });

  it('leaves tabs, links, share links and stars in place', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');
    insert(db.sql, 'share_links', {
      code: 'code1',
      document_id: 'A',
      role: 'edit',
      created_at: T0,
    });
    insert(db.sql, 'favourites', { owner_id: 'owner', document_id: 'A', created_at: T0 });

    await trashDocument(db.env, 'A', T0);

    expect(count(db.sql, 'tabs', 'id = ?', 't1')).toBe(1);
    expect(count(db.sql, 'document_tabs', 'document_id = ?', 'A')).toBe(1);
    expect(count(db.sql, 'share_links', 'document_id = ?', 'A')).toBe(1);
    expect(count(db.sql, 'favourites', 'document_id = ?', 'A')).toBe(1);
  });
});

describe('getTrashedDocumentMeta', () => {
  it('reads a trashed diagram and nothing else', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A', { team: 'team' });
    liveDoc(sql, 'live');
    await trashDocument(env, 'A', T0);

    expect(await getTrashedDocumentMeta(env, 'A')).toEqual({
      id: 'A',
      ownerId: 'owner',
      teamId: 'team',
      name: 'Diagram A',
      trashedAt: T0,
    });
    expect(await getTrashedDocumentMeta(env, 'live')).toBeNull();
    expect(await getTrashedDocumentMeta(env, 'nope')).toBeNull();
  });
});

describe('trashedIdsIn', () => {
  it('names the trashed ids among the given ones', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    liveDoc(sql, 'B');
    await trashDocument(env, 'A', T0);

    expect([...(await trashedIdsIn(env, ['A', 'B', 'nope']))]).toEqual(['A']);
    expect([...(await trashedIdsIn(env, []))]).toEqual([]);
  });
});

describe('restoreDocument', () => {
  it('returns the diagram to its folder', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'F');
    liveDoc(sql, 'A', { folder: 'F' });
    await trashDocument(env, 'A', T0);

    expect(await restoreDocument(env, 'A')).toBe(true);

    expect(column(sql, 'A', 'trashed_at')).toBeNull();
    expect((await getDocument(env, 'A'))?.folderId).toBe('F');
  });

  it('lands in Unsorted when its folder was deleted meanwhile', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'F');
    liveDoc(sql, 'A', { folder: 'F' });
    await trashDocument(env, 'A', T0);
    await deleteFolder(env, 'F');

    await restoreDocument(env, 'A');

    expect((await getDocument(env, 'A'))?.folderId).toBeNull();
  });

  it('lands in Unsorted when its folder is no longer in its scope', async () => {
    // Belt and braces: a folder_id that names a folder of another owner or
    // another team must not come back as the diagram's place.
    const { env, sql } = sqliteD1();
    folder(sql, 'theirs', 'someone-else');
    folder(sql, 'teamF', 'owner', 'other-team');
    liveDoc(sql, 'A', { folder: 'theirs' });
    liveDoc(sql, 'T', { team: 'team', folder: 'teamF' });
    await trashDocument(env, 'A', T0);
    await trashDocument(env, 'T', T0);

    await restoreDocument(env, 'A');
    await restoreDocument(env, 'T');

    expect((await getDocument(env, 'A'))?.folderId).toBeNull();
    expect((await getDocument(env, 'T'))?.folderId).toBeNull();
    expect((await getDocument(env, 'T'))?.teamId).toBe('team');
  });

  it('returns a team diagram to its team folder', async () => {
    const { env, sql } = sqliteD1();
    folder(sql, 'TF', 'owner', 'team');
    liveDoc(sql, 'T', { team: 'team', folder: 'TF' });
    await trashDocument(env, 'T', T0);

    await restoreDocument(env, 'T');

    expect((await listDocumentsByTeam(env, 'team')).map((d) => [d.id, d.folderId])).toEqual([
      ['T', 'TF'],
    ]);
  });

  it('does nothing to a live or missing diagram', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'A');
    expect(await restoreDocument(env, 'A')).toBe(false);
    expect(await restoreDocument(env, 'nope')).toBe(false);
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
    await trashDocument(env, 'mine', T0);
    await trashDocument(env, 'teammate', T0 + 1);
    await trashDocument(env, 'invited', T0);
    await trashDocument(env, 'stranger', T0);

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
    liveDoc(sql, 'mine', { owner: 'guest-1' });
    liveDoc(sql, 'team', { owner: 'user_bob', team: 'joined' });
    await trashDocument(env, 'mine', T0);
    await trashDocument(env, 'team', T0);

    const items = await listTrash(env, { owner: 'guest-1', verifiedUserId: null });

    expect(items.map((i) => i.id)).toEqual(['mine']);
  });

  it('does not list a team diagram under its owner’s personal Trash', async () => {
    const { env, sql } = sqliteD1();
    team(sql, 'left', []);
    liveDoc(sql, 'T', { owner: 'user_me', team: 'left' });
    await trashDocument(env, 'T', T0);

    expect(await listTrash(env, { owner: 'user_me', verifiedUserId: 'user_me' })).toEqual([]);
  });
});

describe('purgeDocuments', () => {
  it('removes the diagram, its own tabs and its snapshot', async () => {
    const { db, del } = withImages();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');
    await trashDocument(db.env, 'A', T0);

    expect(await purgeDocuments(db.env, ['A'])).toBe(1);

    expect(count(db.sql, 'documents', 'id = ?', 'A')).toBe(0);
    expect(count(db.sql, 'tabs', 'id = ?', 't1')).toBe(0);
    expect(del).toHaveBeenCalledWith(['thumb/A']);
  });

  it('keeps a tab another diagram still holds', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await tab(db, 'A', 'shared');
    await linkTabToDocument(db.env, 'B', 'shared');
    await trashDocument(db.env, 'A', T0);

    await purgeDocuments(db.env, ['A']);

    expect(count(db.sql, 'tabs', 'id = ?', 'shared')).toBe(1);
    expect(count(db.sql, 'document_tabs', 'tab_id = ?', 'shared')).toBe(1);
  });

  it('never purges a live diagram', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'live');

    expect(await purgeDocuments(db.env, ['live'])).toBe(0);
    expect(count(db.sql, 'documents', 'id = ?', 'live')).toBe(1);
  });

  it('sweeps the diagram’s Timeline events', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    for (const [id, source, snapshot] of [
      ['e1', 'A', '{"documentId":"A"}'],
      ['e2', 'thread-1', '{"documentId":"A"}'],
      ['e3', 'B', '{"documentId":"B"}'],
    ] as const) {
      insert(db.sql, 'timeline_events', {
        id,
        actor_id: 'owner',
        source_type: 'document',
        source_id: source,
        event_type: 'document_created',
        title: 'Document Created',
        occurred_at: T0,
        snapshot,
        created_at: T0,
      });
    }
    await trashDocument(db.env, 'A', T0);

    await purgeDocuments(db.env, ['A']);

    expect(
      db.sql
        .prepare('SELECT id FROM timeline_events ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['e3']);
  });

  it('is a no-op for no ids', async () => {
    const { db, del } = withImages();
    expect(await purgeDocuments(db.env, [])).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });

  it('still purges when the snapshot delete fails', async () => {
    const del = vi.fn(async () => {
      throw new Error('r2 down');
    });
    const db = sqliteD1({ IMAGES: { delete: del } as unknown as Env['IMAGES'] });
    liveDoc(db.sql, 'A');
    await trashDocument(db.env, 'A', T0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await purgeDocuments(db.env, ['A'])).toBe(1);
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
    await trashDocument(db.env, 'old', T0);
    await trashDocument(db.env, 'due', now - TRASH_RETENTION_MS);
    await trashDocument(db.env, 'young', now - TRASH_RETENTION_MS + 1);

    expect(await purgeExpiredTrash(db.env, now)).toBe(2);

    expect(
      db.sql
        .prepare('SELECT id FROM documents ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['live', 'young']);
  });

  it('drains a backlog larger than one batch', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 7; i++) {
      liveDoc(db.sql, `d${i}`);
      await trashDocument(db.env, `d${i}`, T0);
    }

    expect(await purgeExpiredTrash(db.env, T0 + 31 * DAY, { batch: 3, maxBatches: 5 })).toBe(7);
    expect(count(db.sql, 'documents', '1 = 1')).toBe(0);
  });

  it('stops at the per-run cap and leaves the rest for tomorrow', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 7; i++) {
      liveDoc(db.sql, `d${i}`);
      await trashDocument(db.env, `d${i}`, T0 + i);
    }

    expect(await purgeExpiredTrash(db.env, T0 + 31 * DAY, { batch: 2, maxBatches: 2 })).toBe(4);
    // Oldest first, so nothing waits longer than it must.
    expect(
      db.sql
        .prepare('SELECT id FROM documents ORDER BY id')
        .all()
        .map((r) => r.id),
    ).toEqual(['d4', 'd5', 'd6']);
  });
});

describe('deleteAccount with a Trash', () => {
  it('hard-deletes trashed diagrams with the rest', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'live', { owner: 'user_leaver' });
    liveDoc(db.sql, 'binned', { owner: 'user_leaver' });
    await trashDocument(db.env, 'binned', T0);

    await deleteAccount(db.env, 'user_leaver');

    expect(count(db.sql, 'documents', 'owner_id = ?', 'user_leaver')).toBe(0);
  });
});
