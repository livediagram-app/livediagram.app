// Shared result / auth plumbing for the MCP tools (docs/specs/015-api/mcp-server.md): the text and
// error result shapes, the deep links and the bearer-token guard every tool uses.
// Deliberately render-free, so it can be unit-tested: the inline-PNG
// result lives in image-result.ts. tools.ts keeps the registrations.

import type { Env } from '@liveworkspace/mcp-kit/env';

// The result shapes, the token guard and ToolInputError every product's tools share.
export {
  errorResult,
  requireToken,
  textResult,
  ToolInputError,
  viewResult,
  type Extra,
  type StructuredValue,
  type ToolResult,
} from '@liveworkspace/mcp-kit/tool-result';

// The editor app this MCP server belongs to: its own host on staging
// (CONSENT_BASE_URL, as the consent and device pages use), liveknowledge.app otherwise.
export const appBase = (env: Pick<Env, 'CONSENT_BASE_URL'>) =>
  env.CONSENT_BASE_URL ?? 'https://www.liveknowledge.app';

export const deepLink = (env: Pick<Env, 'CONSENT_BASE_URL'>, id: string) =>
  `${appBase(env)}/document/${id}`;

// A share link's public URL (docs/specs/013-workspace/share-password.md): visitors land on /document/shared?s=<code>
// and the app resolves the code to the document + granted role.
export const shareUrl = (env: Pick<Env, 'CONSENT_BASE_URL'>, code: string) =>
  `${appBase(env)}/document/shared?s=${encodeURIComponent(code)}`;
