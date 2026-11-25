// The one MCP's authorization server (liveworkspace/docs/specs/021-mcp/mcp.md "Sign-in and per-app consent"): its
// consent page is liveworkspace.app's /oauth/consent, and each grant keeps the apps the person ticked.
import type { OauthServer } from '@liveworkspace/mcp-kit/oauth';
import { cliClients } from '@liveworkspace/mcp-kit/oauth-clients';
import { APPS } from './apps';
import { keepGrant } from './grants';
import type { RequestEnv } from './server';

export const HOSTED_CONSENT = 'https://www.liveworkspace.app';

// Each app's CLI client, as the app's api-schema names it (`<app>-cli`, "<app> CLI"); oauth.test.ts checks them.
export const CLI_CLIENTS = Object.assign(
  {},
  ...APPS.map((spec) => cliClients(`${spec.app}-cli`, `${spec.app} CLI`)),
) as ReturnType<typeof cliClients>;

export const OAUTH: OauthServer<RequestEnv> = {
  appBase: (env) => env.CONSENT_BASE_URL ?? HOSTED_CONSENT,
  // Each app's CLI signs in here (mcp.md "The app MCPs fold in"): its API names this server as `oauthIssuer`.
  builtInClients: CLI_CLIENTS,
  onGrant: (env, token, body) => keepGrant(env.OAUTH_KV, token, body.apps),
};
