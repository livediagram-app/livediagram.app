'use client';

// The MCP OAuth consent screen (docs/specs/015-api/mcp-server.md §3): the shared page, bound to this editor's facts.
import { createOauthConsentPage } from '@liveworkspace/workbench/components/oauth/OauthConsentPage';
import { OAUTH_PAGES } from '../oauth-shell';

export default createOauthConsentPage(OAUTH_PAGES);
