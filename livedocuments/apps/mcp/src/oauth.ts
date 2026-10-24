// This MCP's OAuth 2.1 authorization server (docs/specs/015-api/mcp-server.md §3, docs/specs/015-api/blueprints/cli.md
// "OAuth server"): @liveworkspace/mcp-kit's, configured with what is livedocuments's own. Its consent and device pages are
// on the editor (appBase: CONSENT_BASE_URL, or the hosted app), and the client it ships is its CLI.

import { CLI_CLIENT_ID, CLI_CLIENT_NAME } from '@livedocuments/api-schema';
import type { OauthServer } from '@liveworkspace/mcp-kit/oauth';
import { cliClients } from '@liveworkspace/mcp-kit/oauth-clients';
import type { Env } from './env';
import { appBase } from './tool-helpers';

export const OAUTH: OauthServer<Env> = {
  appBase,
  builtInClients: cliClients(CLI_CLIENT_ID, CLI_CLIENT_NAME),
};
