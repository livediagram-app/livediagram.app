// Registers an app with the accounts Worker and prints its client id and secret once.
// Store the secret in the app as a Worker secret; it can't be read back later.
//
//   ADMIN_TOKEN=… node scripts/register-client.ts \
//     --accounts https://liveworkspace.app \
//     --name livediagram \
//     --redirect https://www.livediagram.app/auth/callback \
//     --redirect https://livediagram.app/auth/callback \
//     --resource https://livediagram.app/api
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    accounts: { type: 'string', default: 'http://localhost:3300' },
    name: { type: 'string' },
    redirect: { type: 'string', multiple: true },
    resource: { type: 'string' },
  },
});

const adminToken = process.env.ADMIN_TOKEN;
if (!adminToken || !values.name || !values.redirect?.length || !values.resource) {
  console.error(
    'Needs ADMIN_TOKEN in the environment, plus --name, --redirect (1+) and --resource.',
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
  }),
});
const body = await response.text();
if (!response.ok) {
  console.error(`Registration failed (${response.status}): ${body}`);
  process.exit(1);
}
console.log(JSON.stringify(JSON.parse(body), null, 2));
