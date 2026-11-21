// What the knowledge route tests share: a knowledgebase of three pages in the test database, and a caller for each
// share role (docs/specs/013-workspace/share-roles.md). Not a `.test.ts` file, so vitest collects no suite from it.
import { UNOWNED_PAGE } from '@liveknowledge/knowledge';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

export const OWNER = 'user_o';

export type Who =
  | 'editor'
  | 'participant'
  | 'viewer'
  | 'link'
  | 'edit-link'
  | 'page-link'
  | 'stranger'
  | 'agent'
  | 'agent-stored'
  | 'agent-read-only'
  | 'participant-agent'
  | 'viewer-agent';

/** The API token every agent caller presents. */
export const TOKEN_ID = 'tok_1';

const para = (id: string, text: string, style?: string) => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: [{ text }],
});

export const page = (id: string, name: string, blocks: unknown[], extra: object = {}) => ({
  id,
  name,
  elements: [],
  articles: { f1: { blocks } },
  ...extra,
});

export const PAGES = [
  page('deploys', 'Deploys', [
    para('b1', 'Deploys', 'title'),
    para('b2', 'When we deploy', 'h1'),
    para('b3', 'Deploys go out on Tuesdays after the morning standup, never on a Friday.'),
    {
      id: 'b4',
      type: 'paragraph',
      runs: [
        { text: 'See ' },
        { text: 'Rollbacks', page: 'rollbacks' },
        { text: ' when one fails.' },
      ],
    },
  ]),
  page(
    'rollbacks',
    'Rollbacks',
    [
      para('b1', 'Rollbacks', 'title'),
      para('b2', 'Roll back a deploy with one command from the release channel.'),
    ],
    { parent: 'deploys' },
  ),
  page('holidays', 'Holidays', [para('b1', 'Everyone takes the last week of December off.')]),
];

const roomBinding = () => ({
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
});

export type Kit = {
  db: SqliteD1;
  call: (who: Who, method: string, path: string, body?: unknown) => Promise<Response>;
};

const CALLERS: Record<
  Who,
  {
    owner: string | null;
    account: string | null;
    code?: string;
    token?: boolean;
    readOnly?: boolean;
    // Read the token's grant from the room, as a real request does (the default scopes until an Editor decides).
    stored?: boolean;
  }
> = {
  editor: { owner: OWNER, account: OWNER },
  participant: { owner: 'user_p', account: 'user_p', code: 'PART' },
  viewer: { owner: 'user_v', account: 'user_v', code: 'VIEW' },
  // A visitor through a share link, with no account: a guest's id, or none at all.
  link: { owner: 'guest_1', account: null, code: 'VIEW' },
  // A guest through a link that grants Participant (an edit link), with no account.
  'edit-link': { owner: 'guest_2', account: null, code: 'PART' },
  'page-link': { owner: null, account: null, code: 'PAGE' },
  stranger: { owner: 'user_x', account: 'user_x' },
  // An API token acting for the owner, through the MCP server.
  // It holds every scope (test-route-context.ts), as an Editor's agent granted `write`.
  agent: { owner: OWNER, account: null, token: true },
  // The same token with what the room holds for it: `read` and `suggest` until an Editor grants more.
  'agent-stored': { owner: OWNER, account: null, token: true, stored: true },
  'agent-read-only': { owner: OWNER, account: null, token: true, readOnly: true, stored: true },
  'participant-agent': { owner: 'user_p', account: null, code: 'PART', token: true, stored: true },
  'viewer-agent': { owner: 'user_v', account: null, code: 'VIEW', token: true, stored: true },
};

export async function knowledgeKit(
  base: Partial<Env> = {},
  pages: unknown[] = PAGES,
): Promise<Kit> {
  const db = sqliteD1({ DOCUMENT_ROOM: roomBinding(), ...base } as unknown as Partial<Env>);
  const call: Kit['call'] = (who, method, path, body) => {
    const caller = CALLERS[who];
    return handleDocuments(
      makeTestRouteContext(method, path, {
        env: db.env,
        owner: caller.owner,
        accountUserId: caller.account,
        verifiedUserId: caller.token ? caller.owner : caller.account,
        token: caller.token ? { id: TOKEN_ID, readOnly: caller.readOnly === true } : null,
        ...(caller.stored ? { agent: 'stored' as const } : {}),
        body,
        headers: {
          ...(caller.code ? { 'X-Share-Code': caller.code } : {}),
          ...(caller.token
            ? { 'X-Liveknowledge-Client': 'mcp', 'X-Liveknowledge-Agent': 'Coding Agent' }
            : {}),
        },
      }),
    );
  };
  // Its pages own no one, as pages made before a creator owned them, or by an import, do (verification.md "The
  // owner"): the suites set what they test. A create's own owner rule is tested on its own (knowledge-page-routes).
  const made = await call('editor', 'POST', '/api/documents', {
    id: 'kb',
    name: 'Handbook',
    tabs: pages.map((p) => ({ ...(p as object), knowledge: UNOWNED_PAGE })),
  });
  if (made.status >= 300) throw new Error(`create failed: ${made.status} ${await made.text()}`);
  db.sql.exec(`
    INSERT INTO test_share_links (code, document_id, role, level, tab_id, created_at) VALUES ('PART', 'kb', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, document_id, role, tab_id, created_at) VALUES ('VIEW', 'kb', 'view', NULL, 1);
    INSERT INTO test_share_links (code, document_id, role, tab_id, created_at) VALUES ('PAGE', 'kb', 'view', 'holidays', 1);
  `);
  return { db, call };
}

/** A fake Anthropic API: answers each call with a server-sent event stream of `text`, and records what was sent. */
export function fakeClaude(reply: string | (() => Response)) {
  const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    sent.push({
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? init.body : '',
    });
    if (typeof reply !== 'string') return reply();
    const event = (type: string, data: object) =>
      `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    // Two pieces, so the stream is read as a stream.
    const half = Math.ceil(reply.length / 2);
    const text =
      event('message_start', { message: { model: 'claude-fable-5-2' } }) +
      event('content_block_delta', { delta: { type: 'text_delta', text: reply.slice(0, half) } }) +
      event('content_block_delta', { delta: { type: 'text_delta', text: reply.slice(half) } }) +
      event('message_delta', { delta: { stop_reason: 'end_turn' } }) +
      event('message_stop', {});
    return new Response(text, { headers: { 'content-type': 'text/event-stream' } });
  };
  return { fetch, sent };
}

/** A fake OpenAI Responses API: answers each call with the typed events of a streamed response of `text`, and
 *  records what was sent. */
export function fakeOpenAi(reply: string | (() => Response)) {
  const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    sent.push({
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? init.body : '',
    });
    if (typeof reply !== 'string') return reply();
    const event = (type: string, data: object) =>
      `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    const response = { model: 'gpt-6.2-astra', error: null, incomplete_details: null };
    const half = Math.ceil(reply.length / 2);
    const text =
      event('response.created', { response: { ...response, status: 'in_progress' } }) +
      event('response.output_text.delta', { delta: reply.slice(0, half) }) +
      event('response.output_text.delta', { delta: reply.slice(half) }) +
      event('response.completed', { response: { ...response, status: 'completed' } });
    return new Response(text, { headers: { 'content-type': 'text/event-stream' } });
  };
  return { fetch, sent };
}
