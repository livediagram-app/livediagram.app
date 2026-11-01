// What the items rebuild (migrations/0009_items_livehuddle.sql) must leave unchanged, read from an index database:
// every table's rows (a count and a SHA-256 of them in key order), its columns, foreign keys and CHECKs, and every
// index's SQL (liveworkspace/docs/specs/004-index/blueprints/items.md "Rebuilding items"). The migration test and the
// rehearsal CLI (items-rebuild-counts.ts) both compare a snapshot from before with one from after.
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const REBUILD_MIGRATION = '0009_items_livehuddle.sql';

// The tables the rebuild drops and makes again: items, its twelve children, and timeline_events' two.
export const REBUILT_TABLES = [
  'items',
  'favourites',
  'opens',
  'use_days',
  'timeline_events',
  'timeline_event_scopes',
  'timeline_dismissals',
  'share_links',
  'share_passwords',
  'shared_with',
  'collab_threads',
  'collab_thread_people',
  'collab_actions',
  'collab_forms',
  'collab_form_reads',
] as const;

export type TableShape = {
  rows: number;
  hash: string;
  columns: string[];
  foreignKeys: string[];
  checks: string[];
};

export type Snapshot = {
  tables: Record<string, TableShape>;
  indexes: Record<string, string>;
};

// d1_migrations gains a row when wrangler applies the migration, and SQLite's and D1's own tables aren't ours.
const IGNORED = /^(sqlite_|_cf_|d1_migrations$)/;

const squash = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .trim();

// Each `CHECK (...)` in a CREATE TABLE, with its parentheses balanced, whitespace squashed.
export function checksOf(createSql: string): string[] {
  const sql = squash(createSql);
  const found: string[] = [];
  for (const match of sql.matchAll(/\bCHECK\s*\(/gi)) {
    let depth = 0;
    let end = match.index;
    for (let i = match.index + match[0].length - 1; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')' && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    found.push(sql.slice(match.index, end));
  }
  return found;
}

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

// Rows serialise with bigints and blobs spelled out, so the hash sees exactly what is stored.
const cell = (_key: string, value: unknown) =>
  typeof value === 'bigint'
    ? `${value}n`
    : value instanceof Uint8Array
      ? `x'${Buffer.from(value).toString('hex')}'`
      : value;

function shapeOf(db: DatabaseSync, table: string, createSql: string): TableShape {
  const t = quote(table);
  const columns = db.prepare(`PRAGMA table_xinfo(${t})`).all() as {
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }[];
  const keys = columns
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => quote(c.name));
  const order = (keys.length > 0 ? keys : columns.map((c) => quote(c.name))).join(', ');
  const read = db.prepare(`SELECT * FROM ${t} ORDER BY ${order}`);
  read.setReadBigInts(true);
  const hash = createHash('sha256');
  let rows = 0;
  for (const row of read.iterate()) {
    hash.update(JSON.stringify(Object.values(row as object), cell));
    hash.update('\n');
    rows++;
  }
  const foreignKeys = (
    db.prepare(`PRAGMA foreign_key_list(${t})`).all() as {
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
    }[]
  )
    .map(
      (k) => `${k.from} -> ${k.table}(${k.to}) on delete ${k.on_delete} on update ${k.on_update}`,
    )
    .sort();
  return {
    rows,
    hash: hash.digest('hex'),
    columns: columns.map(
      (c) =>
        `${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''} default ${c.dflt_value} pk ${c.pk}`,
    ),
    foreignKeys,
    checks: checksOf(createSql),
  };
}

export function snapshot(db: DatabaseSync): Snapshot {
  const tables: Record<string, TableShape> = {};
  const indexes: Record<string, string> = {};
  const schema = db
    .prepare(
      `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name`,
    )
    .all() as { type: string; name: string; tbl_name: string; sql: string }[];
  for (const { type, name, tbl_name, sql } of schema) {
    if (IGNORED.test(tbl_name)) continue;
    if (type === 'table') tables[name] = shapeOf(db, name, sql);
    else indexes[name] = `${tbl_name}: ${squash(sql)}`;
  }
  return { tables, indexes };
}

// Everything that differs between two snapshots, one line each; empty when they match. `widened` names the tables
// whose CHECKs the migration means to change.
export function compare(
  before: Snapshot,
  after: Snapshot,
  widened: string[] = ['items'],
): string[] {
  const out: string[] = [];
  const names = (a: object, b: object) =>
    [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const table of names(before.tables, after.tables)) {
    const a = before.tables[table];
    const b = after.tables[table];
    if (!a || !b) {
      out.push(`${table}: ${a ? 'gone' : 'new'}`);
      continue;
    }
    if (a.rows !== b.rows) out.push(`${table}: ${a.rows} rows before, ${b.rows} after`);
    else if (a.hash !== b.hash) out.push(`${table}: same count, different rows`);
    for (const part of ['columns', 'foreignKeys', 'checks'] as const) {
      if (part === 'checks' && widened.includes(table)) continue;
      if (a[part].join('\n') !== b[part].join('\n')) out.push(`${table}: ${part} changed`);
    }
  }
  for (const index of names(before.indexes, after.indexes)) {
    const a = before.indexes[index];
    const b = after.indexes[index];
    if (a !== b) out.push(`index ${index}: ${!a ? 'new' : !b ? 'gone' : 'changed'}`);
  }
  return out;
}

// PRAGMA foreign_key_check: every row whose parent is missing. Empty on a sound database.
export function foreignKeyProblems(db: DatabaseSync): string[] {
  return (
    db.prepare('PRAGMA foreign_key_check').all() as {
      table: string;
      rowid: number;
      parent: string;
    }[]
  ).map((p) => `${p.table} row ${p.rowid}: no ${p.parent}`);
}

// Every table that references items, directly or through another such table: what the rebuild has to carry.
export function itemsDescendants(db: DatabaseSync): string[] {
  const tables = (
    db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
  ).map((t) => t.name);
  const parents = new Map(
    tables.map((t) => [
      t,
      (db.prepare(`PRAGMA foreign_key_list(${quote(t)})`).all() as { table: string }[]).map(
        (k) => k.table,
      ),
    ]),
  );
  const found = new Set<string>(['items']);
  for (let grew = true; grew;) {
    grew = false;
    for (const [t, refs] of parents) {
      if (!found.has(t) && refs.some((r) => found.has(r))) {
        found.add(t);
        grew = true;
      }
    }
  }
  found.delete('items');
  return [...found].sort();
}

export function rowCounts(snap: Snapshot): Record<string, number> {
  return Object.fromEntries(Object.entries(snap.tables).map(([t, s]) => [t, s.rows]));
}
