// Slack and Teams (docs/specs/030-knowledgebase/chat-apps.md): what the knowledgebase's chat routes and the account
// link answer.

export type ChatAppPlatform = 'slack' | 'teams';

/** One connection: the workspace's (or tenant's) name and when an Editor made it. */
export type KnowledgeChatConnection = { name: string; connectedAt: number };

/** `GET .../chat` (an Editor's): each platform, whether this server offers it, and what it is connected to. */
export type KnowledgeChatApps = {
  slack: { offered: boolean; connection: KnowledgeChatConnection | null };
  /** `appLink`: where Open Teams goes (the app in Teams), or null when the server names none. */
  teams: { offered: boolean; connection: KnowledgeChatConnection | null; appLink: string | null };
};

/** `POST .../chat/slack`: Slack's install page to send the Editor to. */
export type KnowledgeChatSlackStart = { url: string };

/** `POST .../chat/teams`: the code to send the bot (`connect ABCD-EFGH`), until `expiresAt` (ms). */
export type KnowledgeChatTeamsCode = { code: string; expiresAt: number };

/** `GET /api/chat/link?code=`: what following the link connects. */
export type ChatLinkPreview = {
  platform: ChatAppPlatform;
  workspace: string;
  userName: string | null;
};

/** `POST /api/chat/link`: the chat account now connected. */
export type ChatLinkResult = { platform: ChatAppPlatform; workspace: string };
