import { readErrorCode } from '@liveworkspace/api-schema/http-errors';
import {
  COMMUNITY_KEY_HEADER,
  FORUM_API_PATH,
  forumQueryParams,
  type CommunityReportInput,
  type ForumAuthor,
  type ForumApp,
  type ForumCategory,
  type ForumListQuery,
  type ForumPost,
  type ForumReaction,
  type ForumReactions,
  type ForumReply,
  type ForumTopic,
  type ForumTopicResponse,
  type ForumTopicsResponse,
} from '@liveworkspace/community';
import { CommunityApiError, communityApiBase } from '../lib/api';
import { getCommunityKey } from '../lib/community-key';

// The Forum's api client (liveworkspace/docs/specs/007-community/community.md "Forum routes"): the Community service's
// `/forum`, one for every app, so no request names an app. A read carries the reader's token when they are signed in
// (their own waiting posts, which reactions they gave); every write but a report carries it always. A report carries
// the browser's community key, as a gallery report does.

/** Where the service is, and where this browser's community key is kept. */
export type ForumApiSite = { communityApi?: string; keyStorage: string };

/** The page's account token, or null signed out. */
export type TokenSource = () => Promise<string | null>;

export type ForumApi = {
  listTopics: (
    query: ForumListQuery,
    token: string | null,
    signal?: AbortSignal,
  ) => Promise<ForumTopicsResponse>;
  /** A topic and its replies; null when it isn't there for this reader. */
  readTopic: (
    id: string,
    token: string | null,
    signal?: AbortSignal,
  ) => Promise<ForumTopicResponse | null>;
  createTopic: (
    input: {
      category: ForumCategory;
      app: ForumApp;
      title: string;
      body: string;
      author: ForumAuthor;
    },
    token: string,
  ) => Promise<ForumTopic>;
  createReply: (
    topicId: string,
    input: { body: string; author: ForumAuthor },
    token: string,
  ) => Promise<ForumReply>;
  editPost: (
    id: string,
    input: { title?: string; body: string; author: ForumAuthor },
    token: string,
  ) => Promise<ForumPost>;
  deletePost: (id: string, token: string) => Promise<void>;
  markAnswer: (topicId: string, replyId: string | null, token: string) => Promise<string | null>;
  react: (
    id: string,
    reaction: ForumReaction,
    on: boolean,
    token: string,
  ) => Promise<ForumReactions>;
  reportPost: (id: string, input: CommunityReportInput) => Promise<void>;
};

export function createForumApi(site: ForumApiSite): ForumApi {
  const base = () => `${communityApiBase(site.communityApi)}${FORUM_API_PATH}`;

  async function request(
    path: string,
    init: RequestInit & { token?: string | null } = {},
  ): Promise<Response> {
    const { token, ...rest } = init;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(rest.headers as Record<string, string>),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (rest.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base()}${path}`, { ...rest, headers });
    if (!res.ok) throw new CommunityApiError(res.status, await readErrorCode(res));
    return res;
  }

  const send = async <T>(path: string, method: string, token: string, body?: unknown): Promise<T> =>
    (await (
      await request(path, {
        method,
        token,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    ).json()) as T;

  const post = (id: string) => `/posts/${encodeURIComponent(id)}`;
  const topic = (id: string) => `/topics/${encodeURIComponent(id)}`;

  return {
    listTopics: async (query, token, signal) => {
      const search = forumQueryParams(query).toString();
      return (await (
        await request(`/topics${search ? `?${search}` : ''}`, { token, signal })
      ).json()) as ForumTopicsResponse;
    },
    readTopic: async (id, token, signal) => {
      try {
        return (await (await request(topic(id), { token, signal })).json()) as ForumTopicResponse;
      } catch (err) {
        if (err instanceof CommunityApiError && err.status === 404) return null;
        throw err;
      }
    },
    createTopic: async (input, token) =>
      (await send<{ topic: ForumTopic }>('/topics', 'POST', token, input)).topic,
    createReply: async (topicId, input, token) =>
      (await send<{ reply: ForumReply }>(`${topic(topicId)}/replies`, 'POST', token, input)).reply,
    editPost: async (id, input, token) =>
      (await send<{ post: ForumPost }>(post(id), 'PATCH', token, input)).post,
    deletePost: async (id, token) => {
      await request(post(id), { method: 'DELETE', token });
    },
    markAnswer: async (topicId, replyId, token) =>
      (
        await send<{ answerId: string | null }>(
          `${topic(topicId)}/answer`,
          replyId ? 'PUT' : 'DELETE',
          token,
          replyId ? { reply: replyId } : undefined,
        )
      ).answerId,
    react: async (id, reaction, on, token) =>
      (
        await send<{ reactions: ForumReactions }>(
          `${post(id)}/reactions/${reaction}`,
          on ? 'PUT' : 'DELETE',
          token,
        )
      ).reactions,
    reportPost: async (id, input) => {
      const key = getCommunityKey(site.keyStorage);
      await request(`${post(id)}/report`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: key ? { [COMMUNITY_KEY_HEADER]: key } : {},
      });
    },
  };
}

/** What a failed write says, in words: a known refusal, else the connection. */
export function forumErrorText(err: unknown): string {
  const code = err instanceof CommunityApiError ? err.code : null;
  switch (code) {
    case 'rate_limited':
      return "You've posted a lot in the last hour. Please wait a little, then try again.";
    case 'sign_in_required':
      return 'Your sign-in ran out. Sign in again, then try once more.';
    case 'topic_full':
      return 'This topic has as many replies as it can take.';
    case 'post_hidden':
      return 'This post was hidden after reports, so it can no longer be changed.';
    case 'invalid_title':
      return 'Give your post a title of 5 to 120 characters.';
    case 'invalid_category':
    case 'invalid_app':
      return 'Pick a category and an app from the lists, then try again.';
    case 'invalid_body':
      return 'That is too short or too long to post.';
    case 'not_found':
      return 'This is no longer here.';
    default:
      return "We couldn't save that. Check your connection, then try again.";
  }
}
