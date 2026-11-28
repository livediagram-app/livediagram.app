// Slack and Teams (docs/specs/030-knowledgebase/chat-apps.md): a knowledgebase's connections, an Editor's, and a chat
// user's account link.
import type {
  ChatAppPlatform,
  ChatLinkPreview,
  ChatLinkResult,
  KnowledgeChatApps,
  KnowledgeChatSlackStart,
  KnowledgeChatTeamsCode,
} from '@liveknowledge/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

export async function apiChatApps(who: KnowledgeCaller, documentId: string, signal?: AbortSignal) {
  const res = await apiFetch(knowledgeUrl(documentId, 'chat'), {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
  });
  return expectOk<KnowledgeChatApps>(res, 'read chat apps');
}

async function send<T>(
  who: KnowledgeCaller,
  documentId: string,
  platform: ChatAppPlatform,
  method: 'POST' | 'DELETE',
  action: string,
): Promise<T> {
  const res = await apiFetch(knowledgeUrl(documentId, `chat/${platform}`), {
    method,
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });
  return expectOk<T>(res, action);
}

export const apiStartSlack = (who: KnowledgeCaller, documentId: string) =>
  send<KnowledgeChatSlackStart>(who, documentId, 'slack', 'POST', 'start slack');
export const apiStartTeams = (who: KnowledgeCaller, documentId: string) =>
  send<KnowledgeChatTeamsCode>(who, documentId, 'teams', 'POST', 'start teams');
export const apiDisconnectChat = (
  who: KnowledgeCaller,
  documentId: string,
  platform: ChatAppPlatform,
) => send<KnowledgeChatApps>(who, documentId, platform, 'DELETE', 'disconnect chat');

const linkUrl = `${API_BASE}/chat/link`;

/** What a link's code connects; throws `link_expired` (410) for a used or old one. */
export async function apiChatLinkPreview(ownerId: string, code: string) {
  const res = await apiFetch(`${linkUrl}?code=${encodeURIComponent(code)}`, {
    headers: await apiHeaders(ownerId),
  });
  return expectOk<ChatLinkPreview>(res, 'read chat link');
}

/** The chat account linked to the signed-in one. */
export async function apiCompleteChatLink(ownerId: string, code: string) {
  const res = await apiFetch(linkUrl, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ code }),
  });
  return expectOk<ChatLinkResult>(res, 'link chat account');
}
