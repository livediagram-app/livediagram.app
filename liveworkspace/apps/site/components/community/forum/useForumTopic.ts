'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ForumPost, ForumReply, ForumTopic } from '@liveworkspace/community';
import type { ForumApi } from './forum-api';
import type { ForumAccount } from './useForumAccount';

export type ForumTopicState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'gone' }
  | {
      status: 'ready';
      topic: ForumTopic;
      replies: ForumReply[];
      /** Puts a post back as the service answered it (an edit, its reactions). */
      replacePost: (post: ForumPost) => void;
      /** Adds the reader's new reply at the foot. */
      addReply: (reply: ForumReply) => void;
      /** Takes a deleted reply out (a deleted topic leaves the page instead). */
      dropReply: (id: string) => void;
      setAnswer: (answerId: string | null) => void;
    };

// One topic and its replies (liveworkspace/docs/specs/007-community/community.md "The Forum", "Topics and replies"),
// read once the page knows who is reading: the author's own waiting topic, and which reactions the reader gave, need
// their token. What the reader then does changes it in place from the service's answers, without reading it again.
export function useForumTopic(
  api: ForumApi,
  account: ForumAccount,
  id: string | null,
): ForumTopicState {
  type Data = { topic: ForumTopic; replies: ForumReply[] };
  // Each answer carries the topic (and attempt) it is for: another is still loading.
  const [result, setResult] = useState<{
    key: string;
    status: 'ready' | 'error' | 'gone';
    data: Data | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const known = account.status !== 'checking';
  const getToken = account.status === 'in' ? account.getToken : null;
  const key = `${id ?? ''}|${attempt}|${account.status}`;

  useEffect(() => {
    if (!known || !id) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const token = getToken ? await getToken() : null;
        const found = await api.readTopic(id, token, controller.signal);
        if (controller.signal.aborted) return;
        setResult({ key, status: found ? 'ready' : 'gone', data: found });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('[forum] topic failed', err);
        setResult({ key, status: 'error', data: null });
      }
    })();
    return () => controller.abort();
  }, [api, known, getToken, id, key]);

  const setData = useCallback((change: (before: Data) => Data) => {
    setResult((before) => (before?.data ? { ...before, data: change(before.data) } : before));
  }, []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const replacePost = useCallback(
    (post: ForumPost) => {
      setData((before) => {
        // An edit's answer never carries the marked answer (only the topic read and Mark as Answer set it), so the
        // topic keeps the one it has.
        if (post.id === before.topic.id)
          return {
            ...before,
            topic: { ...before.topic, ...post, topicId: null, answerId: before.topic.answerId },
          };
        return {
          ...before,
          replies: before.replies.map((r) =>
            r.id === post.id ? { ...r, ...post, topicId: r.topicId } : r,
          ),
        };
      });
    },
    [setData],
  );
  const addReply = useCallback(
    (reply: ForumReply) => {
      setData((before) => ({ ...before, replies: [...before.replies, reply] }));
    },
    [setData],
  );
  const dropReply = useCallback(
    (replyId: string) =>
      setData((before) => ({
        topic:
          before.topic.answerId === replyId ? { ...before.topic, answerId: null } : before.topic,
        replies: before.replies.filter((r) => r.id !== replyId),
      })),
    [setData],
  );
  const setAnswer = useCallback(
    (answerId: string | null) => {
      setData((before) => ({ ...before, topic: { ...before.topic, answerId } }));
    },
    [setData],
  );

  if (known && !id) return { status: 'gone' };
  const current = result?.key === key ? result : null;
  if (!current) return { status: 'loading' };
  if (current.status === 'error') return { status: 'error', retry };
  if (current.status === 'gone' || !current.data) return { status: 'gone' };
  return {
    status: 'ready',
    topic: current.data.topic,
    replies: current.data.replies,
    replacePost,
    addReply,
    dropReply,
    setAnswer,
  };
}
