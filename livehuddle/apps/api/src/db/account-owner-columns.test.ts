import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { personStore } from '../person-client';
import { deleteAccount, mergeGuest } from './account';

// Every column that holds an owner id, and what account deletion does with it (docs/specs/015-api/api.md,
// "Owner-keyed data"). The ledger is checked against the migrated schema, so a new table keyed on an owner fails
// here until it is classified; each entry is then proven against a real SQLite database, so a classification the
// code does not honour fails too. Where a person's canvases are, and everything the Explorer keeps about them, is
// liveworkspace's index: account deletion has the index purge the canvases, and a guest's merge has it move them.

type OwnerColumn = {
  table: string;
  column: string;
  // Rows account deletion deliberately leaves behind, and why.
  deleteKeeps?: { when: string; why: string };
};

const OWNER_COLUMNS: OwnerColumn[] = [
  // A document's own row (its Durable Object; one database holds every document here): the index purges the owner's
  // documents, and each purge drops the document's whole store.
  {
    table: 'document',
    column: 'owner_id',
    deleteKeeps: { when: '1 = 1', why: "a document's own store, purged through the index" },
  },
  // Whose each placed image is, as the media service names them (db/image-grants.ts), in each document's own store:
  // the service deletes the account's images, and a document then serves nothing of theirs.
  {
    table: 'image_owners',
    column: 'owner_id',
    deleteKeeps: {
      when: '1 = 1',
      why: "a document's own store; the images themselves go from the media service",
    },
  },
  // A canvas's Community post (docs/specs/025-community/community.md), in its own store: the post's check finds the
  // canvas gone or no longer its author's, and the post leaves the listing (document-room/community-post.ts).
  {
    table: 'community_post',
    column: 'author_id',
    deleteKeeps: { when: '1 = 1', why: "a document's own store, withdrawn by the post's check" },
  },
  // Agent changesets (docs/specs/024-agents/agent-changesets.md, CS27), in each document's own store: those on
  // someone else's document stay until its retention ages them out.
  {
    table: 'agent_changesets',
    column: 'author_id',
    deleteKeeps: { when: '1 = 1', why: "a document's own store, aged out after 30 days" },
  },
];

// Column names that mark an owner-keyed column wherever they appear.
const OWNER_COLUMN_NAMES = ['owner_id', 'user_id', 'sender_id', 'author_id'];

const ACCOUNT = 'user_account';
const OTHER = 'user_other';
const T0 = 1_700_000_000_000;

function label(c: OwnerColumn): string {
  return `${c.table}.${c.column}`;
}

function count(sql: DatabaseSync, c: OwnerColumn, ownerId: string, extra?: string): number {
  const where = [`${c.column} = ?`, extra].filter(Boolean).join(' AND ');
  const row = sql.prepare(`SELECT COUNT(*) AS n FROM ${c.table} WHERE ${where}`).get(ownerId);
  return Number(row?.n);
}

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

// One row in every owner-keyed column, keyed on `id`.
function seed(sql: DatabaseSync, id: string) {
  insert(sql, 'test_documents', {
    id: `d-${id}`,
    owner_id: id,
    name: id,
    saved_at: T0,
    created_at: T0,
  });
  insert(sql, 'image_owners', { image_id: `img-${id}`, owner_id: id });
  insert(sql, 'tabs', {
    id: `tab-${id}`,
    name: 'Board',
    data: '{"elements":[]}',
    updated_at: T0,
    element_count: 0,
  });
  insert(sql, 'community_post', {
    share_code: `code-${id}`,
    author_id: id,
    post_id: `post-${id}`,
    title: id,
    checked_at: T0,
  });
  insert(sql, 'agent_changesets', {
    id: `cs-${id}`,
    document_id: `d-${id}`,
    tab_id: `tab-${id}`,
    rev: 1,
    author_id: id,
    author_name: 'Otter',
    author_color: '#ff8800',
    fingerprints: '{}',
    added: 1,
    changed: 0,
    removed: 0,
    created_at: T0,
  });
}

function schemaOwnerColumns(sql: DatabaseSync): string[] {
  const tables = sql
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((t) => String(t.name));
  return tables.flatMap((table) =>
    sql
      .prepare(`SELECT name FROM pragma_table_info(?)`)
      .all(table)
      .map((c) => String(c.name))
      .filter((column) => OWNER_COLUMN_NAMES.includes(column))
      .map((column) => `${table}.${column}`),
  );
}

describe('owner-keyed columns (docs/specs/015-api/api.md)', () => {
  it('classifies every owner-keyed column the migrations create', () => {
    const { sql } = sqliteD1();
    const ledger = OWNER_COLUMNS.map(label);
    expect(ledger).toEqual(expect.arrayContaining(schemaOwnerColumns(sql)));
  });

  it('names only columns the migrations create', () => {
    const { sql } = sqliteD1();
    for (const c of OWNER_COLUMNS) {
      const columns = sql
        .prepare('SELECT name FROM pragma_table_info(?)')
        .all(c.table)
        .map((r) => r.name);
      expect(columns, label(c)).toContain(c.column);
    }
  });
});

describe('deleteAccount erases every owner-keyed row (docs/specs/015-api/api.md)', () => {
  function arrange() {
    const db = sqliteD1();
    seed(db.sql, ACCOUNT);
    seed(db.sql, OTHER);
    return db;
  }

  it('leaves no row keyed on the deleted owner', async () => {
    const { env, sql } = arrange();
    for (const c of OWNER_COLUMNS) expect(count(sql, c, ACCOUNT), label(c)).toBeGreaterThan(0);

    await deleteAccount(env, ACCOUNT);

    for (const c of OWNER_COLUMNS) {
      const kept = c.deleteKeeps ? `NOT (${c.deleteKeeps.when})` : undefined;
      expect(count(sql, c, ACCOUNT, kept), label(c)).toBe(0);
    }
  });

  it('keeps what belongs to someone else', async () => {
    const { env, sql } = arrange();

    await deleteAccount(env, ACCOUNT);

    for (const c of OWNER_COLUMNS) expect(count(sql, c, OTHER), label(c)).toBeGreaterThan(0);
  });

  it("empties the owner's own store (shape libraries), and no one else's", async () => {
    const { env } = arrange();
    const lib = { id: 'l-1', name: 'Team icons', source: 'drawio' as const, items: [] };
    for (const person of [ACCOUNT, OTHER]) {
      await personStore(env, person).createShapeLibrary(lib, 10);
    }

    await deleteAccount(env, ACCOUNT);

    expect(await personStore(env, ACCOUNT).shapeLibraries()).toEqual([]);
    expect(await personStore(env, OTHER).shapeLibraries()).toHaveLength(1);
  });
});

// A guest who became an account (docs/specs/015-api/api.md "Owner-keyed data"): the index moves their canvases;
// what this app keeps for the guest beside them is their store's shape libraries.
describe('mergeGuest moves the guest library into the account', () => {
  const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
  const lib = (id: string, name: string) => ({ id, name, source: 'drawio' as const, items: [] });

  it('renames one whose name the account already uses', async () => {
    const { env } = sqliteD1();
    await personStore(env, GUEST).createShapeLibrary(lib(`l-${GUEST}`, 'Team icons'), 10);
    await personStore(env, ACCOUNT).createShapeLibrary(lib('l-account', 'team ICONS'), 10);

    await mergeGuest(env, GUEST, ACCOUNT);

    const libraries = await personStore(env, ACCOUNT).shapeLibraries();
    expect(libraries.map((l) => [l.id, l.ownerId, l.name]).sort()).toEqual([
      [`l-${GUEST}`, ACCOUNT, 'Team icons (2)'],
      ['l-account', ACCOUNT, 'team ICONS'],
    ]);
    expect(await personStore(env, GUEST).shapeLibraries()).toEqual([]);
  });

  it('is a no-op on a second run', async () => {
    const { env } = sqliteD1();
    await personStore(env, GUEST).createShapeLibrary(lib(`l-${GUEST}`, 'Team icons'), 10);
    await mergeGuest(env, GUEST, ACCOUNT);
    const before = await personStore(env, ACCOUNT).shapeLibraries();

    await mergeGuest(env, GUEST, ACCOUNT);

    expect(await personStore(env, ACCOUNT).shapeLibraries()).toEqual(before);
  });
});
