import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { workbenchStore } from '../workbench-store';
import { deleteAccount } from './account';

// Every column that holds an owner id, and what account deletion does with it (docs/specs/015-api/api.md,
// "Owner-keyed data"). The ledger is checked against the migrated schema, so a new table keyed on an owner fails
// here until it is classified; each entry is then proven against a real SQLite database, so a classification the
// code does not honour fails too. Where a person's plans are, and everything the Explorer keeps about them, is
// liveworkspace's index: account deletion has the index purge the plans (routes/account.ts). A person's name and
// colour, settings, address and sign-up are the liveworkspace accounts Worker's, which deletes them itself when it
// closes the account.

type OwnerColumn = {
  table: string;
  column: string;
  // Rows account deletion deliberately leaves behind, and why.
  deleteKeeps?: { when: string; why: string };
};

const OWNER_COLUMNS: OwnerColumn[] = [
  // What a reader has seen of a form's responses (docs/specs/030-forms/forms.md).
  { table: 'form_reads', column: 'owner_id' },
  // A plan's own row (its Durable Object; one database holds every plan here): the index purges the owner's
  // plans, and each purge drops the plan's whole store.
  {
    table: 'plan',
    column: 'owner_id',
    deleteKeeps: { when: '1 = 1', why: "a plan's own store, purged through the index" },
  },
  // Agent changesets (docs/specs/024-agents/agent-changesets.md, CS27), in each plan's own store: those on
  // someone else's plan stay until its retention ages them out.
  {
    table: 'agent_changesets',
    column: 'author_id',
    deleteKeeps: { when: '1 = 1', why: "a plan's own store, aged out after 30 days" },
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
  insert(sql, 'test_plans', {
    id: `d-${id}`,
    owner_id: id,
    name: id,
    saved_at: T0,
    created_at: T0,
  });
  insert(sql, 'form_links', {
    code: `form-${id}`,
    project_id: `d-${id}`,
    tab_id: `t-${id}`,
    created_at: T0,
  });
  insert(sql, 'form_reads', { code: `form-${id}`, owner_id: id, seen_number: 3 });
  insert(sql, 'tabs', { id: `tab-${id}`, name: 'Board', data: '{"elements":[]}', updated_at: T0 });
  insert(sql, 'agent_changesets', {
    id: `cs-${id}`,
    plan_id: `d-${id}`,
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

  it("closes the person's workbench store and no one else's", async () => {
    const { env } = arrange();
    const ask = (personId: string) =>
      workbenchStore(env, personId).openPairingRequest({
        personId,
        token: { id: `tok-${personId}`, name: null, readOnly: false, expiresAt: T0 * 2 },
        origin: 'https://w.example',
        scope: 'project',
        name: null,
        now: T0,
      });
    const mine = await ask(ACCOUNT);
    const theirs = await ask(OTHER);

    await deleteAccount(env, ACCOUNT);

    const status = (personId: string, code: string) =>
      workbenchStore(env, personId).pairingRequestStatus(code, `tok-${personId}`, T0);
    expect(await status(ACCOUNT, mine.code)).toBeNull();
    expect(await status(OTHER, theirs.code)).toMatchObject({ status: 'pending' });
  });
});
