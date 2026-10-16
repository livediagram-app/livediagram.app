// A minimal MCP client over JSON-RPC (streamable HTTP), shared by the eval helper (`mcp-call.mjs`) and the
// benchmark's scorer, which reads back what a run made (docs/instructions/evaluate-mcp-output.md).

export const DEFAULT_MCP_URL = 'http://127.0.0.1:8798/mcp';

async function post(url, token, body, session) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify(body),
  });
  const sid = res.headers.get('Mcp-Session-Id') ?? session;
  const raw = await res.text();
  // A streamed reply carries its messages on `data:` lines; a plain one is the message itself.
  const messages = raw
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.slice(5)));
  if (messages.length === 0 && raw.trim()) messages.push(JSON.parse(raw));
  return { sid, message: messages.at(-1) ?? null };
}

// Opens a session. `call` answers the tool's raw result ({content, isError}) or the JSON-RPC error.
export async function connect({ url = DEFAULT_MCP_URL, token }) {
  const { sid, message: init } = await post(url, token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'eval', version: '1' } },
  });
  await post(url, token, { jsonrpc: '2.0', method: 'notifications/initialized' }, sid);
  let id = 2;
  return {
    instructions: init?.result?.instructions ?? '',
    async tools() {
      const { message } = await post(url, token, { jsonrpc: '2.0', id: id++, method: 'tools/list' }, sid);
      return message.result.tools;
    },
    async call(name, args = {}) {
      const { message } = await post(
        url,
        token,
        { jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name, arguments: args } },
        sid,
      );
      return message?.result ?? message?.error ?? null;
    },
  };
}

// A tool result's text parts joined, or null on an error result.
export function resultText(result) {
  if (!result?.content || result.isError) return null;
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// A tool result as JSON: the first text part that parses whole (a reply can follow its JSON with a lint part), else
// the first line that does (a view's header line can precede it).
export function resultJson(result) {
  if (resultText(result) === null) return null;
  const parts = result.content.filter((c) => c.type === 'text').map((c) => c.text);
  for (const part of parts) {
    const whole = tryJson(part);
    if (whole !== undefined) return whole;
  }
  for (const line of parts.join('\n').split('\n')) {
    if (!line.startsWith('{')) continue;
    const parsed = tryJson(line);
    if (parsed !== undefined) return parsed;
  }
  return null;
}
