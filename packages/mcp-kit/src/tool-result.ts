// What every product's MCP tools answer with (docs/specs/015-api/mcp-server.md): the text, view and error result
// shapes, the bearer-token guard, the behaviour hints each tool ships, and the rule that a mistake the caller can fix
// comes back as a tool error in words ("Errors that teach"). Each product's tool-helpers.ts and tool-annotations.ts
// re-export these beside its own deep links, tab loading and registerTool. Imports only types, so a Worker that
// takes it pulls in no more than this file.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

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

// A view of a product's file (docs/specs/024-agents): the view's text first, then one line of JSON naming the file,
// the tab, its revision and its link (VW55).
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

// Three behaviours cover every tool (a verb's `behaviour`). The split mirrors docs/specs/015-api/mcp-server.md §4.11's
// read-only-token boundary: what a `read_only = 1` token can still reach is exactly what `read` annotates, so the hint
// a client sees and the rule the api enforces can't drift apart.
export type ToolBehaviour = 'read' | 'write' | 'destructive';

// `openWorldHint: false` throughout: every tool acts on the caller's own library through the product's api, a closed
// and known domain rather than an open-ended external world like a web search.
//
// `destructiveHint` is omitted on `read` on purpose. MCP ignores it when `readOnlyHint` is true, and stating it would
// imply the tool writes at all.
export const TOOL_ANNOTATIONS: Record<ToolBehaviour, ToolAnnotations> = {
  read: { readOnlyHint: true, openWorldHint: false },
  // Additive: creates a file, a tab, a link. Nothing that existed is lost.
  write: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  // May overwrite or remove what the user already had, so a client should ask before each call.
  destructive: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
};

// A mistake the caller can fix is a tool error that says so, never a thrown protocol error ("Errors that teach"): a
// named input refusal, or an api 4xx in words (the product's refusalOf). A 5xx or anything else still throws, and is
// reported as Error·Api underneath.
export async function answerFixable(
  run: () => unknown,
  refusalOf: (err: unknown) => { message: string } | null,
): Promise<unknown> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ToolInputError) return errorResult(err.message);
    const refusal = refusalOf(err);
    if (refusal) return errorResult(refusal.message);
    throw err;
  }
}

export function isErrorResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { isError?: unknown }).isError === true
  );
}
