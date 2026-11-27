// Slack's doors (docs/specs/030-knowledgebase/blueprints/chat-apps.md "The Worker's routes"):
//   POST /api/chat/slack/commands       /ask
//   POST /api/chat/slack/events         mentions, direct messages, pasted links, the app removed
//   POST /api/chat/slack/interactions   Share in Channel
//   GET  /api/chat/slack/oauth          an install coming back from Slack
// Nothing in a request is believed before its signature checks (@liveworkspace/chat verifySlackRequest), and a
// request seen before is answered empty. Each answers within Slack's three seconds: the slow part is queued in the
// workspace's ChatWorkspace.
import {
  postToResponseUrl,
  slackAnswer,
  slackCall,
  slackNotice,
  slackOAuthAccess,
  verifySlackRequest,
  type ChatAnswer,
} from '@liveworkspace/chat';
import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { appBaseUrl } from '../email/client';
import { json } from '../responses';
import type { Env } from '../types';
import {
  CHAT_UNAVAILABLE,
  knowledgebaseName,
  readSign,
  sealToken,
  slackOffered,
  slackRedirectUri,
  unsealToken,
  workspaceName,
} from './chat-config';
import { chatWorkspace } from './chat-workspace';

/** The most a chat request's body may hold. */
export const CHAT_BODY_MAX = 65_536;

export const HELP_TEXT =
  'Ask the knowledgebase a question: `/ask how do we deploy?`, mention me in a channel, or message me here. Answers use the pages your liveknowledge account can open. `/ask unlink` disconnects your account.';
export const NOT_CONNECTED =
  "This Slack workspace isn't connected to a knowledgebase. An Editor connects it from the knowledgebase's menu, under Slack and Teams.";
const UNLINKED = 'Your liveknowledge account is no longer connected here.';
const NOT_LINKED = 'No liveknowledge account is connected here.';
const LOOKING = 'Looking that up in the knowledgebase…';
const BUSY = 'liveknowledge is busy right now. Try again in a minute.';
const SHARE_GONE = 'This answer can no longer be shared. Ask again to share a fresh one.';

const ephemeral = (text: string) => json({ response_type: 'ephemeral', ...slackNotice(text) });
const ok = () => new Response(null, { status: 200 });

/** The request's text once its signature is good; else the answer to give. */
/** A chat request's body as text, at most CHAT_BODY_MAX bytes; null past it. */
export async function readChatBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const bytes = await readCappedBody(request.body as ReadableStream<Uint8Array>, CHAT_BODY_MAX);
  return bytes ? new TextDecoder().decode(bytes) : null;
}

async function signedBody(request: Request, env: Env): Promise<string | Response> {
  const body = await readChatBody(request);
  if (body === null) return json({ error: 'payload_too_large' }, { status: 413 });
  const check = await verifySlackRequest({
    secret: env.SLACK_SIGNING_SECRET!,
    timestamp: request.headers.get('X-Slack-Request-Timestamp'),
    signature: request.headers.get('X-Slack-Signature'),
    body,
    now: Date.now(),
  });
  if (check !== 'ok') {
    console.warn('[chat] slack refused', { check });
    return json({ error: 'bad_signature' }, { status: 401 });
  }
  return body;
}

/** The question a mention or a message holds: its text without the app's mention. */
export const questionOf = (text: unknown) =>
  typeof text === 'string'
    ? text
        .replace(/<@[A-Z0-9]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

async function handleCommand(env: Env, body: string): Promise<Response> {
  const form = new URLSearchParams(body);
  const team = form.get('team_id') ?? '';
  const user = form.get('user_id') ?? '';
  const channel = form.get('channel_id') ?? '';
  const responseUrl = form.get('response_url') ?? '';
  const text = (form.get('text') ?? '').trim();
  if (!team || !user) return json({ error: 'bad_request' }, { status: 400 });
  const workspace = chatWorkspace(env, workspaceName('slack', team));
  // A command carries no id of its own: its signature is one a request.
  if (await workspace.seen(`sig:${form.get('trigger_id') ?? ''}:${team}:${user}:${text}`))
    return ok();
  if (!(await workspace.install())) return ephemeral(NOT_CONNECTED);
  if (text === '' || text.toLowerCase() === 'help') return ephemeral(HELP_TEXT);
  if (text.toLowerCase() === 'unlink')
    return ephemeral((await workspace.unlink(user)) ? UNLINKED : NOT_LINKED);
  const queued = await workspace.queue('slack-ask', {
    kind: 'slack-ask',
    user,
    userName: form.get('user_name'),
    question: text,
    channel,
    responseUrl,
  });
  return ephemeral(queued === 'queued' ? LOOKING : BUSY);
}

type SlackEvent = {
  type?: string;
  user?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  bot_id?: string;
  subtype?: string;
  message_ts?: string;
  links?: { url?: unknown }[];
};

async function handleEvent(env: Env, body: string, waitUntil: (p: Promise<unknown>) => void) {
  let payload: {
    type?: string;
    challenge?: string;
    team_id?: string;
    event_id?: string;
    event?: SlackEvent;
  };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return json({ error: 'bad_request' }, { status: 400 });
  }
  if (payload.type === 'url_verification') return json({ challenge: payload.challenge ?? '' });
  const team = payload.team_id;
  const event = payload.event;
  if (payload.type !== 'event_callback' || !team || !event || !payload.event_id) return ok();
  const workspace = chatWorkspace(env, workspaceName('slack', team));
  // Slack sends an event again when it hears nothing in three seconds: the second is the first.
  if (await workspace.seen(`event:${payload.event_id}`)) return ok();
  const install = await workspace.install();
  if (!install) return ok();
  if (event.type === 'app_uninstalled' || event.type === 'tokens_revoked') {
    await chatWorkspace(env, knowledgebaseName(install.knowledgebase)).dropConnection(
      'slack',
      team,
    );
    await workspace.forget();
    console.info('[chat] slack removed', { team });
    return ok();
  }
  // Never a bot's own words, so two apps never answer each other.
  if (event.bot_id || event.subtype || !event.user || !event.channel) return ok();
  const user = event.user;
  const channel = event.channel;
  if (event.type === 'link_shared') {
    const links = (event.links ?? [])
      .map((l) => l.url)
      .filter((u): u is string => typeof u === 'string');
    if (links.length && event.message_ts)
      waitUntil(
        workspace.queue('slack-unfurl', {
          kind: 'slack-unfurl',
          user,
          channel,
          ts: event.message_ts,
          links,
        }),
      );
    return ok();
  }
  const dm = event.type === 'message' && event.channel_type === 'im';
  if (event.type !== 'app_mention' && !dm) return ok();
  const question = questionOf(event.text);
  const notice = (text: string) =>
    workspace.queue('slack-notice', { kind: 'slack-notice', user, channel, dm, text });
  if (question === '' || question.toLowerCase() === 'help') waitUntil(notice(HELP_TEXT));
  else if (question.toLowerCase() === 'unlink')
    waitUntil(workspace.unlink(user).then((had) => notice(had ? UNLINKED : NOT_LINKED)));
  else
    waitUntil(
      workspace.queue('slack-ask', {
        kind: 'slack-ask',
        user,
        userName: null,
        question,
        channel,
        dm,
      }),
    );
  return ok();
}

const SLACK_USER = /^[UW][A-Z0-9]{1,30}$/;

async function handleInteraction(env: Env, body: string, waitUntil: (p: Promise<unknown>) => void) {
  let payload: {
    type?: string;
    user?: { id?: string };
    team?: { id?: string };
    response_url?: string;
    actions?: { action_id?: string; value?: string }[];
  };
  try {
    payload = JSON.parse(new URLSearchParams(body).get('payload') ?? '') as typeof payload;
  } catch {
    return json({ error: 'bad_request' }, { status: 400 });
  }
  const action = payload.actions?.[0];
  const user = payload.user?.id ?? '';
  const team = payload.team?.id ?? '';
  const responseUrl = payload.response_url ?? '';
  if (payload.type !== 'block_actions' || action?.action_id !== 'share_answer' || !action.value)
    return ok();
  if (!SLACK_USER.test(user) || !team || !responseUrl) return ok();
  const workspace = chatWorkspace(env, workspaceName('slack', team));
  waitUntil(
    (async () => {
      const raw = (await workspace.install())
        ? await workspace.takeAnswer(action.value!, user)
        : null;
      const kept = raw === null ? null : (JSON.parse(raw) as ChatAnswer);
      if (!kept) {
        await postToResponseUrl(responseUrl, {
          response_type: 'ephemeral',
          replace_original: false,
          ...slackNotice(SHARE_GONE),
        });
        return;
      }
      const shared = slackAnswer({ ...kept, share: null, sharedBy: `Shared by <@${user}>` });
      await postToResponseUrl(responseUrl, {
        response_type: 'in_channel',
        replace_original: false,
        ...shared,
      });
      await postToResponseUrl(responseUrl, { delete_original: true });
    })(),
  );
  return ok();
}

const backTo = (env: Env, knowledgebase: string, outcome: string) =>
  Response.redirect(
    `${appBaseUrl(env)}/document/${encodeURIComponent(knowledgebase)}?chat=${outcome}`,
    302,
  );

/** An install back from Slack: its state names the knowledgebase and the Editor (chat-apps.md "Connecting"). */
async function handleOAuth(env: Env, url: URL): Promise<Response> {
  const state = await readSign(env, url.searchParams.get('state'));
  const knowledgebase = typeof state?.kb === 'string' ? state.kb : null;
  const person = typeof state?.person === 'string' ? state.person : null;
  if (state?.k !== 'slack-install' || !knowledgebase || !person)
    return Response.redirect(`${appBaseUrl(env)}/?chat=failed`, 302);
  const code = url.searchParams.get('code');
  if (!code)
    return backTo(
      env,
      knowledgebase,
      url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed',
    );
  const access = await slackOAuthAccess({
    clientId: env.SLACK_CLIENT_ID!,
    clientSecret: env.SLACK_CLIENT_SECRET!,
    code,
    redirectUri: slackRedirectUri(env),
  });
  if (!access.ok) {
    console.warn('[chat] slack install failed', { error: access.error });
    return backTo(env, knowledgebase, 'failed');
  }
  const { team, token, botUser } = access.install;
  const sealed = await sealToken(env, token);
  if (!sealed) return backTo(env, knowledgebase, 'failed');
  const now = Date.now();
  const written = await chatWorkspace(env, workspaceName('slack', team.id)).connectInstall({
    platform: 'slack',
    workspace: team.id,
    name: team.name,
    knowledgebase,
    connectedBy: person,
    connectedAt: now,
    token: sealed,
    botUser,
    serviceUrl: null,
  });
  if (written === 'taken') return backTo(env, knowledgebase, 'taken');
  const replaced = await chatWorkspace(env, knowledgebaseName(knowledgebase)).writeConnection({
    platform: 'slack',
    workspace: team.id,
    name: team.name,
    connectedBy: person,
    connectedAt: now,
  });
  if (replaced) await forgetWorkspace(env, 'slack', replaced.workspace);
  console.info('[chat] slack connected', { knowledgebase, team: team.id });
  return backTo(env, knowledgebase, 'connected');
}

/** A workspace forgotten, its Slack token revoked first (chat-apps.md "Disconnect forgets"). */
export async function forgetWorkspace(env: Env, platform: 'slack' | 'teams', workspace: string) {
  const held = chatWorkspace(env, workspaceName(platform, workspace));
  if (platform === 'slack') {
    const token = await unsealToken(env, (await held.install())?.token ?? null);
    if (token) await slackCall('auth.revoke', token, {});
  }
  await held.forget();
}

export async function handleSlack(
  request: Request,
  env: Env,
  segments: string[],
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  if (!slackOffered(env)) return json(CHAT_UNAVAILABLE, { status: 503 });
  const door = segments[3];
  if (segments.length !== 4) return json({ error: 'not_found' }, { status: 404 });
  if (door === 'oauth')
    return request.method === 'GET'
      ? handleOAuth(env, new URL(request.url))
      : json({ error: 'method_not_allowed' }, { status: 405 });
  if (door !== 'commands' && door !== 'events' && door !== 'interactions')
    return json({ error: 'not_found' }, { status: 404 });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });
  const body = await signedBody(request, env);
  if (body instanceof Response) return body;
  if (door === 'commands') return handleCommand(env, body);
  if (door === 'events') return handleEvent(env, body, waitUntil);
  return handleInteraction(env, body, waitUntil);
}
