// Calls one app's MCP Worker as the person (liveworkspace/docs/specs/021-mcp/mcp.md "How it works"): plain
// JSON-RPC over its service binding, carrying the person's own Bearer token, which works on every app. Its tool
// list is kept per isolate for ten minutes.
import type { AppSpec } from './apps';
import { buildAppCatalogue, type AppCatalogue, type ListedTool } from './catalogue';
import type { Env } from './env';

/** An app refused the token: the whole request answers 401 so the client signs in again. */
export class TokenRefused extends Error {
  readonly app: string;
  constructor(app: string) {
    super(`${app} refused the token`);
    this.app = app;
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
}

let nextId = 1;

async function rpc(
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
    error?: { message?: string };
  } | null;
  if (!response.ok || !body)
    throw new Error(`${spec.app} answered ${response.status} to ${method}`);
  if (body.error) throw new Error(`${spec.app}: ${body.error.message ?? 'error'}`);
  return body.result ?? {};
}

/** The app's tools under the one MCP's names, read once per isolate and kept ten minutes. */
export async function appCatalogue(env: Env, spec: AppSpec, token: string): Promise<AppCatalogue> {
  const kept = catalogues.get(spec.app);
  if (kept && Date.now() - kept.at < CATALOGUE_TTL_MS) return kept.catalogue;
  const result = await rpc(env, spec, token, 'tools/list', {});
  const tools = Array.isArray(result.tools) ? (result.tools as ListedTool[]) : [];
  const catalogue = buildAppCatalogue(spec, tools);
  catalogues.set(spec.app, { at: Date.now(), catalogue });
  return catalogue;
}

/** Calls the app's own tool by its own name; the answer comes back with old tool names rewritten. */
export async function callAppTool(
  env: Env,
  spec: AppSpec,
  token: string,
  appTool: string,
  args: Record<string, unknown>,
  rewrite: (text: string) => string,
): Promise<ToolResult> {
  const result = await rpc(env, spec, token, 'tools/call', { name: appTool, arguments: args });
  const content = Array.isArray(result.content) ? (result.content as ToolResult['content']) : [];
  const out: ToolResult = {
    ...result,
    content: content.map((part) =>
      part.type === 'text' && typeof part.text === 'string'
        ? { ...part, text: rewrite(part.text) }
        : part,
    ),
  };
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    const structured = JSON.parse(rewrite(JSON.stringify(result.structuredContent))) as Record<
      string,
      unknown
    >;
    out.structuredContent = structured;
  }
  return out;
}
