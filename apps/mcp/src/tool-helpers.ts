// Shared result / auth plumbing for the MCP tools (docs/specs/015-api/mcp-server.md): the text and
// error result shapes, the deep links, the bearer-token guard every tool
// uses, and the load-a-tab sequence the read and edit tools share.
// Deliberately render-free, so it can be unit-tested: the inline-PNG
// result lives in image-result.ts and the pure tab builders in @livediagram/document
// and @livediagram/templates. tools.ts keeps the registrations.

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

export const deepLink = (id: string) => `https://livediagram.app/document/${id}`;

// A share link's public URL (docs/specs/013-workspace/share-password.md): visitors land on /document/shared?s=<code>
// and the app resolves the code to the document + granted role.
export const shareUrl = (code: string) =>
  `https://livediagram.app/document/shared?s=${encodeURIComponent(code)}`;

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

// A document view (docs/specs/024-agents/document-views.md): the view's text first, then one line of
// JSON naming the document, the tab, its revision and its link (VW55).
export function viewResult(
  text: string,
  meta: {
    id: string;
    name: string;
    tab: { id: string; name: string; rev: number; view: string };
    // Every tab, in order.
    tabs: { id: string; name: string }[];
    url: string;
  },
): ToolResult {
  const line = {
    id: meta.id,
    name: meta.name,
    tab: { id: meta.tab.id, name: meta.tab.name, rev: meta.tab.rev },
    tabs: meta.tabs,
    url: meta.url,
  };
  return {
    content: [{ type: 'text', text: `${text}\n${JSON.stringify(line)}` }],
    structuredContent: { ...meta, tab: { ...meta.tab, text } },
  };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// An input the caller can correct, thrown from deep in a handler and answered as a tool error by registerTool.
export class ToolInputError extends Error {}

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
