import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { Env } from './env';

// A REAL D1 for tests: an in-memory SQLite database with every migration applied, behind the D1
// prepare/bind/first/all/run/batch surface the service calls, as the Community service's tests have it,
// and an R2 bucket in memory. Not a `.test.ts` file, so vitest doesn't collect it.

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url).href);

export type TestDb = {
  env: Env;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
  // What the bucket holds, by key.
  objects: Map<
    string,
    { bytes: Uint8Array; contentType?: string; customMetadata?: Record<string, string> }
  >;
};

// D1 binds a boolean as 1 / 0; node:sqlite refuses one outright.
function toSql(value: unknown): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: undefined is not a bindable value');
  return value as SQLInputValue;
}

export function testDb(overrides: Partial<Env> = {}): TestDb {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
  }

  const statement = (query: string, args: SQLInputValue[]) => {
    const rows = () =>
      sql
        .prepare(query)
        .all(...args)
        .map((row) => ({ ...row }));
    return {
      bind: (...next: unknown[]) => statement(query, next.map(toSql)),
      first: async (column?: string) => {
        const row = rows()[0] ?? null;
        return column && row ? (row[column] ?? null) : row;
      },
      all: async () => ({ results: rows(), success: true, meta: {} }),
      run: async () => {
        const res = sql.prepare(query).run(...args);
        return { success: true, meta: { changes: Number(res.changes) } };
      },
      // What D1's batch hands back per statement: a read's rows, a write's change count.
      batchResult: async () => {
        const prepared = sql.prepare(query);
        if (prepared.columns().length > 0) {
          return { results: rows(), success: true, meta: { changes: 0 } };
        }
        const res = prepared.run(...args);
        return { results: [], success: true, meta: { changes: Number(res.changes) } };
      },
    };
  };

  // D1 runs a batch as one transaction: all of it lands or none of it does. Batches queue behind one
  // another, as D1 serialises them.
  let batches: Promise<unknown> = Promise.resolve();
  const runBatch = async (statements: { batchResult: () => Promise<unknown> }[]) => {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const s of statements) results.push(await s.batchResult());
      sql.exec('COMMIT');
      return results;
    } catch (err) {
      sql.exec('ROLLBACK');
      throw err;
    }
  };
  const db = {
    prepare: (query: string) => statement(query, []),
    batch: (statements: { batchResult: () => Promise<unknown> }[]) => {
      const run = batches.then(() => runBatch(statements));
      batches = run.catch(() => undefined);
      return run;
    },
  };

  const bucket = memoryBucket();
  return {
    env: {
      ENVIRONMENT: 'development',
      MEDIA_DB: db as unknown as D1Database,
      MEDIA: bucket as unknown as R2Bucket,
      MEDIA_KEY_LIVEDIAGRAM: 'ld-key',
      MEDIA_KEY_LIVEDESIGN: 'lds-key',
      ...overrides,
    },
    sql,
    objects: bucket.objects,
  };
}

// An R2 bucket in memory: the put / get / list / delete the service calls, keyed like R2, with metadata.
type Stored = {
  bytes: Uint8Array;
  contentType?: string;
  customMetadata?: Record<string, string>;
};

function memoryBucket() {
  const objects = new Map<string, Stored>();
  const bytesOf = (value: string | ArrayBuffer | Uint8Array): Uint8Array =>
    typeof value === 'string'
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array
        ? value.slice()
        : new Uint8Array(value.slice(0));
  return {
    objects,
    put: async (
      key: string,
      value: string | ArrayBuffer | Uint8Array,
      options?: {
        httpMetadata?: { contentType?: string };
        customMetadata?: Record<string, string>;
      },
    ) => {
      objects.set(key, {
        bytes: bytesOf(value),
        contentType: options?.httpMetadata?.contentType,
        customMetadata: options?.customMetadata,
      });
    },
    get: async (key: string) => {
      const found = objects.get(key);
      if (!found) return null;
      return {
        body: new Blob([found.bytes]).stream(),
        size: found.bytes.byteLength,
        customMetadata: found.customMetadata ?? {},
        text: async () => new TextDecoder().decode(found.bytes),
      };
    },
    list: async ({ prefix = '' }: { prefix?: string; cursor?: string } = {}) => ({
      objects: [...objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })),
      truncated: false,
    }),
    delete: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
  };
}
