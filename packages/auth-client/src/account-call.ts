// One internal call to the account API with the app's client credentials, shared by account.ts,
// account-settings.ts, workbench.ts and invitations.ts. Worker only: it sends the client secret.

import { basicAuthorization, type ClientCredentials } from './oauth';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';

const ACCOUNT_PATH = '/api/account/internal';

// One internal call to the account API with the app's client credentials (also workbench.ts's and
// invitations.ts's).
export async function call(
  credentials: ClientCredentials,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  fetcher: typeof fetch,
): Promise<Response> {
  return fetcher(`${withoutTrailingSlashes(credentials.accountsUrl)}${ACCOUNT_PATH}${path}`, {
    method: init.method,
    headers: {
      authorization: basicAuthorization(credentials),
      accept: 'application/json',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
