// Says which app each OAuth client is, for clients registered before register-client.ts took --app
// (liveworkspace/docs/specs/003-accounts/accounts.md "Which app a client is"). Without --client, every client not yet
// mapped whose name is an app's (`livediagram`) or its local one (`livediagram-dev`) gets that app;
// with --client and --app, that one client does. Runs SQL through wrangler, so it needs no secret.
//
//   node scripts/map-clients.ts --local                       # the local dev clients
//   node scripts/map-clients.ts --remote --env staging
//   node scripts/map-clients.ts --local --client <client id> --app liveplanner.app
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const APPS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const;
const DATABASE = 'liveworkspace-accounts';

const { values } = parseArgs({
  options: {
    local: { type: 'boolean', default: false },
    remote: { type: 'boolean', default: false },
    env: { type: 'string' },
    client: { type: 'string' },
    app: { type: 'string' },
  },
});

if (values.local === values.remote) {
  console.error('Pass exactly one of --local or --remote.');
  process.exit(1);
}
if (Boolean(values.client) !== Boolean(values.app)) {
  console.error('--client and --app go together.');
  process.exit(1);
}
if (values.app && !APPS.some((app) => `${app}.app` === values.app)) {
  console.error(`--app must be one of: ${APPS.map((app) => `${app}.app`).join(', ')}`);
  process.exit(1);
}
// The id is typed by whoever runs this; it still never reaches the SQL unquoted.
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

// Name-based: `<app>` and `<app>-dev` are the names the docs register each app under.
const byName = APPS.map(
  (app) => `WHEN '${app}' THEN '${app}.app' WHEN '${app}-dev' THEN '${app}.app'`,
).join(' ');
const sql = values.client
  ? `INSERT INTO oauth_client_app (clientId, app) SELECT clientId, ${quote(values.app!)} FROM oauthClient WHERE clientId = ${quote(values.client)} ON CONFLICT (clientId) DO UPDATE SET app = excluded.app;`
  : `INSERT OR IGNORE INTO oauth_client_app (clientId, app) SELECT clientId, CASE name ${byName} END FROM oauthClient WHERE (CASE name ${byName} END) IS NOT NULL;`;
const report =
  'SELECT c.clientId, c.name, a.app FROM oauthClient c LEFT JOIN oauth_client_app a ON a.clientId = c.clientId ORDER BY c.name;';

const run = (command: string) =>
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      DATABASE,
      values.local ? '--local' : '--remote',
      ...(values.env ? ['--env', values.env] : []),
      '--command',
      command,
    ],
    { cwd: fileURLToPath(new URL('..', import.meta.url).href), stdio: 'inherit' },
  );

run(sql);
run(report);
