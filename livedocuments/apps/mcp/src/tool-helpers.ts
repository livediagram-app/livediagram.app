// Shared result / auth plumbing for the MCP tools (docs/specs/015-api/mcp-server.md): the text and
// error result shapes, the deep links, the bearer-token guard every tool
// uses, and the load-a-tab sequence the read and edit tools share.
// Deliberately render-free, so it can be unit-tested: the inline-PNG
// result lives in image-result.ts and the pure tab builders in @livedocuments/document
// and @livedocuments/templates. tools.ts keeps the registrations.

import type { LiveDoc, DocumentResponse, TabRecord, TabResponse } from '@livedocuments/api-schema';
import { apiJson } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { ToolInputError } from '@liveworkspace/mcp-kit/tool-result';

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
// (CONSENT_BASE_URL, as the consent and device pages use), livedocuments.app otherwise.
export const appBase = (env: Pick<Env, 'CONSENT_BASE_URL'>) =>
  env.CONSENT_BASE_URL ?? 'https://livedocuments.app';

export const deepLink = (env: Pick<Env, 'CONSENT_BASE_URL'>, id: string) =>
  `${appBase(env)}/document/${id}`;

// A share link's public URL (docs/specs/013-workspace/share-password.md): visitors land on /document/shared?s=<code>
// and the app resolves the code to the document + granted role.
export const shareUrl = (env: Pick<Env, 'CONSENT_BASE_URL'>, code: string) =>
  `${appBase(env)}/document/shared?s=${encodeURIComponent(code)}`;

// Load a document and one of its tabs: the named tab, or the first one when the
// caller didn't name one (the default every tab-scoped tool applies). Null when
// the document has no tabs to default to; a tab id the document lacks is a ToolInputError naming its tabs.

export async function loadTab(
  env: Env,
  token: string,
  documentId: string,
  tabId?: string,
): Promise<{ document: LiveDoc; tab: TabRecord } | null> {
  const { document: liveDoc } = await apiJson<DocumentResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(documentId)}`,
  );
  const id = tabId ?? liveDoc.tabs[0]?.id;
  if (!id) return null;
  if (!liveDoc.tabs.some((t) => t.id === id))
    throw new ToolInputError(
      `No tab "${id}" in this document. Tabs: ${liveDoc.tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
    );
  const { tab } = await apiJson<TabResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(id)}`,
  );
  return { document: liveDoc, tab };
}
