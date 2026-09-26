// Shared result / auth plumbing for the MCP tools (docs/specs/015-api/mcp-server.md): the text and
// error result shapes, the deep links, the bearer-token guard every tool
// uses, and the load-a-tab sequence the read and edit tools share.
// Deliberately render-free, so it can be unit-tested: the inline-PNG
// result lives in image-result.ts and the pure tab builders in
// tab-builders.ts, for the same reason. tools.ts keeps the registrations.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Diagram, DiagramResponse, TabRecord, TabResponse } from '@livediagram/api-schema';
import { apiJson } from './api';
import type { Env } from './env';

export type Extra = RequestHandlerExtra<never, never>;
export type ToolResult = {
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
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

export function textResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
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
  diagramId: string,
  tabId?: string,
): Promise<{ diagram: Diagram; tab: TabRecord } | null> {
  const { diagram } = await apiJson<DiagramResponse>(env, token, `/diagrams/${diagramId}`);
  const id = tabId ?? diagram.tabs[0]?.id;
  if (!id) return null;
  const { tab } = await apiJson<TabResponse>(env, token, `/diagrams/${diagramId}/tabs/${id}`);
  return { diagram, tab };
}
