// Calls one app's MCP Worker as the person (liveworkspace/docs/specs/021-mcp/mcp.md "How it works"): plain
// JSON-RPC over its service binding, carrying the person's own Bearer token, which works on every app. Its tool
// list is kept per isolate for ten minutes.
import type { AppSpec } from './apps';
import {
  buildAppCatalogue,
  rewriteGuidance,
  type AppCatalogue,
  type ListedTool,
} from './catalogue';
import type { Env } from './env';

/** An app refused the token: the whole request answers 401 so the client signs in again. */
export class TokenRefused extends Error {
  readonly app: string;
  constructor(app: string) {
    super(`${app} refused the token`);
    this.app = app;
  }
}

/** An app answered a JSON-RPC error: its code and message, so a prompt or resource read can pass them on as they are. */
export class AppRpcError extends Error {
  readonly code: number;
  constructor(app: string, code: number, message: string) {
    super(`${app}: ${message}`);
    this.code = code;
  }
}

export type ToolResult = {
  content: { type: string; text?: string; [key: string]: unknown }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
};

export const CATALOGUE_TTL_MS = 10 * 60 * 1000;

const catalogues = new Map<string, { at: number; catalogue: AppCatalogue }>();

/** Drops every kept tool list (tests). */
export function forgetCatalogues(): void {
  catalogues.clear();
  guides.clear();
}

// Each app's server instructions, under the one MCP's tool names, kept as long as a tool list.
const guides = new Map<string, { at: number; guide: string }>();

let nextId = 1;

export async function appRpc(
  env: Env,
  spec: AppSpec,
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await env[spec.binding].fetch(`https://${spec.app}.internal/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  if (response.status === 401) throw new TokenRefused(spec.app);
  const body = (await response.json().catch(() => null)) as {
    result?: Record<string, unknown>;
    error?: { code?: unknown; message?: string };
  } | null;
  if (!response.ok || !body)
    throw new Error(`${spec.app} answered ${response.status} to ${method}`);
  if (body.error)
    throw new AppRpcError(
      spec.app,
      typeof body.error.code === 'number' ? body.error.code : -32603,
      // The SDK says the code in the message too ("MCP error -32602: ..."); the code travels on its own.
      (body.error.message ?? 'error').replace(/^MCP error -?\d+: /, ''),
    );
  return body.result ?? {};
}

/** The app's tools under the one MCP's names, read once per isolate and kept ten minutes. */
export async function appCatalogue(env: Env, spec: AppSpec, token: string): Promise<AppCatalogue> {
  const kept = catalogues.get(spec.app);
  if (kept && Date.now() - kept.at < CATALOGUE_TTL_MS) return kept.catalogue;
  const result = await appRpc(env, spec, token, 'tools/list', {});
  const tools = Array.isArray(result.tools) ? (result.tools as ListedTool[]) : [];
  const catalogue = buildAppCatalogue(spec, tools);
  catalogues.set(spec.app, { at: Date.now(), catalogue });
  return catalogue;
}

/** The guidance the app's own MCP gives every client (its `initialize` instructions), old tool names rewritten. */
export async function appGuide(
  env: Env,
  spec: AppSpec,
  token: string,
  rewrite: (text: string) => string,
): Promise<string> {
  const kept = guides.get(spec.app);
  if (kept && Date.now() - kept.at < CATALOGUE_TTL_MS) return kept.guide;
  const result = await appRpc(env, spec, token, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'liveworkspace-mcp', version: '1.0.0' },
  });
  const guide = typeof result.instructions === 'string' ? rewrite(result.instructions) : '';
  guides.set(spec.app, { at: Date.now(), guide });
  return guide;
}

/** A text part that is the answer's JSON (mcp-kit's `textResult`): its guidance rewritten; any other text as it is. */
function guidedText(text: string, rewrite: (text: string) => string): string {
  if (!text.startsWith('{')) return text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  // Re-serialised only when a name changed, so an answer with nothing to rewrite keeps its exact text.
  let changed = false;
  const guided = rewriteGuidance(parsed, (s) => {
    const out = rewrite(s);
    if (out !== s) changed = true;
    return out;
  });
  return changed ? JSON.stringify(guided) : text;
}

/** A refusal's words rewritten, but never what it quotes ("No page \"get_context\" here"): a name or text a person wrote. */
function refusalText(text: string, rewrite: (text: string) => string): string {
  return text
    .split(/("[^"\n]*")/)
    .map((part, i) => (i % 2 === 1 ? part : rewrite(part)))
    .join('');
}

/**
 * Calls the app's own tool by its own name. Old tool names are rewritten in a refusal and in the answer's own
 * guidance (`next`, `note`), never in what a person wrote: a page that says "get_context" reads back as it is.
 */
export async function callAppTool(
  env: Env,
  spec: AppSpec,
  token: string,
  appTool: string,
  args: Record<string, unknown>,
  rewrite: (text: string) => string,
): Promise<ToolResult> {
  const result = await appRpc(env, spec, token, 'tools/call', { name: appTool, arguments: args });
  const content = Array.isArray(result.content) ? (result.content as ToolResult['content']) : [];
  const refusal = result.isError === true;
  const out: ToolResult = {
    ...result,
    content: content.map((part) =>
      part.type === 'text' && typeof part.text === 'string'
        ? {
            ...part,
            text: refusal ? refusalText(part.text, rewrite) : guidedText(part.text, rewrite),
          }
        : part,
    ),
  };
  if (result.structuredContent && typeof result.structuredContent === 'object')
    out.structuredContent = rewriteGuidance(
      result.structuredContent as Record<string, unknown>,
      rewrite,
    );
  return out;
}
