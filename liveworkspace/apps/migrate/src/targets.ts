// Where apply writes, per environment: the liveworkspace services' D1 databases and media bucket (each named by its
// own wrangler.toml, which pins the liveworkspace account), the old bucket it reads, and the livediagram MCP's
// OAUTH_KV. test/targets.test.ts checks these against the wrangler.toml files, so a renamed database fails a test,
// not a run.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationApp } from '@liveworkspace/migration';
import type { Db } from './sql.ts';

export type Env = 'staging' | 'production';

/** The repository root (this file is liveworkspace/apps/migrate/src/targets.ts). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const SERVICE_OF: Record<Db, string> = {
  accounts: 'accounts',
  index: 'index',
  media: 'media',
  community: 'community',
};

/** A service's wrangler.toml, relative to the repository root. */
export const configOf = (db: Db): string =>
  join('liveworkspace', 'apps', SERVICE_OF[db], 'wrangler.toml');

export function databaseOf(db: Db, env: Env): string {
  return `liveworkspace-${db}${env === 'staging' ? '-staging' : ''}`;
}

export const mediaBucketOf = (env: Env): string =>
  env === 'staging' ? 'liveworkspace-media-staging' : 'liveworkspace-media';

/** The old site's image bucket, on the old account (MIGRATE_SOURCE_ACCOUNT_ID). Read only. */
export const OLD_IMAGES_BUCKET = 'livediagram-images';

/** The livediagram MCP's OAUTH_KV namespace (livediagram/apps/mcp/wrangler.toml). */
export const OAUTH_KV: Record<Env, string> = {
  production: '1a32ea4a20b74c55938025fae41bb9a8',
  staging: '954c6ba27a194650bcc1ded564821527',
};
export const MCP_CONFIG = join('livediagram', 'apps', 'mcp', 'wrangler.toml');

/** The liveworkspace account every target is on (AGENTS.md). */
export const TARGET_ACCOUNT_ID = '851be7d244b76a6557bcbe6c4ded80f5';

/** The env var naming an app api's origin for the migration door, and the one holding its MIGRATION_KEY. */
export const originVar = (app: MigrationApp): string => `MIGRATE_ORIGIN_${app.toUpperCase()}`;
export const keyVar = (app: MigrationApp): string => `MIGRATION_KEY_${app.toUpperCase()}`;

// The old account's credentials (read the old bucket) and the new one's (everything else). Kept apart: no command
// ever runs with both, and the ambient CLOUDFLARE_* variables are never passed through.
export const SOURCE_ACCOUNT_VAR = 'MIGRATE_SOURCE_ACCOUNT_ID';
export const SOURCE_TOKEN_VAR = 'MIGRATE_SOURCE_API_TOKEN';
export const TARGET_TOKEN_VAR = 'MIGRATE_TARGET_API_TOKEN';
