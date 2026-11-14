// A local database that is behind the migrations says so (liveworkspace/docs/specs/004-index/index-service.md "Local
// development"): `dev` applies the local migrations as it starts, but a `wrangler dev` that hot-reloads after a pull
// keeps the database it began with, and the first read of a column the new code needs (Most Used reads `opens`, 0007)
// fails with a bare 500. In development the failure also names its cause and the fix. Never on a deployed Worker: its
// migrations are applied by the deploy, and a missing column there is a bug to see as one.

import type { Env } from './env';

const MISSING_SCHEMA = /no such (?:table|column)/i;

export const STALE_LOCAL_DATABASE =
  '[index] the local database is behind the migrations (a table or column the code reads is missing). ' +
  'Run `corepack pnpm db:migrate:local` in liveworkspace/apps/index, or restart `dev`, which applies them.';

function messageOf(err: unknown): string {
  if (!(err instanceof Error)) return '';
  return `${err.message} ${err.cause instanceof Error ? err.cause.message : ''}`;
}

/** Warns, in development only, when `err` is a missing table or column. Returns whether it warned. */
export function warnIfLocalDatabaseStale(env: Pick<Env, 'ENVIRONMENT'>, err: unknown): boolean {
  if (env.ENVIRONMENT !== 'development' || !MISSING_SCHEMA.test(messageOf(err))) return false;
  console.warn(STALE_LOCAL_DATABASE);
  return true;
}
