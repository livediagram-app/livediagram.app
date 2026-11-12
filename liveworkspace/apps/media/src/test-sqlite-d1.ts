import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { serviceD1 } from '@liveworkspace/api-kit/testing/service-d1';
import type { Env } from './env';

// A REAL D1 for tests (@liveworkspace/api-kit testing/service-d1.ts): an in-memory SQLite database with every
// migration applied and foreign keys on, behind the D1 surface the service calls, and an R2 bucket in memory. Not a `.test.ts` file,
// so vitest doesn't collect it.

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

export function testDb(overrides: Partial<Env> = {}): TestDb {
  const { db, sql } = serviceD1(MIGRATIONS_DIR);

  const bucket = memoryBucket();
  return {
    env: {
      MEDIA_DB: db,
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
