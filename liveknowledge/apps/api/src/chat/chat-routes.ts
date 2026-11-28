// /api/chat (docs/specs/030-knowledgebase/blueprints/chat-apps.md "The Worker's routes"). Slack's and Teams' doors
// carry their platform's signature, never a person, so the worker answers them before identity (handleChatHooks).
// The account link is a signed-in person's, after identity (handleChatLink):
//   GET  /api/chat/link?code=   what the code links: the platform, the workspace and the chat user's name
//   POST /api/chat/link         { code }: the chat user linked to the signed-in account, once
import type { ChatLinkPreview, ChatLinkResult } from '@liveknowledge/api-schema';
import { json } from '../responses';
import type { RouteContext } from '../routes/context';
import type { Env } from '../types';
import { CHAT_UNAVAILABLE, offered, readLinkCode, workspaceName } from './chat-config';
import { handleSlack } from './chat-slack';
import { handleTeams } from './chat-teams';
import { chatWorkspace } from './chat-workspace';

/** Slack's and Teams' doors, or null for any other /api/chat path. */
export function handleChatHooks(
  request: Request,
  env: Env,
  segments: string[],
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> | null {
  if (segments[2] === 'slack') return handleSlack(request, env, segments, waitUntil);
  if (segments[2] === 'teams') return handleTeams(request, env, segments);
  return null;
}

const EXPIRED = {
  error: 'link_expired',
  message: 'This link has expired or was used. Ask the app again for a fresh one.',
};

export async function handleChatLink(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments.length !== 3 || segments[2] !== 'link')
    return json({ error: 'not_found' }, { status: 404 });
  if (request.method !== 'GET' && request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, { status: 405 });
  let raw: string | null;
  if (request.method === 'GET') raw = ctx.url.searchParams.get('code');
  else {
    const body = await request.json<{ code?: unknown }>().catch(() => null);
    raw = typeof body?.code === 'string' ? body.code : null;
  }
  const code = await readLinkCode(env, raw);
  if (!code) return json(EXPIRED, { status: 410 });
  if (!offered(env, code.platform)) return json(CHAT_UNAVAILABLE, { status: 503 });
  const workspace = chatWorkspace(env, workspaceName(code.platform, code.workspace));
  const install = await workspace.install();
  const pending = install ? await workspace.pendingLink(code.user, code.nonce) : null;
  if (!install || !pending) return json(EXPIRED, { status: 410 });
  if (request.method === 'GET') {
    const preview: ChatLinkPreview = {
      platform: code.platform,
      workspace: install.name,
      userName: pending.userName,
    };
    return json(preview);
  }
  // An account's, never a guest's or a token's: answers will read as this person.
  if (!ctx.accountUserId || ctx.token || ctx.workbench)
    return json(
      { error: 'sign_in_required', message: 'Sign in to liveknowledge to connect your account.' },
      { status: 401 },
    );
  const done = await workspace.completeLink(code.user, code.nonce, ctx.accountUserId);
  if (done === 'expired') return json(EXPIRED, { status: 410 });
  if (done === 'full')
    return json(
      { error: 'links_full', message: 'This workspace has connected as many accounts as it can.' },
      { status: 409 },
    );
  console.info('[chat] linked', { platform: code.platform });
  const result: ChatLinkResult = { platform: code.platform, workspace: install.name };
  return json(result);
}
