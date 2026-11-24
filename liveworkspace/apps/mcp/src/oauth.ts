// The one MCP's authorization server (liveworkspace/docs/specs/021-mcp/mcp.md "Sign-in and per-app consent"): its
// consent page is liveworkspace.app's /oauth/consent, and each grant keeps the apps the person ticked.
import type { OauthServer } from '@liveworkspace/mcp-kit/oauth';
import { keepGrant } from './grants';
import type { RequestEnv } from './server';

export const HOSTED_CONSENT = 'https://www.liveworkspace.app';

export const OAUTH: OauthServer<RequestEnv> = {
  appBase: (env) => env.CONSENT_BASE_URL ?? HOSTED_CONSENT,
  // No CLI of its own: each app's CLI signs in to its own MCP.
  builtInClients: {},
  onGrant: (env, token, body) => keepGrant(env.OAUTH_KV, token, body.apps),
};
