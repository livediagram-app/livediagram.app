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
// as the first text block for clients that only read `content`: JSON on one line, since indentation is a third of
// the characters of a nested answer and a model reads it the same.
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
    content: [{ type: 'text', text: JSON.stringify(value) }],
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

// What a tool says beside its behaviour: that calling it again with the same input changes nothing more
// (`idempotentHint`), or that it reaches beyond the caller's library (`openWorldHint`: upload_image fetches a URL).
export type ToolHints = { behaviour: ToolBehaviour; idempotent?: true; openWorld?: true };

// The annotations a tool ships: its behaviour's preset, with its own hints on top.
export function toolAnnotations({ behaviour, idempotent, openWorld }: ToolHints): ToolAnnotations {
  return {
    ...TOOL_ANNOTATIONS[behaviour],
    ...(idempotent ? { idempotentHint: true } : {}),
    ...(openWorld ? { openWorldHint: true } : {}),
  };
}

// The most text one tool answer carries: Claude's own cap on a tool result (claude.ai and Claude Desktop take about
// 150,000 characters; https://claude.com/docs/connectors/building). A larger answer would be cut short by the client
// anyway, so it becomes a refusal saying how to ask for less. Pictures are not counted: their size has its own budget
// (preview-budget.ts).
export const TOOL_RESULT_MAX_CHARS = 150_000;

function resultChars(result: unknown): number {
  if (typeof result !== 'object' || result === null) return 0;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return 0;
  let chars = 0;
  for (const block of content) {
    const text = (block as { text?: unknown } | null)?.text;
    if (typeof text === 'string') chars += text.length;
  }
  return chars;
}

/** An answer over TOOL_RESULT_MAX_CHARS, as the refusal that replaces it. */
export function oversizeRefusal(chars: number): ToolResult {
  return errorResult(
    `This answer would be ${chars.toLocaleString('en-GB')} characters, over the ${TOOL_RESULT_MAX_CHARS.toLocaleString('en-GB')} ` +
      'a tool answer can carry. Ask for less: one tab, a shorter view, or a smaller limit.',
  );
}

/** A failure the caller cannot fix, in words: an api that answered 5xx, or anything else that went wrong. */
export function failureWords(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 500)
    return `The service behind this tool did not finish the call (HTTP ${status}). Try again in a moment.`;
  const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
  return `This tool failed unexpectedly${detail}. Try again in a moment.`;
}

// A mistake the caller can fix is a tool error that says so, never a thrown protocol error ("Errors that teach"): a
// named input refusal, or an api 4xx in words (the product's refusalOf). A 5xx or anything else still throws (and is
// reported as Error·Api underneath), but in words (failureWords), never a bare "api 500: Internal Server Error". An
// answer too large for a client becomes a refusal (TOOL_RESULT_MAX_CHARS).
export async function answerFixable(
  run: () => unknown,
  refusalOf: (err: unknown) => { message: string } | null,
): Promise<unknown> {
  let result: unknown;
  try {
    result = await run();
  } catch (err) {
    if (err instanceof ToolInputError) return errorResult(err.message);
    const refusal = refusalOf(err);
    if (refusal) return errorResult(refusal.message);
    throw new Error(failureWords(err), { cause: err });
  }
  const chars = resultChars(result);
  return chars > TOOL_RESULT_MAX_CHARS ? oversizeRefusal(chars) : result;
}

export function isErrorResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { isError?: unknown }).isError === true
  );
}
