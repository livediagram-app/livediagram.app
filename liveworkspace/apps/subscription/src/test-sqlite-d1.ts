import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { serviceD1 } from '@liveworkspace/api-kit/testing/service-d1';
import type { Env } from './env';

// A REAL D1 for tests (@liveworkspace/api-kit testing/service-d1.ts): an in-memory SQLite database with every
// migration applied and foreign keys on, behind the D1 surface the service calls. Not a `.test.ts` file,
// so vitest doesn't collect it.

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url).href);

export type TestDb = {
  env: Env;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
};

export function testDb(overrides: Partial<Env> = {}): TestDb {
  const { db, sql } = serviceD1(MIGRATIONS_DIR);

  return {
    env: {
      ENVIRONMENT: 'development',
      PRO_ENABLED: 'true',
      BILLING_PROVIDER: 'mock',
      SITE_ORIGIN: 'http://localhost:3000',
      SUBSCRIPTION_DB: db,
      SUBSCRIPTION_KEY_LIVEDIAGRAM: 'ld-key',
      SUBSCRIPTION_KEY_LIVEPLANNER: 'lp-key',
      SUBSCRIPTION_KEY_LIVEWORKSPACE: 'lw-key',
      ...overrides,
    },
    sql,
  };
}
