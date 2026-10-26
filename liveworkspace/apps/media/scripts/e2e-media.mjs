// liveworkspace's media service for an app's e2e stack (liveworkspace/docs/specs/006-media/media.md): the real Worker under
// `wrangler dev --local`, on a fresh local D1 and R2 of its own (apart from a developer's `wrangler dev` state), with
// a test-only key for each app the stack names. The app's api is then started with `MEDIA_URL` and `MEDIA_KEY` from
// what this returns, so its image routes (upload, gallery, bytes, account merges) run end to end.
//
// Dependency-free (node builtins); the stack hands in its own `run` (spawns and tracks a child for teardown) and
// `waitForExit`, so the media Worker is torn down with the rest of the stack.

import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MEDIA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The key a stack's api sends as MEDIA_KEY, the same one this media Worker is given for the app. Test-only. */
export const e2eMediaKey = (app) => `e2e-media-key-${app}`;

// `livediagram.app` → MEDIA_KEY_LIVEDIAGRAM (src/env.ts).
const keyVar = (app) => `MEDIA_KEY_${app.replace(/\.app$/, '').toUpperCase()}`;

/**
 * Applies the media migrations to a fresh local D1 under `state`, then starts the Worker on `port` (its inspector on
 * port + 1000). Returns the service's API URL for the api's MEDIA_URL. Wait on `port` before the api's first upload.
 */
export async function startE2EMedia({ run, waitForExit, port, state, apps }) {
  rmSync(state, { recursive: true, force: true });
  console.log('[e2e] applying the media local D1 migrations…');
  await waitForExit(
    run(
      'pnpm',
      [
        'exec',
        'wrangler',
        'd1',
        'migrations',
        'apply',
        'liveworkspace-media',
        '--local',
        '--persist-to',
        state,
      ],
      { cwd: MEDIA_DIR },
    ),
  );
  console.log('[e2e] starting media…');
  run(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(port),
      '--inspector-port',
      String(port + 1000),
      '--persist-to',
      state,
      // Only this stack's keys, never what a developer's .dev.vars names.
      ...apps.flatMap((app) => ['--var', `${keyVar(app)}:${e2eMediaKey(app)}`]),
    ],
    { cwd: MEDIA_DIR },
  );
  return `http://127.0.0.1:${port}/api/media`;
}
