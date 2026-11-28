// What this server offers of Slack and Teams, and the chat key's uses (docs/specs/030-knowledgebase/blueprints/
// chat-apps.md "Secrets and settings"): a platform is offered only with its settings and the chat key all set, so a
// self-hosted copy without them shows "Not set up on this server" and its routes answer 503.
import { seal, unseal } from '@liveworkspace/api-kit/sealed';
import {
  chatKeys,
  readSigned,
  signPayload,
  type ChatKeys,
  type ChatPlatform,
} from '@liveworkspace/chat';
import { appBaseUrl } from '../email/client';
import type { Env } from '../types';

export const CHAT_UNAVAILABLE = { error: 'chat_unavailable' } as const;

export const slackOffered = (env: Env) =>
  !!(
    env.CHAT_WORKSPACE &&
    env.CHAT_KEY &&
    env.SLACK_CLIENT_ID &&
    env.SLACK_CLIENT_SECRET &&
    env.SLACK_SIGNING_SECRET
  );
export const teamsOffered = (env: Env) =>
  !!(env.CHAT_WORKSPACE && env.CHAT_KEY && env.TEAMS_APP_ID && env.TEAMS_APP_PASSWORD);
export const offered = (env: Env, platform: ChatPlatform) =>
  platform === 'slack' ? slackOffered(env) : teamsOffered(env);

// The keys are derived once a secret: HKDF on every request would be waste.
let held: { secret: string; keys: ChatKeys | null } | null = null;
export async function keysOf(env: Env): Promise<ChatKeys | null> {
  if (!env.CHAT_KEY) return null;
  if (held?.secret !== env.CHAT_KEY)
    held = { secret: env.CHAT_KEY, keys: await chatKeys(env.CHAT_KEY) };
  return held.keys;
}

/** Where Slack sends an install back to: the app's origin, whose router hands /api to this Worker. */
export const slackRedirectUri = (env: Env) => `${appBaseUrl(env)}/api/chat/slack/oauth`;

/** The bot scopes the Slack app asks for (chat-apps.md "Registering the apps"). */
export const SLACK_SCOPES =
  'commands,app_mentions:read,chat:write,im:history,links:read,links:write,users:read';

/** A workspace's DO name. */
export const workspaceName = (platform: ChatPlatform, workspace: string) =>
  `${platform}:${workspace}`;
export const knowledgebaseName = (knowledgebase: string) => `kb:${knowledgebase}`;

const TOKEN_CONTEXT = 'chat-bot-token';

export async function sealToken(env: Env, token: string): Promise<string | null> {
  const keys = await keysOf(env);
  return keys ? seal(keys.seal, TOKEN_CONTEXT, token) : null;
}
export async function unsealToken(env: Env, sealed: string | null): Promise<string | null> {
  const keys = await keysOf(env);
  return keys && sealed ? unseal(keys.seal, TOKEN_CONTEXT, sealed) : null;
}

export async function sign(env: Env, payload: Record<string, unknown>, expiresAt: number) {
  const keys = await keysOf(env);
  return keys ? signPayload(keys.sign, payload, expiresAt) : null;
}
export async function readSign(env: Env, token: string | null | undefined, now = Date.now()) {
  const keys = await keysOf(env);
  return keys ? readSigned(keys.sign, token, now) : null;
}

/** The link a chat user follows to connect their account (chat-apps.md "Linking an account"). */
export async function linkUrl(
  env: Env,
  link: { platform: ChatPlatform; workspace: string; user: string; nonce: string },
  expiresAt: number,
): Promise<string | null> {
  const code = await sign(
    env,
    { k: 'link', p: link.platform, w: link.workspace, u: link.user, n: link.nonce },
    expiresAt,
  );
  return code ? `${appBaseUrl(env)}/chat/link?code=${encodeURIComponent(code)}` : null;
}

export type LinkCode = { platform: ChatPlatform; workspace: string; user: string; nonce: string };

export async function readLinkCode(
  env: Env,
  code: string | null | undefined,
): Promise<LinkCode | null> {
  const value = await readSign(env, code);
  if (!value || value.k !== 'link') return null;
  const { p, w, u, n } = value;
  if (
    (p !== 'slack' && p !== 'teams') ||
    typeof w !== 'string' ||
    typeof u !== 'string' ||
    typeof n !== 'string'
  )
    return null;
  return { platform: p, workspace: w, user: u, nonce: n };
}
