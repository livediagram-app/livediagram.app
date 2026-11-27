// A knowledgebase's Slack and Teams (docs/specs/030-knowledgebase/chat-apps.md "Connecting"), a signed-in Editor's:
//   GET    /api/documents/<id>/chat            what this server offers and what the knowledgebase is connected to
//   POST   /api/documents/<id>/chat/slack      Slack's install page, its state signed to this Editor for 10 minutes
//   POST   /api/documents/<id>/chat/teams      a code to send the Teams bot, for 15 minutes
//   DELETE /api/documents/<id>/chat/<platform> disconnect: the workspace forgets everything it held
import type {
  KnowledgeChatApps,
  KnowledgeChatConnection,
  KnowledgeChatSlackStart,
  KnowledgeChatTeamsCode,
} from '@liveknowledge/api-schema';
import type { ChatPlatform } from '@liveworkspace/chat';
import {
  CHAT_UNAVAILABLE,
  knowledgebaseName,
  offered,
  sign,
  SLACK_SCOPES,
  slackOffered,
  slackRedirectUri,
  teamsOffered,
} from '../chat/chat-config';
import { forgetWorkspace } from '../chat/chat-slack';
import { chatWorkspace } from '../chat/chat-workspace';
import { forbidden, json, methodNotAllowed } from '../responses';
import type { KnowledgeRoute } from './knowledge-routes';

/** An install's state lasts this long. */
export const CHAT_STATE_TTL_MS = 600_000;
/** A Teams connect code lasts this long. */
export const CHAT_CODE_TTL_MS = 900_000;

// No 0, O, 1, I or L: a code is read off one screen and typed into another.
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newTeamsCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const letters = [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
  return `${letters.slice(0, 4)}-${letters.slice(4)}`;
}

async function readApps(route: KnowledgeRoute): Promise<KnowledgeChatApps> {
  const { env } = route.ctx;
  const held = env.CHAT_WORKSPACE
    ? await chatWorkspace(env, knowledgebaseName(route.document.id)).connections()
    : [];
  const of = (platform: ChatPlatform): KnowledgeChatConnection | null => {
    const found = held.find((c) => c.platform === platform);
    return found ? { name: found.name, connectedAt: found.connectedAt } : null;
  };
  return {
    slack: { offered: slackOffered(env), connection: of('slack') },
    teams: {
      offered: teamsOffered(env),
      connection: of('teams'),
      appLink: env.TEAMS_APP_LINK?.startsWith('https://') ? env.TEAMS_APP_LINK : null,
    },
  };
}

/** Null when the path is none of these. */
export async function handleChatRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, document, grant } = route;
  const { segments, request, env } = ctx;
  if (segments[3] !== 'chat') return null;
  // A person who edits: connecting a workspace lets its people ask, so it is an Editor's, never a token's.
  if (grant.role !== 'edit' || !ctx.accountUserId || ctx.token || ctx.workbench) return forbidden();
  if (segments.length === 4)
    return request.method === 'GET' ? json(await readApps(route)) : methodNotAllowed();
  const slack = segments[4] === 'slack';
  const chosen: ChatPlatform = slack ? 'slack' : 'teams';
  if (!offered(env, chosen)) return json(CHAT_UNAVAILABLE, { status: 503 });
  const person = ctx.accountUserId;
  const now = Date.now();
  if (request.method === 'DELETE') {
    const dropped = await chatWorkspace(env, knowledgebaseName(document.id)).dropConnection(chosen);
    if (dropped) await forgetWorkspace(env, chosen, dropped.workspace);
    console.info('[chat] disconnected', { documentId: document.id, platform: chosen });
    return json(await readApps(route));
  }
  if (request.method !== 'POST') return methodNotAllowed();
  if (slack) {
    const state = await sign(
      env,
      { k: 'slack-install', kb: document.id, person },
      now + CHAT_STATE_TTL_MS,
    );
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', env.SLACK_CLIENT_ID!);
    url.searchParams.set('scope', SLACK_SCOPES);
    url.searchParams.set('redirect_uri', slackRedirectUri(env));
    url.searchParams.set('state', state!);
    const answer: KnowledgeChatSlackStart = { url: url.href };
    return json(answer);
  }
  const code = newTeamsCode();
  const expiresAt = now + CHAT_CODE_TTL_MS;
  await chatWorkspace(env, `code:${code.replace('-', '')}`).putCode(document.id, person, expiresAt);
  const answer: KnowledgeChatTeamsCode = { code, expiresAt };
  return json(answer);
}
