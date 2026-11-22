// The name an agent's reads are counted under (docs/specs/030-knowledgebase/ai-knowledge.md "Reads";
// docs/specs/024-agents/knowledgebase-for-agents.md): the MCP client's own, from its `initialize` handshake's
// clientInfo ("Claude Code", "Cursor"), sent to the api as `X-Liveknowledge-Agent` with every knowledgebase tool.
//
// The transport is stateless (@liveworkspace/mcp-kit/app): the handshake and a later tool call are separate
// requests on separate servers, so the name is remembered against the caller's token, in the OAuth KV, when the
// handshake passes, and read back by the tool. The token is never stored: the key is its SHA-256. A server that did
// see the handshake itself (an in-memory client, a stateful host) reads the name straight from it.
import { bearerTokenOf } from '@liveknowledge/api-schema';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';

export const AGENT_NAME_HEADER = 'X-Liveknowledge-Agent';
export const AGENT_NAME_MAX_CHARS = 60;
/** A handshake is a few hundred bytes; a body past this is not read for a name (an upload is megabytes). */
export const HANDSHAKE_MAX_BYTES = 8192;
/** As long as a token lasts (six months), so a name outlives no token by much. */
export const AGENT_NAME_TTL_SECONDS = 200 * 86_400;

/** A client's name as a header carries it: printable ASCII, single spaces, at most 60 characters. Anything else
 *  (no name, a number, control or bidi characters alone) is the empty string, and the api names the door. */
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
 * throws: a name not remembered is a read counted under "MCP".
 */
export async function rememberClientName(env: Env, request: Request): Promise<void> {
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

/** The name to send for this call: the handshake's when this server saw it, else the one remembered for the token;
 *  empty when neither is known. One KV read at most. */
export async function clientNameFor(server: McpServer, env: Env, token: string): Promise<string> {
  const own = agentNameOf(server.server.getClientVersion()?.name);
  if (own) return own;
  try {
    return agentNameOf(await env.OAUTH_KV?.get(await nameKey(token)));
  } catch (error) {
    console.warn('[mcp] client name not read', { error: String(error) });
    return '';
  }
}
