// Writes every app's local OAuth client (scripts/local-clients.ts) into the LOCAL accounts database, as the `dev` script
// does after its migrations (liveworkspace/docs/specs/003-accounts/sign-in.md "Local clients"). Never remote: it always
// passes --local, and takes no --remote or --env.
//
//   node scripts/seed-local-clients.ts                         # the checkout's own local database
//   node scripts/seed-local-clients.ts --persist-to <dir>      # a stack whose state lives elsewhere
//   LOCAL_CLIENT_ORIGINS=livedesign.app=http://localhost:3660 node scripts/seed-local-clients.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { LOCAL_CLIENTS, localClientsSql, parseExtraOrigins } from './local-clients.ts';

const { values } = parseArgs({ options: { 'persist-to': { type: 'string' } } });
const { origins, refused } = parseExtraOrigins(process.env.LOCAL_CLIENT_ORIGINS);
for (const item of refused) {
  console.warn(
    `[local-clients] LOCAL_CLIENT_ORIGINS: skipped "${item}" (needs <app>.app=http://localhost:<port>)`,
  );
}

const dir = mkdtempSync(path.join(tmpdir(), 'local-clients-'));
const file = path.join(dir, 'seed.sql');
try {
  writeFileSync(file, localClientsSql(new Date().toISOString(), origins));
  execFileSync(
    'wrangler',
    [
      'd1',
      'execute',
      'liveworkspace-accounts',
      '--local',
      ...(values['persist-to'] ? ['--persist-to', values['persist-to']] : []),
      '--file',
      file,
    ],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url).href),
      // Its table of rows written is noise in the dev log; a failure still prints.
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, CI: '1' },
    },
  );
  console.log(
    `[local-clients] ${LOCAL_CLIENTS.map((client) => client.clientId).join(', ')} ready in the local accounts database`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
