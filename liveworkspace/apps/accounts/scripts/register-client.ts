// Registers an app with the accounts Worker and prints its client id and secret once.
// Store the secret in the app as a Worker secret; it can't be read back later.
//
//   ADMIN_TOKEN=… node scripts/register-client.ts \
//     --accounts https://www.liveworkspace.app \
//     --name livediagram \
//     --app livediagram.app \
//     --redirect https://www.livediagram.app/api/auth/callback \
//     --redirect https://livediagram.app/api/auth/callback \
//     --resource https://livediagram.app/api
//
// A platform service (the subscription Worker) passes --no-app in place of --app: it is no app, so every per-app
// route refuses it (accounts.md "Which app a client is"). Its --redirect is never used; any https URL of its own.
//
// One --redirect per origin the app serves (www and bare). The Worker adds each origin's /auth/guest, where the
// guest hand-off returns, so it is never left out.
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    accounts: { type: 'string', default: 'http://localhost:3000' },
    name: { type: 'string' },
    redirect: { type: 'string', multiple: true },
    resource: { type: 'string' },
    // The app it is, as @liveworkspace/sites spells it: what of a person's it may reach.
    app: { type: 'string' },
    'no-app': { type: 'boolean', default: false },
  },
});

const adminToken = process.env.ADMIN_TOKEN;
const noApp = values['no-app'];
if (
  !adminToken ||
  !values.name ||
  !values.redirect?.length ||
  !values.resource ||
  noApp === Boolean(values.app)
) {
  console.error(
    'Needs ADMIN_TOKEN in the environment, plus --name, one of --app or --no-app, --redirect (1+) and --resource.',
  );
  process.exit(1);
}

const response = await fetch(new URL('/api/auth/internal/clients', values.accounts), {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
  body: JSON.stringify({
    name: values.name,
    redirectUris: values.redirect,
    resource: values.resource,
    app: noApp ? null : values.app,
  }),
});
const body = await response.text();
if (!response.ok) {
  console.error(`Registration failed (${response.status}): ${body}`);
  process.exit(1);
}
console.log(JSON.stringify(JSON.parse(body), null, 2));
