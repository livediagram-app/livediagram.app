import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { deleteAccount } from './account';

// Every column that holds an owner id, and what account deletion does with it (docs/specs/015-api/api.md,
// "Owner-keyed data"). The ledger is checked against the migrated schema, so a new table keyed on an owner fails
// here until it is classified; each entry is then proven against a real SQLite database, so a classification the
// code does not honour fails too. Where a person's documents are, and everything the Explorer keeps about them, is
// liveworkspace's index: account deletion has the index purge the documents (routes/account.ts).

type OwnerColumn = {
  table: string;
  column: string;
  // Rows account deletion deliberately leaves behind, and why.
  deleteKeeps?: { when: string; why: string };
};

const OWNER_COLUMNS: OwnerColumn[] = [
  // API tokens (docs/specs/015-api/public-api-and-tokens.md).
  { table: 'api_tokens', column: 'owner_id' },
  // Workbench embeds (docs/specs/013-workspace/workbench-embeds.md).
  { table: 'workbench_pairing_requests', column: 'owner_id' },
  { table: 'workbench_pairings', column: 'owner_id' },
  { table: 'workbench_tickets', column: 'owner_id' },
  { table: 'workbench_sessions', column: 'owner_id' },
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
    deleteKeeps: { when: '1 = 1', why: "a document's own store; the images themselves go from the media service" },
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
  insert(sql, 'test_documents', { id: `d-${id}`, owner_id: id, name: id, saved_at: T0, created_at: T0 });
  insert(sql, 'image_owners', { image_id: `img-${id}`, owner_id: id });
  insert(sql, 'tabs', { id: `tab-${id}`, name: 'Board', data: '{"elements":[]}', updated_at: T0, element_count: 0 });
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
  insert(sql, 'api_tokens', {
    id: `tok-${id}`,
    owner_id: id,
    token_hash: `hash-${id}`,
    created_at: T0,
    expires_at: T0 * 2,
    revoked: 0,
    read_only: 0,
  });
  const workbenchRow = { owner_id: id, token_id: `tok-${id}`, origin: 'https://w.example' };
  insert(sql, 'workbench_pairing_requests', {
    ...workbenchRow,
    id: `wr-${id}`,
    code: `code-${id}`,
    status: 'pending',
    created_at: T0,
    expires_at: T0 * 2,
  });
  insert(sql, 'workbench_pairings', { ...workbenchRow, id: `wp-${id}`, created_at: T0 });
  const opened = {
    ...workbenchRow,
    pairing_id: `wp-${id}`,
    document_id: `d-${id}`,
    role: 'edit',
    created_at: T0,
    expires_at: T0 * 2,
  };
  insert(sql, 'workbench_tickets', { ...opened, ticket_hash: `th-${id}` });
  insert(sql, 'workbench_sessions', { ...opened, id: `ws-${id}`, secret_hash: `sh-${id}` });
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
});
