// The Node \`URL\`, not the platform global (@cloudflare/workers-types declares its
// own, and the two are not interchangeable to the compiler).
import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { runtimeConfigFrom, type Env, type Runtime } from '@livediagram/api';
import type { IdentityConfig, RoomHost } from '@livediagram/runtime';
import { nodeHtml } from './html';
import { memoryLimiters, type MemoryLimiters } from './limiters';
import { applyMigrations, type MigrationRun } from './migrations';
import { diskObjectStore } from './object-store';
import { RoomRegistry } from '../rooms/registry';
import { nodeScheduler, type NodeScheduler } from './scheduler';
import { openSqliteDb, type SqliteDb } from './sqlite-db';

// The Node runtime: the seam answered from one process
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime").
//
// Everything above the seam is the api worker's own code — this file only answers
// the questions it asks. Configuration comes from the process environment through
// the same list the Worker reads its bindings against
// (apps/api/src/runtime/config.ts), so a variable that works on one deployment
// works on the other.

export type NodeRuntimeOptions = {
  /** The SQLite file. Its directory must exist; the file is created if absent. */
  databasePath: string;
  /** Where image bytes and document snapshots live. Created if absent. */
  objectsDir: string;
  /** The api's migration directory (apps/api/migrations). */
  migrationsDir: string;
  /** Defaults to process.env. */
  vars?: Record<string, string | undefined>;
  /** Phase 2 supplies the real room host; until then a deployment answers 501. */
  rooms?: RoomHost;
  /** Overrides the in-memory limiters, which tests use to pin a decision. */
  limiters?: MemoryLimiters;
  /** How often idle rooms are swept out of memory. Defaults to a minute. */
  roomSweepMs?: number;
};

export type NodeRuntime = {
  runtime: Runtime;
  /** The process's rooms, or null when a caller supplied its own host. */
  rooms: RoomRegistry | null;
  sqlite: SqliteDb;
  scheduler: NodeScheduler;
  limiters: MemoryLimiters;
  migrations: MigrationRun;
  /** Stop the schedules, wait for held promises, close the database. */
  close(): Promise<void>;
};

/**
 * The migration directory that ships with the api worker, as seen from the
 * sources (apps/server/src/runtime → apps/api/migrations). Tests run from the
 * sources; the bundled process resolves its own copy — see
 * \`resolveMigrationsDir\`.
 */
export const API_MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../api/migrations/', import.meta.url),
);

/**
 * Where the migrations are, whichever way this code is running.
 *
 * The two layouts differ because the process ships as a bundle
 * (\`pnpm --filter @livediagram/server build\`): from the sources the api's
 * directory is three levels up, from \`dist/main.mjs\` it is a copy beside the
 * bundle. Both are tried, and running from neither is an error rather than a
 * process that starts with an empty schema.
 */
export function resolveMigrationsDir(
  from: string,
  vars: Record<string, string | undefined> = {},
): string {
  if (vars.MIGRATIONS_DIR) return vars.MIGRATIONS_DIR;
  // Depth first: the sources keep main.ts one level above this file, the bundle
  // keeps its copy beside itself.
  const candidates = [
    '../../api/migrations/',
    '../../../api/migrations/',
    './migrations/',
    '../migrations/',
  ];
  for (const candidate of candidates) {
    const path = fileURLToPath(new URL(candidate, from));
    if (existsSync(path)) return path;
  }
  throw new Error(
    `no migrations found beside ${from} (looked for ${candidates.join(', ')}); set MIGRATIONS_DIR`,
  );
}

/**
 * Rooms are Phase 2. Until they exist a deployment answers 501, rather than
 * pretending a broadcast landed.
 */
const roomsNotServed: RoomHost = {
  for: () => ({
    fetch: async () =>
      new Response('realtime rooms are not served by this build yet', { status: 501 }),
  }),
};

function identityFrom(vars: Record<string, string | undefined>): IdentityConfig {
  const config = runtimeConfigFrom(vars);
  const identity: IdentityConfig = {};
  const jwksUrl = vars.AUTH_JWKS_URL ?? config.CLERK_JWKS_URL;
  const issuer = vars.AUTH_ISSUER ?? config.CLERK_ISSUER;
  const audience = vars.AUTH_AUDIENCE ?? config.CLERK_AUDIENCE;
  if (jwksUrl) identity.jwksUrl = jwksUrl;
  if (issuer) identity.issuer = issuer;
  if (audience) identity.audience = audience;
  return identity;
}

export function createNodeRuntime(options: NodeRuntimeOptions): NodeRuntime {
  const vars = options.vars ?? process.env;
  const sqlite = openSqliteDb(options.databasePath);
  const migrations = applyMigrations(sqlite.sql, options.migrationsDir);
  const limiters = options.limiters ?? memoryLimiters();
  const scheduler = nodeScheduler();
  const config = runtimeConfigFrom(vars);

  const runtime: Runtime = {
    ...config,
    db: sqlite.db,
    objects: diskObjectStore(options.objectsDir),
    rooms: options.rooms ?? roomsNotServed,
    limiters,
    scheduler,
    html: nodeHtml(),
    identity: identityFrom(vars),
    buildId: config.BUILD_ID,
  };

  // The rooms are built after the runtime because a room needs it: the room host
  // is installed on the runtime the same way Cloudflare's binding is. A caller
  // that supplied its own host (tests do) keeps it, and no sweeper runs.
  const rooms = options.rooms
    ? null
    : new RoomRegistry({
        env: runtime,
        sqlite,
        waitUntil: (promise) => scheduler.waitUntil(promise),
      });
  if (rooms) runtime.rooms = rooms;
  const stopSweeper = rooms
    ? setInterval(() => rooms.sweep(), options.roomSweepMs ?? 60_000)
    : null;
  stopSweeper?.unref?.();

  const stopTimers = scheduler.start();
  return {
    runtime,
    rooms,
    sqlite,
    scheduler,
    limiters,
    migrations,
    close: async () => {
      if (stopSweeper) clearInterval(stopSweeper);
      stopTimers();
      // 1001 is "going away": the client reconnects rather than treating it as a refusal.
      await rooms?.closeAll(1001, 'server shutting down');
      await scheduler.drain();
      sqlite.close();
    },
  };
}

// The Worker's env type is what the application reads; the Node runtime fills the
// same members from the environment. Re-exported so callers have one import.
export type { Env, Runtime };
