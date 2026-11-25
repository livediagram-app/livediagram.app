// An agent's Send to Knowledge Base (docs/specs/013-workspace/send-to-knowledge.md "Agents"): create_page and
// write_page take `sentFrom` ({app, itemId, tabId?, elementIds?}), the item in another app the writing came from.
// The index names it for the token's person (only one they can read), the write ends with its Sent From line, and
// once the write is made the index keeps the send, so both sides show the live chip. A source the index will not
// name still writes the page; the answer says `sentFrom: 'not recorded'`. Wraps the two routes rather than living
// in them: the route reads the body as before, `sentFrom` taken out and the line added to its Markdown.
import {
  IndexError,
  knowledgeSentFromLine,
  readAgentKnowledgeSend,
  type AgentKnowledgeSend,
  type KnowledgeSentFrom,
} from '@liveworkspace/index-client';
import { sourcesClientOf } from '../knowledge/source-work';
import type { KnowledgeRoute } from './knowledge-routes';

type Body = Record<string, unknown>;

const invalid = (message: string) =>
  Response.json({ error: 'invalid_sent_from', message }, { status: 400 });

async function named(
  route: KnowledgeRoute,
  send: AgentKnowledgeSend,
  record: boolean,
): Promise<KnowledgeSentFrom | null> {
  const client = sourcesClientOf(route.ctx.env);
  if (!client) return null;
  try {
    return await client.agentSend(route.document.id, send, record);
  } catch (err) {
    if (!(err instanceof IndexError)) throw err;
    console.warn('[knowledge] sent from refused', { status: err.status, code: err.code });
    return null;
  }
}

/**
 * Runs a create or a write with `sentFrom` honoured: `pageOf` reads the written page from the route's answer (null
 * when it wrote nothing). Without `sentFrom` the route runs as it always has.
 */
export async function withAgentSentFrom(
  route: KnowledgeRoute,
  pageOf: (answer: Body) => { id: string; title: string } | null,
  run: (route: KnowledgeRoute) => Promise<Response> | Response,
): Promise<Response> {
  const { ctx } = route;
  const text = await ctx.request.text();
  let body: Body | null;
  try {
    const parsed = JSON.parse(text) as unknown;
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Body) : null;
  } catch {
    body = null;
  }
  const rebuilt = (next: string) =>
    new Request(ctx.request.url, {
      method: ctx.request.method,
      headers: ctx.request.headers,
      body: next,
    });
  if (!body || body.sentFrom === undefined)
    return run({ ...route, ctx: { ...ctx, request: rebuilt(text) } });

  const person = ctx.verifiedUserId;
  const { sentFrom, ...rest } = body;
  const raw = (sentFrom ?? {}) as Body;
  const send = readAgentKnowledgeSend({
    person: person ?? 'nobody',
    source: raw,
    page: { id: 'pending', title: '' },
  });
  if (!send)
    return invalid(
      '"sentFrom" is {"app", "itemId", "tabId"?, "elementIds"?}: the item in another app the writing came from.',
    );
  const from = person ? await named(route, send, false) : null;
  const markdown = typeof rest.markdown === 'string' ? rest.markdown : '';
  const withLine = from
    ? { ...rest, markdown: `${markdown.trimEnd()}\n\n${knowledgeSentFromLine(from)}` }
    : rest;
  const res = await run({ ...route, ctx: { ...ctx, request: rebuilt(JSON.stringify(withLine)) } });
  if (!res.ok) return res;
  const answer = (await res.json().catch(() => null)) as Body | null;
  if (!answer) return Response.json({}, { status: res.status });
  const page = pageOf(answer);
  const recorded = !!from && !!page && (await named(route, { ...send, page }, true)) !== null;
  return Response.json(
    { ...answer, sentFrom: recorded ? 'recorded' : 'not recorded' },
    { status: res.status, headers: res.headers },
  );
}
