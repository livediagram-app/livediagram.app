// Shared result / auth plumbing for the MCP tools (spec/62): the text /
// error / inline-image result shapes and the bearer-token guard every tool
// uses. The pure tab builders live in tab-builders.ts (render-free so they
// unit-test); tools.ts keeps the tool registrations themselves.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { renderElementsToSvg, type Tab } from '@livediagram/diagram';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
import { resolveIconExportArt } from '@livediagram/icons/resolve';
import { svgToPngBase64 } from './render';

export type Extra = RequestHandlerExtra<never, never>;
export type ToolResult = {
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
  isError?: boolean;
};

export const deepLink = (id: string) => `https://livediagram.app/diagram/${id}`;

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

export async function imageResult(value: unknown, tab: Tab): Promise<ToolResult> {
  const png = await svgToPngBase64(
    renderElementsToSvg(tab, { resolveIconArt: resolveIconExportArt }),
  );
  return {
    content: [
      { type: 'text', text: JSON.stringify(value, null, 2) },
      { type: 'image', data: png, mimeType: 'image/png' },
    ],
  };
}
