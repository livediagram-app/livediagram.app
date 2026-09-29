// Shared result / auth plumbing for the MCP tools (docs/specs/015-api/mcp-server.md): the text and
// error result shapes, the deep links, the bearer-token guard every tool
// uses, and the load-a-tab sequence the read and edit tools share.
// Deliberately render-free, so it can be unit-tested: the inline-PNG
// result lives in image-result.ts and the pure tab builders in
// tab-builders.ts, for the same reason. tools.ts keeps the registrations.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { LiveDoc, DocumentResponse, TabRecord, TabResponse } from '@livediagram/api-schema';
import { apiJson } from './api';
import type { Env } from './env';

export type Extra = RequestHandlerExtra<never, never>;
// A success carries its result object as `structuredContent` (validated by the
// SDK against the tool's outputSchema, docs/specs/015-api/mcp-server.md §4.17) and the same object
// as the first text block for clients that only read `content`.
export type StructuredValue = Record<string, unknown>;
export type ToolResult = {
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
  structuredContent?: StructuredValue;
  isError?: boolean;
};

export const deepLink = (id: string) => `https://livediagram.app/diagram/${id}`;

// A share link's public URL (docs/specs/013-workspace/share-password.md): visitors land on /diagram/shared?s=<code>
// and the app resolves the code to the diagram + granted role.
export const shareUrl = (code: string) =>
  `https://livediagram.app/diagram/shared?s=${encodeURIComponent(code)}`;

export function requireToken(extra: Extra): string {
  const token = extra.authInfo?.token;
  if (!token) throw new Error('unauthorized: no bearer token');
  return token;
}

export function textResult(value: StructuredValue): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// Load a diagram and one of its tabs: the named tab, or the first one when the
// caller didn't name one (the default every tab-scoped tool applies). Null when
// the diagram has no tabs to default to; an unknown id surfaces as the api's
// own ApiError, like every other call.
export async function loadTab(
  env: Env,
  token: string,
  documentId: string,
  tabId?: string,
): Promise<{ document: LiveDoc; tab: TabRecord } | null> {
  const { document: liveDoc } = await apiJson<DocumentResponse>(
    env,
    token,
    `/diagrams/${documentId}`,
  );
  const id = tabId ?? liveDoc.tabs[0]?.id;
  if (!id) return null;
  const { tab } = await apiJson<TabResponse>(env, token, `/diagrams/${documentId}/tabs/${id}`);
  return { document: liveDoc, tab };
}
