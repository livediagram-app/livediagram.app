// What the chat tests share (docs/specs/030-knowledgebase/blueprints/chat-apps.md "Tests"): the knowledgebase kit
// with Slack and Teams set up, every ChatWorkspace on node:sqlite, the index's answer for each linked person, signed
// Slack requests, Bot Framework tokens from a test key, and everything sent out. Not a `.test.ts` file.
import { vi } from 'vitest';
import { bytesToBase64, bytesToBase64Url } from '@liveworkspace/api-kit/bytes';
import { BOT_FRAMEWORK_ISSUER, BOT_FRAMEWORK_OPENID, slackSignature } from '@liveworkspace/chat';
import { nodeDurableState } from '@liveworkspace/index-app/testing';
import type { DocumentGrant } from '../index-service';
import { handleDocuments } from '../routes/documents';
import { knowledgeKit, type Kit } from '../routes/knowledge-test-kit';
import { makeTestRouteContext } from '../routes/test-route-context';
import { TEST_GRANT_HOOK, type TestGrantCaller } from '../test-sqlite-d1';
import type { Env } from '../types';
import type { ChatPersonDeps } from './chat-as-person';
import { handleChatHooks, handleChatLink } from './chat-routes';
import type { ChatJobDeps } from './chat-jobs';
import { ChatWorkspace } from './chat-workspace';

export const SIGNING = 'slack-signing-secret';
export const APP_ID = 'teams-app-id';
export const SERVICE = 'https://smba.trafficmanager.net/emea/';
export const ANSWER =
  '<answer>Deploys go out on Tuesdays [1]. Nobody wrote down who approves them.</answer>' +
  '<gap>Who approves a deploy?</gap>';

/** The share code each test person's grant comes through, as the index would answer for them: the owner edits,
 *  `user_v` reads it all, `user_page` reads the Holidays page alone; anyone else is granted nothing. */
const ACCESS: Record<string, string | null> = { user_o: null, user_v: 'VIEW', user_page: 'PAGE' };

function stream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: text })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

export type Sent = { url: string; body: Record<string, unknown> };

export type ChatKit = Kit & {
  env: Env;
  sent: Sent[];
  asked: string[];
  workspace: (name: string) => ChatWorkspace;
  /** Every queued job run, as each alarm would. */
  drain: () => Promise<void>;
  hook: (
    method: string,
    path: string,
    body: string,
    headers?: Record<string, string>,
  ) => Promise<Response>;
  slack: (door: string, body: string, opts?: { at?: number; secret?: string }) => Promise<Response>;
  link: (method: string, path: string, account: string | null, body?: unknown) => Promise<Response>;
};

export async function chatKit(base: Partial<Env> = {}): Promise<ChatKit> {
  const sent: Sent[] = [];
  const asked: string[] = [];
  const held = new Map<string, ChatWorkspace>();
  const box: { env?: Env } = {};
  const person: ChatPersonDeps = {
    grantFor: async (e, knowledgebase, who) => {
      if (!(who in ACCESS)) return null;
      const hook = (e as unknown as Record<string, unknown>)[TEST_GRANT_HOOK] as (
        id: string,
        caller: TestGrantCaller,
      ) => DocumentGrant | null;
      return hook(knowledgebase, { person: who, teams: [], code: ACCESS[who]!, create: false });
    },
    route: async (e, _knowledgebase, request, who, grant) => {
      const url = new URL(request.url);
      const text = request.method === 'GET' ? '' : await request.text();
      return handleDocuments(
        makeTestRouteContext(request.method, url.pathname + url.search, {
          env: e,
          owner: who,
          accountUserId: who,
          grant,
          ...(text ? { rawBody: text } : {}),
        }),
      );
    },
  };
  const deps: ChatJobDeps = {
    person,
    fetch: (input, init) => fetch(input, init),
    botToken: async () => 'bot-token',
  };
  const namespace = {
    idFromName: (name: string) => name,
    get: (name: string) => {
      let found = held.get(name);
      if (!found) {
        found = new ChatWorkspace(
          nodeDurableState(name).state as unknown as DurableObjectState,
          box.env!,
        );
        found.deps = deps;
        held.set(name, found);
      }
      return found;
    },
  };
  const ai = {
    run: async (_model: string, input: { messages?: { content: string }[] }) => {
      asked.push(JSON.stringify(input.messages ?? []));
      return stream(ANSWER);
    },
  };
  const kit = await knowledgeKit({
    CHAT_WORKSPACE: namespace as unknown as Env['CHAT_WORKSPACE'],
    CHAT_KEY: bytesToBase64(new Uint8Array(32).fill(7)),
    SLACK_CLIENT_ID: 'slack-client',
    SLACK_CLIENT_SECRET: 'slack-secret',
    SLACK_SIGNING_SECRET: SIGNING,
    TEAMS_APP_ID: APP_ID,
    TEAMS_APP_PASSWORD: 'teams-password',
    APP_BASE_URL: 'https://www.liveknowledge.app',
    AI: ai,
    ...base,
  });
  const env: Env = kit.db.env;
  box.env = env;
  // Everything sent out: Slack's methods and response URLs, Teams' connector, the install exchange.
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const raw = typeof init?.body === 'string' ? init.body : '';
    let body: Record<string, unknown>;
    try {
      body = raw.startsWith('{')
        ? (JSON.parse(raw) as Record<string, unknown>)
        : Object.fromEntries(new URLSearchParams(raw));
    } catch {
      body = {};
    }
    sent.push({ url, body });
    if (url === BOT_FRAMEWORK_OPENID)
      return Response.json({ jwks_uri: 'https://login.botframework.com/v1/keys' });
    if (url === 'https://login.botframework.com/v1/keys')
      return Response.json({ keys: [await botKey()] });
    if (url === 'https://slack.com/api/oauth.v2.access')
      return Response.json(
        body.code === 'good'
          ? {
              ok: true,
              access_token: 'xoxb-test',
              bot_user_id: 'B1',
              team: { id: 'T1', name: 'Acme' },
            }
          : { ok: false, error: 'invalid_code' },
      );
    if (url.endsWith('/v3/conversations')) return Response.json({ id: 'personal-1' });
    return Response.json({ ok: true });
  });
  const waits: Promise<unknown>[] = [];
  const settle = async () => {
    while (waits.length) await waits.shift();
  };
  const hook: ChatKit['hook'] = async (method, path, body, headers = {}) => {
    const request = new Request(`https://api.test${path}`, {
      method,
      headers,
      ...(method === 'GET' ? {} : { body }),
    });
    const segments = new URL(request.url).pathname.replace(/^\//, '').split('/');
    const res = await handleChatHooks(request, env, segments, (p) => void waits.push(p))!;
    await settle();
    return res;
  };
  return {
    ...kit,
    env,
    sent,
    asked,
    workspace: (name) => namespace.get(name),
    drain: async () => {
      for (const workspace of [...held.values()]) await workspace.alarm();
    },
    hook,
    slack: async (door, body, opts = {}) => {
      const at = String(Math.floor((opts.at ?? Date.now()) / 1000));
      return hook('POST', `/api/chat/slack/${door}`, body, {
        'X-Slack-Request-Timestamp': at,
        'X-Slack-Signature': await slackSignature(opts.secret ?? SIGNING, at, body),
      });
    },
    link: (method, path, account, body) =>
      handleChatLink(
        makeTestRouteContext(method, path, {
          env,
          owner: account,
          // A guest has an owner id and no account.
          accountUserId: account?.startsWith('user_') ? account : null,
          ...(body === undefined ? {} : { body }),
        }),
      ),
  };
}

/** A slash command's form. */
export const command = (text: string, user = 'U1', extra: Record<string, string> = {}) =>
  new URLSearchParams({
    team_id: 'T1',
    user_id: user,
    user_name: 'ana',
    channel_id: 'C1',
    text,
    trigger_id: `trig-${Math.random()}`,
    response_url: 'https://hooks.slack.com/commands/T1/1/abc',
    ...extra,
  }).toString();

/** The Slack workspace connected to the knowledgebase, as an install back from Slack leaves it. */
export async function connectSlack(kit: ChatKit) {
  const start = await kit.call('editor', 'POST', '/api/documents/kb/chat/slack');
  const { url } = await start.json<{ url: string }>();
  const state = new URL(url).searchParams.get('state')!;
  return kit.hook('GET', `/api/chat/slack/oauth?code=good&state=${encodeURIComponent(state)}`, '');
}

/** The chat user linked to `account` by following the link the app sent them. */
export async function linkUser(kit: ChatKit, linkUrl: string, account: string | null) {
  const code = new URL(linkUrl).searchParams.get('code')!;
  return kit.link('POST', '/api/chat/link', account, { code });
}

let pair: CryptoKeyPair | null = null;
async function keys(): Promise<CryptoKeyPair> {
  pair ??= (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  return pair;
}
async function botKey() {
  const jwk = await crypto.subtle.exportKey('jwk', (await keys()).publicKey);
  return { ...jwk, kid: 'test-kid', endorsements: ['msteams'] };
}

/** A Bot Framework bearer for `serviceUrl`, signed by the test key. */
export async function botBearer(serviceUrl = SERVICE, claims: Record<string, unknown> = {}) {
  const part = (value: unknown) =>
    bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  const now = Math.floor(Date.now() / 1000);
  const head = part({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' });
  const body = part({
    iss: BOT_FRAMEWORK_ISSUER,
    aud: APP_ID,
    serviceurl: serviceUrl,
    nbf: now - 10,
    exp: now + 3600,
    ...claims,
  });
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    (await keys()).privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `Bearer ${head}.${body}.${bytesToBase64Url(signature)}`;
}

/** A Teams activity from one person in one tenant. */
export const activity = (over: Record<string, unknown> = {}) => ({
  type: 'message',
  id: `act-${Math.random()}`,
  text: 'When do we deploy?',
  serviceUrl: SERVICE,
  from: { id: '29:member', aadObjectId: 'aad-1', name: 'Ana Ruiz' },
  recipient: { id: '28:bot' },
  conversation: { id: 'conv-1', conversationType: 'personal', tenantId: 'tenant-1' },
  ...over,
});

export async function teams(kit: ChatKit, body: unknown, bearer?: string) {
  return kit.hook('POST', '/api/chat/teams/messages', JSON.stringify(body), {
    Authorization: bearer ?? (await botBearer()),
    'Content-Type': 'application/json',
  });
}
