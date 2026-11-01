// The items rebuild's rehearsal (migrations/0009_items_livehuddle.sql, Work Tracker #286): proves on a copy of the
// index's data that the migration keeps every row of every table, every index, foreign key and cascade, and that
// livehuddle's Spaces then go in. Reads local files only; it never reaches Cloudflare.
//
//   # One step, on an export (wrangler d1 export liveworkspace-index --remote --output prod.sql, which only reads):
//   node scripts/items-rebuild-counts.ts rehearse prod.sql
//
//   # Or around wrangler's own local D1, which applies the migration as CI will:
//   node scripts/items-rebuild-counts.ts snapshot <local.sqlite> before.json
//   node scripts/items-rebuild-counts.ts compare before.json <local.sqlite>
//
// Each prints every table's row count before and after, and exits 1 on any difference.
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  compare,
  foreignKeyProblems,
  REBUILD_MIGRATION,
  rowCounts,
  snapshot,
  type Snapshot,
} from './items-rebuild-check.ts';

const MIGRATION = fileURLToPath(
  new URL(`../migrations/${REBUILD_MIGRATION}`, import.meta.url).href,
);

function report(before: Snapshot, after: Snapshot, db: DatabaseSync): number {
  const a = rowCounts(before);
  const b = rowCounts(after);
  console.table(
    Object.keys({ ...a, ...b })
      .sort()
      .map((table) => ({ table, before: a[table], after: b[table] })),
  );
  const problems = [...compare(before, after), ...foreignKeyProblems(db)];
  for (const p of problems) console.error(`DIFFERENT: ${p}`);
  console.log(
    problems.length === 0
      ? 'Every table, row and index unchanged.'
      : `${problems.length} differences.`,
  );
  return problems.length === 0 ? 0 : 1;
}

function open(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function rehearse(exportFile: string): number {
  // An export lists tables in its own order, children before parents at times: load it with keys off, then check them.
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(exportFile, 'utf8'));
  db.exec('PRAGMA foreign_keys = ON');
  const broken = foreignKeyProblems(db);
  if (broken.length > 0)
    throw new Error(`The export has rows without parents: ${broken.slice(0, 5).join('; ')}`);
  const itemsSql = (
    db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'items'`).get() as
      { sql: string } | undefined
  )?.sql;
  if (!itemsSql) throw new Error('The export has no items table.');
  if (itemsSql.includes("'livehuddle'"))
    throw new Error(`The export already has ${REBUILD_MIGRATION} applied.`);

  const before = snapshot(db);
  const started = performance.now();
  db.exec('BEGIN');
  db.exec(readFileSync(MIGRATION, 'utf8'));
  db.exec('COMMIT');
  console.log(`${REBUILD_MIGRATION} took ${Math.round(performance.now() - started)} ms.`);
  const after = snapshot(db);
  const status = report(before, after, db);

  // A Space goes in, and an unknown app is still refused; neither is kept.
  db.exec('SAVEPOINT probe');
  db.exec(`INSERT INTO items (id, app, kind, owner_id, scope, title, created_at, updated_at)
           VALUES ('rehearsal-space', 'livehuddle', 'space', 'rehearsal', 'p:rehearsal', 'Space', 0, 0)`);
  let refused = false;
  try {
    db.exec(`INSERT INTO items (id, app, kind, owner_id, scope, title, created_at, updated_at)
             VALUES ('rehearsal-nope', 'livenope', 'space', 'rehearsal', 'p:rehearsal', 'Nope', 0, 0)`);
  } catch {
    refused = true;
  }
  db.exec('ROLLBACK TO probe');
  db.exec('RELEASE probe');
  console.log(
    `A livehuddle Space goes in; an unknown app is ${refused ? 'refused' : 'NOT refused'}.`,
  );
  return refused ? status : 1;
}

const [command, first, second] = process.argv.slice(2);
if (command === 'rehearse' && first) {
  process.exit(rehearse(first));
} else if (command === 'snapshot' && first && second) {
  writeFileSync(second, JSON.stringify(snapshot(open(first)), null, 2));
  console.log(`Wrote ${second}.`);
} else if (command === 'compare' && first && second) {
  const db = open(second);
  process.exit(report(JSON.parse(readFileSync(first, 'utf8')) as Snapshot, snapshot(db), db));
} else {
  console.error(
    'Usage: node scripts/items-rebuild-counts.ts rehearse <export.sql>\n' +
      '       node scripts/items-rebuild-counts.ts snapshot <db.sqlite> <before.json>\n' +
      '       node scripts/items-rebuild-counts.ts compare <before.json> <db.sqlite>',
  );
  process.exit(2);
}
