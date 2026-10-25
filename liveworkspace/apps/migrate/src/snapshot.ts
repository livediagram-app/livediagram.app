// `migrate snapshot <export.sql> <out.sqlite>` (docs/migration.md "Tooling"): loads a `wrangler d1 export` of the old
// database into a local SQLite file that everything after reads. Read-only toward the old account: it takes a file
// already exported, never a database. A snapshot whose last `d1_migrations` row isn't OLD_SCHEMA_LEVEL is refused
// (and its file removed), so the readers never run against a schema they weren't written for.
//
// The export is streamed: statements are cut at each `;` outside quotes and comments and run in batched
// transactions, so a multi-GB export loads in bounded memory.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { OLD_SCHEMA_LEVEL } from '@liveworkspace/migration';

/** Cuts SQL text into statements, chunk by chunk: a `;` ends one only outside quotes, identifiers and comments (and,
 *  in a CREATE TRIGGER, only after its END). */
export class StatementSplitter {
  private buffer = '';
  private state: 'code' | "'" | '"' | '`' | '[' | 'line' | 'block' = 'code';
  private scanned = 0;

  /** Feeds a chunk; returns the statements it completed. */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const out: string[] = [];
    let start = 0;
    const text = this.buffer;
    let i = this.scanned;
    for (; i < text.length; i++) {
      const c = text[i]!;
      // Every check below looks one character ahead: at the chunk's end, wait for the next one.
      if (i + 1 >= text.length && this.final === false) break;
      switch (this.state) {
        case 'code':
          if (c === "'" || c === '"' || c === '`' || c === '[') this.state = c;
          else if (c === '-' && text[i + 1] === '-') {
            this.state = 'line';
            i++;
          } else if (c === '/' && text[i + 1] === '*') {
            this.state = 'block';
            i++;
          } else if (c === ';') {
            const statement = text.slice(start, i + 1).trim();
            if (
              /^CREATE\s+(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(statement) &&
              !/\bEND\s*;$/i.test(statement)
            ) {
              break;
            }
            if (statement !== ';') out.push(statement);
            start = i + 1;
          }
          break;
        case "'":
        case '"':
        case '`':
          if (c === this.state) {
            // A doubled quote is the quote itself; stay inside.
            if (text[i + 1] === c) i++;
            else this.state = 'code';
          }
          break;
        case '[':
          if (c === ']') this.state = 'code';
          break;
        case 'line':
          if (c === '\n') this.state = 'code';
          break;
        case 'block':
          if (c === '*' && text[i + 1] === '/') {
            this.state = 'code';
            i++;
          }
          break;
      }
    }
    // Resume where the scan stopped (a character skipped past the end, as by `''`, is the next chunk's first).
    this.buffer = text.slice(start);
    this.scanned = i - start;
    return out;
  }

  private final = false;

  /** What is left once the input ends: any statements still waiting on a look-ahead, and a last statement without
   *  its `;`. */
  end(): string[] {
    this.final = true;
    const out = this.push('');
    const rest = this.buffer.trim();
    this.buffer = '';
    this.scanned = 0;
    this.final = false;
    if (rest && !/^(--[^\n]*\n?\s*)*$/.test(rest)) out.push(rest);
    return out;
  }
}

// What an export may hold that a local SQLite file must not run: SQLite's own tables, and D1's.
function skipped(statement: string): boolean {
  return (
    /^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["`]?(sqlite_|_cf_)/i.test(statement) ||
    /^INSERT\s+INTO\s+["`]?_cf_/i.test(statement) ||
    /^PRAGMA\b/i.test(statement) ||
    /^(BEGIN|COMMIT|END)(\s+TRANSACTION)?\s*;$/i.test(statement)
  );
}

export type SnapshotMeta = {
  level: string;
  exportSha256: string;
  exportBytes: number;
  statements: number;
  snapshotAt: number;
};

const TRANSACTION_STATEMENTS = 10_000;

/** Loads `exportPath` into a new SQLite file at `outPath`. Refuses an existing file and the wrong schema level. */
export async function snapshot(
  exportPath: string,
  outPath: string,
  now = Date.now(),
): Promise<SnapshotMeta> {
  if (existsSync(outPath))
    throw new Error(`${outPath} already exists: a snapshot is never written over`);
  const db = new DatabaseSync(outPath);
  try {
    db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA foreign_keys = OFF;');
    const hash = createHash('sha256');
    const splitter = new StatementSplitter();
    let bytes = 0;
    let statements = 0;
    let pending = 0;
    const run = (statement: string) => {
      if (skipped(statement)) return;
      try {
        db.exec(statement);
      } catch (error) {
        // SQLite keeps sqlite_sequence itself; a row the export carries for it may come before its table exists.
        if (/^INSERT\s+INTO\s+["`]?sqlite_sequence/i.test(statement)) return;
        throw new Error(
          `Statement ${statements + 1} failed: ${(error as Error).message}\n${statement.slice(0, 300)}`,
          {
            cause: error,
          },
        );
      }
      statements++;
      if (++pending >= TRANSACTION_STATEMENTS) {
        db.exec('COMMIT; BEGIN');
        pending = 0;
      }
    };
    db.exec('BEGIN');
    const stream = createReadStream(exportPath);
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      hash.update(chunk);
      bytes += chunk.length;
      for (const statement of splitter.push(decoder.decode(chunk, { stream: true })))
        run(statement);
    }
    for (const statement of splitter.push(decoder.decode())) run(statement);
    for (const statement of splitter.end()) run(statement);
    db.exec('COMMIT');

    const level = schemaLevel(db);
    if (level !== OLD_SCHEMA_LEVEL) {
      throw new Error(
        `The export is at schema level ${level ?? '(no d1_migrations)'}, not ${OLD_SCHEMA_LEVEL}: refused`,
      );
    }
    const meta: SnapshotMeta = {
      level,
      exportSha256: hash.digest('hex'),
      exportBytes: bytes,
      statements,
      snapshotAt: now,
    };
    db.exec('CREATE TABLE _migrate_snapshot (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const put = db.prepare('INSERT INTO _migrate_snapshot (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(meta)) put.run(key, String(value));
    db.close();
    return meta;
  } catch (error) {
    try {
      db.close();
    } catch {
      // Already closed.
    }
    rmSync(outPath, { force: true });
    throw error;
  }
}

const decoder = new TextDecoder('utf-8');

/** The last row of the old database's `d1_migrations`, or null when it has none. */
export function schemaLevel(db: DatabaseSync): string | null {
  const table = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'")
    .get();
  if (!table) return null;
  const row = db.prepare('SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1').get() as
    { name: string } | undefined;
  return row?.name ?? null;
}

/** Opens a snapshot to read, checking it is one: its level and when it was taken. */
export function openSnapshot(path: string): { db: DatabaseSync; meta: SnapshotMeta } {
  if (!existsSync(path)) throw new Error(`No snapshot at ${path}`);
  const db = new DatabaseSync(path, { readOnly: true });
  const level = schemaLevel(db);
  if (level !== OLD_SCHEMA_LEVEL) {
    db.close();
    throw new Error(`${path} is at schema level ${level}, not ${OLD_SCHEMA_LEVEL}: refused`);
  }
  const rows = db.prepare('SELECT key, value FROM _migrate_snapshot').all() as {
    key: string;
    value: string;
  }[];
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    db,
    meta: {
      level,
      exportSha256: m.exportSha256 ?? '',
      exportBytes: Number(m.exportBytes ?? 0),
      statements: Number(m.statements ?? 0),
      snapshotAt: Number(m.snapshotAt ?? 0),
    },
  };
}
