// Teams' door (docs/specs/030-knowledgebase/blueprints/chat-apps.md "The Worker's routes"):
//   POST /api/chat/teams/messages   every activity the Bot Framework sends: a message, a pasted link
// Nothing in an activity is believed before its token checks (@liveworkspace/chat verifyBotFrameworkRequest), and an
// activity seen before is answered empty. A message is answered at once and its slow part queued in the tenant's
// ChatWorkspace; a pasted link's preview is answered in the invoke itself, as Teams waits for it.
import {
  createBotFrameworkKeys,
  isTeamsServiceUrl,
  teamsLinkResult,
  verifyBotFrameworkRequest,
} from '@liveworkspace/chat';
import { json } from '../responses';
import type { Env } from '../types';
import { pageOfLink } from './chat-answer';
import {
  CHAT_UNAVAILABLE,
  knowledgebaseName,
  linkUrl,
  teamsOffered,
  workspaceName,
} from './chat-config';
import { CONNECT_BUTTON } from './chat-jobs';
import { CHAT_LINK_TTL_MS } from './chat-workspace-store';
import { readChatBody } from './chat-slack';
import { chatWorkspace } from './chat-workspace';

const botKeys = createBotFrameworkKeys();

export const TEAMS_HELP =
  'Ask the knowledgebase a question here, or mention me in a channel. Answers use the pages your liveknowledge account can open, and come to this chat. Send "unlink" to disconnect your account.';
const TEAMS_NOT_CONNECTED =
  "This Teams organisation isn't connected to a knowledgebase. An Editor connects it from the knowledgebase's menu, under Slack and Teams, and sends me the code it shows.";
const CODE_GONE =
  "That code has expired or was used. Make a new one in the knowledgebase's menu, under Slack and Teams.";
const TAKEN =
  'This Teams organisation is already connected to another knowledgebase. Disconnect it there first.';
const CONNECTED =
  'Connected. Ask me a question here, or mention me in a channel. Everyone connects their own liveknowledge account the first time they ask.';
const UNLINKED = 'Your liveknowledge account is no longer connected here.';
const NOT_LINKED = 'No liveknowledge account is connected here.';
const LOOKING = 'Looking that up in the knowledgebase…';
const SENT_PRIVATELY = 'I sent you the answer in a private chat.';

/** A connect code as typed: `ABCD-EFGH`, any case, the dash optional. */
const CODE = /^connect\s+([A-Z0-9]{4})-?([A-Z0-9]{4})$/i;

type Activity = {
  type?: string;
  id?: string;
  name?: string;
  text?: string;
  serviceUrl?: string;
  from?: { id?: string; aadObjectId?: string; name?: string };
  recipient?: { id?: string };
  conversation?: { id?: string; conversationType?: string; tenantId?: string };
  channelData?: { tenant?: { id?: string } };
  value?: { url?: unknown };
};

/** The words of a message: its mention and its markup taken out. */
export const teamsText = (text: unknown) =>
  typeof text === 'string'
    ? text
        .replace(/<at>[^<]*<\/at>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

async function linkPreview(env: Env, activity: Activity, user: string, tenant: string) {
  const link = typeof activity.value?.url === 'string' ? activity.value.url : '';
  const page = pageOfLink(env, link);
  const workspace = chatWorkspace(env, workspaceName('teams', tenant));
  const install = await workspace.install();
  if (!page || !install || page.knowledgebase !== install.knowledgebase) return json({});
  const linked = await workspace.linkOf(user);
  if (!linked) {
    const nonce = await workspace.startLink(user, activity.from?.name ?? null);
    const url = await linkUrl(
      env,
      { platform: 'teams', workspace: tenant, user, nonce },
      Date.now() + CHAT_LINK_TTL_MS,
    );
    if (!url) return json({});
    return json({
      composeExtension: {
        type: 'auth',
        suggestedActions: { actions: [{ type: 'openUrl', title: CONNECT_BUTTON, value: url }] },
      },
    });
  }
  const preview = await workspace.previewLink({
    knowledgebase: page.knowledgebase,
    tab: page.tab,
    person: linked.person,
  });
  return json(preview ? teamsLinkResult(preview) : {});
}

export async function handleTeams(
  request: Request,
  env: Env,
  segments: string[],
): Promise<Response> {
  if (!teamsOffered(env)) return json(CHAT_UNAVAILABLE, { status: 503 });
  if (segments.length !== 4 || segments[3] !== 'messages')
    return json({ error: 'not_found' }, { status: 404 });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });
  const body = await readChatBody(request);
  if (body === null) return json({ error: 'payload_too_large' }, { status: 413 });
  let activity: Activity;
  try {
    activity = JSON.parse(body) as Activity;
  } catch {
    return json({ error: 'bad_request' }, { status: 400 });
  }
  const serviceUrl = activity.serviceUrl ?? null;
  const check = await verifyBotFrameworkRequest({
    authorization: request.headers.get('Authorization'),
    appId: env.TEAMS_APP_ID!,
    serviceUrl,
    now: Date.now(),
    keys: botKeys,
  });
  if (check !== 'ok' || !serviceUrl || !isTeamsServiceUrl(serviceUrl)) {
    console.warn('[chat] teams refused', { check });
    return json({ error: 'bad_token' }, { status: 401 });
  }
  const tenant = activity.conversation?.tenantId ?? activity.channelData?.tenant?.id ?? '';
  const member = activity.from?.id ?? '';
  const user = activity.from?.aadObjectId ?? member;
  const conversation = activity.conversation?.id ?? '';
  if (!tenant || !user || !conversation) return new Response(null, { status: 200 });
  const workspace = chatWorkspace(env, workspaceName('teams', tenant));
  if (activity.id && (await workspace.seen(`activity:${activity.id}`)))
    return new Response(null, { status: 200 });
  if (activity.type === 'invoke' && activity.name === 'composeExtension/queryLink')
    return linkPreview(env, activity, user, tenant);
  if (activity.type !== 'message') return new Response(null, { status: 200 });
  const replyTo = activity.id ?? '';
  const notice = (text: string) =>
    workspace.queue('teams-notice', {
      kind: 'teams-notice',
      serviceUrl,
      conversation,
      replyTo,
      text,
    });
  const text = teamsText(activity.text);
  const code = CODE.exec(text);
  if (code) {
    const held = await chatWorkspace(
      env,
      `code:${code[1]!.toUpperCase()}${code[2]!.toUpperCase()}`,
    ).takeCode();
    if (!held) await notice(CODE_GONE);
    else {
      const now = Date.now();
      const written = await workspace.connectInstall({
        platform: 'teams',
        workspace: tenant,
        name: 'Microsoft Teams',
        knowledgebase: held.knowledgebase,
        connectedBy: held.person,
        connectedAt: now,
        token: null,
        botUser: activity.recipient?.id ?? null,
        serviceUrl,
      });
      if (written === 'taken') await notice(TAKEN);
      else {
        const replaced = await chatWorkspace(
          env,
          knowledgebaseName(held.knowledgebase),
        ).writeConnection({
          platform: 'teams',
          workspace: tenant,
          name: 'Microsoft Teams',
          connectedBy: held.person,
          connectedAt: now,
        });
        if (replaced) await chatWorkspace(env, workspaceName('teams', replaced.workspace)).forget();
        console.info('[chat] teams connected', { knowledgebase: held.knowledgebase });
        await notice(CONNECTED);
      }
    }
    return new Response(null, { status: 200 });
  }
  if (!(await workspace.install())) await notice(TEAMS_NOT_CONNECTED);
  else if (text === '' || text.toLowerCase() === 'help') await notice(TEAMS_HELP);
  else if (text.toLowerCase() === 'unlink')
    await notice((await workspace.unlink(user)) ? UNLINKED : NOT_LINKED);
  else {
    const personal = activity.conversation?.conversationType === 'personal';
    if (personal) await notice(LOOKING);
    await workspace.queue('teams-ask', {
      kind: 'teams-ask',
      user,
      userName: activity.from?.name ?? null,
      member,
      question: text,
      serviceUrl,
      conversation,
      replyTo,
      personal,
      bot: activity.recipient?.id ?? '',
    });
    if (!personal) await notice(SENT_PRIVATELY);
  }
  await workspace.noteServiceUrl(serviceUrl);
  return new Response(null, { status: 200 });
}
