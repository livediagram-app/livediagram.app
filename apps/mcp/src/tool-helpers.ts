// Shared result / auth plumbing for the MCP tools (spec/62): the text and
// error result shapes, the deep links, and the bearer-token guard every tool
// uses. Deliberately render-free, so it can be unit-tested — the inline-PNG
// result lives in image-result.ts and the pure tab builders in
// tab-builders.ts, for the same reason. tools.ts keeps the registrations.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export type Extra = RequestHandlerExtra<never, never>;
export type ToolResult = {
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
  isError?: boolean;
};

export const deepLink = (id: string) => `https://livediagram.app/diagram/${id}`;

// A share link's public URL (spec/24): visitors land on /diagram/shared?s=<code>
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
