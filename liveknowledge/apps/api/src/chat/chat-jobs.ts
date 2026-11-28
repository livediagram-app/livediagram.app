// The slow part of a chat request (docs/specs/030-knowledgebase/blueprints/chat-apps.md "Asking"), run in the
// workspace's alarm a few at a time: Ask as the linked person, a page's preview as the person who pasted its link,
// each sent back to Slack or Teams. Who is linked is read again here, so an unlink between the request and its turn
// is kept. A job that throws is tried once more, then dropped.
import {
  createBotTokens,
  personalConversation,
  postToResponseUrl,
  sendToConversation,
  slackAnswer,
  slackCall,
  slackConnectPrompt,
  slackNotice,
  slackPreview,
  teamsAnswer,
  teamsConnectPrompt,
  teamsMessage,
  teamsNotice,
  type BotCredentials,
  type ChatAnswer,
  type ChatPlatform,
  type SlackMessage,
} from '@liveworkspace/chat';
import type { Env } from '../types';
import { askAsPerson, pageOfLink, previewAsPerson } from './chat-answer';
import { chatPersonDeps, type ChatPersonDeps } from './chat-as-person';
import { linkUrl, unsealToken } from './chat-config';
import * as store from './chat-workspace-store';

/** Jobs run in one turn of the alarm. */
export const CHAT_JOBS_A_TURN = 3;
/** Tries before a job is dropped. */
export const CHAT_JOB_TRIES = 2;
/** Links in one message previewed. */
export const CHAT_UNFURLS_MAX = 5;

export type ChatJobDeps = {
  person: ChatPersonDeps;
  fetch: typeof fetch;
  botToken: (creds: BotCredentials) => Promise<string | null>;
};

const botTokens = createBotTokens();
export const chatJobDeps: ChatJobDeps = {
  person: chatPersonDeps,
  fetch: (input, init) => fetch(input, init),
  botToken: (creds) => botTokens(creds),
};

export type SlackAskJob = {
  kind: 'slack-ask';
  user: string;
  userName: string | null;
  question: string;
  channel: string;
  /** A slash command's; a mention and a direct message have none. */
  responseUrl?: string;
  /** A direct message to the app: answered there, where no one else reads it. */
  dm?: boolean;
};
export type SlackUnfurlJob = {
  kind: 'slack-unfurl';
  user: string;
  channel: string;
  ts: string;
  links: string[];
};
export type TeamsAskJob = {
  kind: 'teams-ask';
  /** Who the link is kept for (their Entra object id, else their Teams id). */
  user: string;
  userName: string | null;
  /** Their id in the conversation, for the personal chat. */
  member: string;
  question: string;
  serviceUrl: string;
  conversation: string;
  replyTo: string;
  personal: boolean;
  bot: string;
};
/** A line said back (help, unlinked, connected), with no knowledgebase read. */
export type SlackNoticeJob = {
  kind: 'slack-notice';
  user: string;
  channel: string;
  dm?: boolean;
  text: string;
};
export type TeamsNoticeJob = {
  kind: 'teams-notice';
  serviceUrl: string;
  conversation: string;
  replyTo: string;
  text: string;
};
export type ChatJob = SlackAskJob | SlackUnfurlJob | TeamsAskJob | SlackNoticeJob | TeamsNoticeJob;

export const CONNECT_TEXT =
  'Connect your liveknowledge account once, and answers will use the pages you can open.';
export const CONNECT_BUTTON = 'Connect Your Account';
const UNAVAILABLE = 'liveknowledge is not set up for chat on this server.';

/** The prompt to connect an account, with a fresh link; null when the chat key is gone. */
export async function connectLink(
  env: Env,
  sql: store.ChatSql,
  link: { platform: ChatPlatform; workspace: string; user: string; userName: string | null },
  now = Date.now(),
) {
  const nonce = await store.startLink(sql, link.user, link.userName, now);
  return linkUrl(env, { ...link, nonce }, now + store.CHAT_LINK_TTL_MS);
}

async function slackSend(
  deps: ChatJobDeps,
  token: string | null,
  job: { user: string; channel: string; responseUrl?: string; dm?: boolean },
  message: SlackMessage,
): Promise<void> {
  if (job.responseUrl) {
    await postToResponseUrl(
      job.responseUrl,
      { response_type: 'ephemeral', replace_original: true, ...message },
      deps.fetch,
    );
    return;
  }
  if (!token) return;
  const payload = { channel: job.channel, ...message };
  if (job.dm) await slackCall('chat.postMessage', token, payload, deps.fetch);
  else await slackCall('chat.postEphemeral', token, { ...payload, user: job.user }, deps.fetch);
}

async function runSlackAsk(
  env: Env,
  sql: store.ChatSql,
  deps: ChatJobDeps,
  install: store.ChatInstall,
  job: SlackAskJob,
) {
  const token = await unsealToken(env, install.token);
  const link = store.linkOf(sql, job.user);
  if (!link) {
    const url = await connectLink(env, sql, {
      platform: 'slack',
      workspace: install.workspace,
      user: job.user,
      userName: job.userName,
    });
    await slackSend(
      deps,
      token,
      job,
      url
        ? slackConnectPrompt({ text: CONNECT_TEXT, button: CONNECT_BUTTON, url })
        : slackNotice(UNAVAILABLE),
    );
    return;
  }
  const answer = await askAsPerson(env, deps.person, {
    knowledgebase: install.knowledgebase,
    person: link.person,
    question: job.question,
  });
  if ('refused' in answer) {
    await slackSend(deps, token, job, slackNotice(answer.refused));
    return;
  }
  let shown: ChatAnswer = answer;
  // In a channel, the answer is the asker's alone until they share it (chat-apps.md "Answers are private").
  if (!job.dm) {
    const id = crypto.randomUUID();
    store.keepAnswer(sql, id, job.user, JSON.stringify(answer), Date.now());
    shown = { ...answer, share: { label: 'Share in Channel', value: id } };
  }
  await slackSend(deps, token, job, slackAnswer(shown));
}

async function runSlackUnfurl(
  env: Env,
  sql: store.ChatSql,
  deps: ChatJobDeps,
  install: store.ChatInstall,
  job: SlackUnfurlJob,
) {
  const token = await unsealToken(env, install.token);
  if (!token) return;
  // Only the connected knowledgebase's pages are previewed here.
  const links = job.links
    .slice(0, CHAT_UNFURLS_MAX)
    .map((url) => ({ url, page: pageOfLink(env, url) }))
    .filter((l) => l.page?.knowledgebase === install.knowledgebase);
  if (links.length === 0) return;
  const link = store.linkOf(sql, job.user);
  const base = { channel: job.channel, ts: job.ts };
  if (!link) {
    const url = await connectLink(env, sql, {
      platform: 'slack',
      workspace: install.workspace,
      user: job.user,
      userName: null,
    });
    if (url)
      await slackCall(
        'chat.unfurl',
        token,
        { ...base, unfurls: {}, user_auth_required: true, user_auth_url: url },
        deps.fetch,
      );
    return;
  }
  const unfurls: Record<string, { blocks: unknown[] }> = {};
  for (const { url, page } of links) {
    const preview = await previewAsPerson(env, deps.person, {
      knowledgebase: page!.knowledgebase,
      tab: page!.tab,
      person: link.person,
    });
    if (preview) unfurls[url] = { blocks: slackPreview(preview).blocks };
  }
  if (Object.keys(unfurls).length > 0)
    await slackCall('chat.unfurl', token, { ...base, unfurls }, deps.fetch);
}

async function runTeamsAsk(
  env: Env,
  sql: store.ChatSql,
  deps: ChatJobDeps,
  install: store.ChatInstall,
  job: TeamsAskJob,
) {
  const token = await teamsToken(env, deps);
  if (!token) return;
  const send = async (activity: Record<string, unknown>) => {
    // A channel's question is answered in the asker's personal chat (chat-apps.md "Answers are private").
    const conversation = job.personal
      ? job.conversation
      : await personalConversation(
          {
            serviceUrl: job.serviceUrl,
            botId: job.bot,
            userId: job.member,
            tenantId: install.workspace,
            token,
          },
          deps.fetch,
        );
    if (!conversation) return;
    await sendToConversation(
      {
        serviceUrl: job.serviceUrl,
        conversationId: conversation,
        ...(job.personal ? { replyTo: job.replyTo } : {}),
        token,
      },
      activity,
      deps.fetch,
    );
  };
  const link = store.linkOf(sql, job.user);
  if (!link) {
    const url = await connectLink(env, sql, {
      platform: 'teams',
      workspace: install.workspace,
      user: job.user,
      userName: job.userName,
    });
    await send(
      teamsMessage(
        url
          ? teamsConnectPrompt({ text: CONNECT_TEXT, button: CONNECT_BUTTON, url })
          : teamsNotice(UNAVAILABLE),
      ),
    );
    return;
  }
  const answer = await askAsPerson(env, deps.person, {
    knowledgebase: install.knowledgebase,
    person: link.person,
    question: job.question,
  });
  await send(teamsMessage('refused' in answer ? teamsNotice(answer.refused) : teamsAnswer(answer)));
}

async function teamsToken(env: Env, deps: ChatJobDeps) {
  if (!env.TEAMS_APP_ID || !env.TEAMS_APP_PASSWORD) return null;
  const token = await deps.botToken({
    appId: env.TEAMS_APP_ID,
    password: env.TEAMS_APP_PASSWORD,
    tenant: env.TEAMS_APP_TENANT,
  });
  if (!token) throw new Error('bot token');
  return token;
}

async function runNotice(
  env: Env,
  deps: ChatJobDeps,
  install: store.ChatInstall | null,
  job: ChatJob,
) {
  if (job.kind === 'slack-notice') {
    const token = await unsealToken(env, install?.token ?? null);
    await slackSend(deps, token, job, slackNotice(job.text));
  } else if (job.kind === 'teams-notice') {
    const token = await teamsToken(env, deps);
    if (!token) return;
    await sendToConversation(
      { serviceUrl: job.serviceUrl, conversationId: job.conversation, replyTo: job.replyTo, token },
      teamsMessage(teamsNotice(job.text)),
      deps.fetch,
    );
  }
}

export async function runChatJobs(env: Env, sql: store.ChatSql, deps: ChatJobDeps): Promise<void> {
  const install = store.readInstall(sql);
  for (const job of store.nextJobs(sql, CHAT_JOBS_A_TURN)) {
    const notice = job.kind === 'slack-notice' || job.kind === 'teams-notice';
    // Disconnected: nothing is answered (chat-apps.md "Disconnect forgets").
    if (!install && !notice) {
      store.doneJob(sql, job.id);
      continue;
    }
    try {
      const body = JSON.parse(job.body) as ChatJob;
      if (notice) await runNotice(env, deps, install, body);
      else if (!install) continue;
      else if (job.kind === 'slack-ask')
        await runSlackAsk(env, sql, deps, install, body as SlackAskJob);
      else if (job.kind === 'slack-unfurl')
        await runSlackUnfurl(env, sql, deps, install, body as SlackUnfurlJob);
      else if (job.kind === 'teams-ask')
        await runTeamsAsk(env, sql, deps, install, body as TeamsAskJob);
      store.doneJob(sql, job.id);
    } catch (error) {
      console.warn('[chat] job failed', {
        kind: job.kind,
        tries: job.tries + 1,
        error: String(error),
      });
      if (job.tries + 1 >= CHAT_JOB_TRIES) store.doneJob(sql, job.id);
      else store.retryJob(sql, job.id);
    }
  }
}
