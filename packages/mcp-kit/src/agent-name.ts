// oxlint-disable-next-line typescript/triple-slash-reference -- an ambient module declaration has nothing to import; the reference makes every Worker compiling this module see it
/// <reference path="./async-hooks.d.ts" />
// Who is calling, as every product's MCP tells its api (each product's docs/specs/015-api/mcp-server.md §2 "Who is
// calling", Work Tracker 1381): the MCP door, and the client's own name from its `initialize` handshake's clientInfo
// ("Claude Code", "Cursor"). The api names an agent's writes by it in History, and liveknowledge counts reads under it.
//
// The transport is stateless (app.ts): the handshake and a later tool call are separate requests on separate servers,
// so the name is remembered against the caller's token, in the OAuth KV, when the handshake passes, and read back by
// the tool call. The token is never stored: the key is its SHA-256. A server that did see the handshake itself (an
// in-memory client, a stateful host) reads the name straight from it. app.ts runs each request inside a scope that
// looks the name up at most once, and only when a tool calls the api (withAgentHeaders).
import { AsyncLocalStorage } from 'node:async_hooks';
import { bearerTokenOf } from '@liveworkspace/api-kit/request-auth';
import type { Env } from './env';

export const AGENT_NAME_MAX_CHARS = 60;
/** A handshake is a few hundred bytes; a body past this is not read for a name (an upload is megabytes). */
export const HANDSHAKE_MAX_BYTES = 8192;
/** As long as a token lasts (six months), so a name outlives no token by much. */
export const AGENT_NAME_TTL_SECONDS = 200 * 86_400;

/** A client's name as a header carries it: printable ASCII, single spaces, at most 60 characters. Anything else
 *  (no name, a number, control or bidi characters alone) is the empty string, and the api names the token. */
export function agentNameOf(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, AGENT_NAME_MAX_CHARS)
    .trim();
}

async function nameKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `agent-name:${hex}`;
}

/**
 * Remember the client's name when the request is an `initialize` handshake. Reads a copy of a small POST /mcp body
 * and nothing else; the copy is taken before the first await, so the transport still reads the request whole. Never
 * throws: a name not remembered is a call named by its token.
 */
export async function rememberClientName(
  env: Pick<Env, 'OAUTH_KV'>,
  request: Request,
): Promise<void> {
  try {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/mcp') return;
    const length = Number(request.headers.get('content-length'));
    if (!Number.isFinite(length) || length <= 0 || length > HANDSHAKE_MAX_BYTES) return;
    const token = bearerTokenOf(request.headers.get('Authorization'));
    if (!token) return;
    const copy = request.clone();
    const message = await copy.json<{
      method?: unknown;
      params?: { clientInfo?: { name?: unknown } };
    }>();
    if (message?.method !== 'initialize') return;
    const name = agentNameOf(message.params?.clientInfo?.name);
    if (!name) return;
    const key = await nameKey(token);
    // A client that connects again under the same name writes nothing.
    if ((await env.OAUTH_KV.get(key)) === name) return;
    await env.OAUTH_KV.put(key, name, { expirationTtl: AGENT_NAME_TTL_SECONDS });
  } catch (error) {
    console.warn('[mcp] client name not remembered', { error: String(error) });
  }
}

/** The slice of an MCP server that knows its handshake (`McpServer`). */
export type SeesHandshake = { server: { getClientVersion(): { name?: unknown } | undefined } };

/** The name to send for this call: the handshake's when this server saw it, else the one remembered for the token;
 *  empty when neither is known. One KV read at most. */
export async function clientNameFor(
  server: SeesHandshake,
  env: Pick<Env, 'OAUTH_KV'>,
  token: string,
): Promise<string> {
  const own = agentNameOf(server.server.getClientVersion()?.name);
  if (own) return own;
  try {
    return agentNameOf(await env.OAUTH_KV?.get(await nameKey(token)));
  } catch (error) {
    console.warn('[mcp] client name not read', { error: String(error) });
    return '';
  }
}

// ---------- The request's name -------------------------------------------------------------------------------

const scope = new AsyncLocalStorage<() => Promise<string>>();

/** Run `fn` (the transport's handling of one request) with `lookup` as its client's name, asked at most once. */
export function runWithClientName<T>(lookup: () => Promise<string>, fn: () => T): T {
  let held: Promise<string> | null = null;
  return scope.run(() => (held ??= lookup()), fn);
}

/** The running request's client name, or empty outside one (a test, a call with no request). */
export function currentClientName(): Promise<string> {
  return scope.getStore()?.() ?? Promise.resolve('');
}

/** The headers a product's api reads who is calling from: its client header and its agent header. */
export type McpAgentHeaders = { client: string; agent: string };

/** `request` as the api should hear it from this MCP: through the MCP door, named by the running request's client
 *  when it gave a name. A header the caller set already is kept. */
export async function withAgentHeaders(
  request: Request,
  headers: McpAgentHeaders,
): Promise<Request> {
  const name = await currentClientName();
  const out = new Request(request);
  if (!out.headers.has(headers.client)) out.headers.set(headers.client, 'mcp');
  if (name && !out.headers.has(headers.agent)) out.headers.set(headers.agent, name);
  return out;
}
