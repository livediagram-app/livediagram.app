// A test Env: D1 as a real SQLite database (node:sqlite) with the Worker's own migrations applied, so the tests run
// the same SQL the Worker does.

import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '@liveworkspace/api-kit/testing/sqlite-d1';
import type { Env } from './env';

const MIGRATIONS = join(import.meta.dirname, '../migrations');

export function testEnv(overrides: Partial<Env> = {}): Env & { raw: DatabaseSync } {
  const { db, raw } = sqliteD1(MIGRATIONS);
  return {
    ENVIRONMENT: 'production',
    PLATFORM_ORIGIN: 'https://lw.example',
    STATUS_DB: db,
    ...overrides,
    raw,
  };
}
