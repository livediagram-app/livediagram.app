'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FORUM_HOME_PATH, forumCategoryLabel, type ForumReply } from '@liveworkspace/community';
import { communityPlural } from '@liveworkspace/community-ui';
import { BackBar, Button, EmptyState, buttonClassName } from '@liveworkspace/ui';
import { useCommunitySite } from '../client';
import { LoadError } from '../shared/LoadError';
import { AnswerIcon, ForumIcon } from '../shared/icons';
import { ForumAppLogo } from './ForumAppLogo';
import { AnswerChip, CategoryPill, StateBadge } from './ForumBits';
import { forumErrorText, type ForumApi } from './forum-api';
import { ForumPostCard } from './ForumPostCard';
import { ForumSidebar } from './ForumSidebar';
import { ReplyComposer } from './ReplyComposer';
import type { ForumAccount } from './useForumAccount';
import { useForumTopic } from './useForumTopic';

// A topic (`/community/forum/topic?id=`; liveworkspace/docs/specs/007-community/community.md "The Forum", "On the
// page"): its title, category and app, the opening post, then the replies with the answer first, then Reply at the foot.
export function ForumTopicView({
  api,
  account,
  id,
}: {
  api: ForumApi;
  account: ForumAccount;
  id: string | null;
}) {
  const state = useForumTopic(api, account, id);
  const { telemetry } = useCommunitySite();
  const router = useRouter();
  // One instant for every "3 hours ago" on the page.
  const [now] = useState(() => Date.now());
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const ready = state.status === 'ready';
  useEffect(() => {
    if (ready) telemetry.forum.openedTopic();
  }, [ready, telemetry]);

  const replies = useMemo(() => {
    if (state.status !== 'ready') return [];
    const answer = state.replies.find((r) => r.id === state.topic.answerId);
    return answer ? [answer, ...state.replies.filter((r) => r !== answer)] : state.replies;
  }, [state]);

  useEffect(() => {
    if (state.status === 'ready') document.title = `${state.topic.title} · Community Forum`;
  }, [state]);

  if (state.status === 'loading') {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <span className="h-8 w-2/3 rounded-lg bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
        <span className="h-40 rounded-2xl bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800/70" />
        <span className="h-24 rounded-2xl bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800/70" />
      </div>
    );
  }
  if (state.status === 'error') {
    return <LoadError title="We couldn't load this topic." onRetry={state.retry} />;
  }
  if (state.status === 'gone') {
    return (
      <EmptyState
        icon={<ForumIcon aria-hidden />}
        title="This topic isn't here."
        description="It may have been deleted, or hidden after reports."
      >
        <Link href={FORUM_HOME_PATH} className={buttonClassName({ size: 'md' })}>
          Back to the Forum
        </Link>
      </EmptyState>
    );
  }

  const { topic } = state;
  // Only a Question has an answer to mark: other kinds of post are conversations.
  const canMark = topic.own && account.status === 'in' && topic.category === 'question';

  const mark = async (reply: ForumReply) => {
    if (account.status !== 'in' || marking) return;
    const next = topic.answerId === reply.id ? null : reply.id;
    setMarking(reply.id);
    setAnswerError(null);
    try {
      const token = await account.getToken();
      if (!token) throw new Error('signed out');
      state.setAnswer(await api.markAnswer(topic.id, next, token));
      if (next) telemetry.forum.markedAnswer();
    } catch (err) {
      console.warn('[forum] answer failed', err);
      setAnswerError(forumErrorText(err));
    } finally {
      setMarking(null);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:gap-14">
      <div className="flex min-w-0 flex-col gap-6">
        <BackBar
          label="All Posts"
          current={forumCategoryLabel(topic.category)}
          onClick={() => router.push(FORUM_HOME_PATH)}
          gap="none"
        />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryPill category={topic.category} />
            {topic.app ? <ForumAppLogo app={topic.app} /> : null}
            {topic.answerId ? <AnswerChip label="Answered" /> : null}
            {topic.own ? <StateBadge state={topic.state} /> : null}
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {topic.title}
          </h1>
        </div>

        <ForumPostCard
          api={api}
          account={account}
          post={topic}
          title={topic.title}
          now={now}
          onChanged={(post) => state.replacePost(post)}
          onDeleted={() => router.push(FORUM_HOME_PATH)}
        />

        <section aria-labelledby="forum-replies" className="flex flex-col gap-4">
          <h2 id="forum-replies" className="text-lg font-semibold text-slate-900 dark:text-white">
            {replies.length === 0
              ? 'No replies yet'
              : `${replies.length} ${communityPlural(replies.length, 'Reply', 'Replies')}`}
          </h2>
          {answerError ? (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {answerError}
            </p>
          ) : null}
          {replies.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {replies.map((reply) => {
                const isAnswer = reply.id === topic.answerId;
                return (
                  <li key={reply.id}>
                    <ForumPostCard
                      api={api}
                      account={account}
                      post={reply}
                      now={now}
                      className={
                        isAnswer
                          ? 'border-emerald-300 ring-1 ring-emerald-300 dark:border-emerald-500/50 dark:ring-emerald-500/50'
                          : ''
                      }
                      badge={isAnswer ? <AnswerChip label="Answer" /> : null}
                      answerAction={
                        canMark && reply.state === 'listed' && topic.state === 'listed' ? (
                          <Button
                            variant={isAnswer ? 'ghost' : 'secondary'}
                            size="sm"
                            onClick={() => void mark(reply)}
                            busy={marking === reply.id}
                            aria-pressed={isAnswer}
                          >
                            <AnswerIcon aria-hidden />
                            {isAnswer ? 'Unmark Answer' : 'Mark as Answer'}
                          </Button>
                        ) : null
                      }
                      onChanged={(post) => state.replacePost(post)}
                      onDeleted={() => state.dropReply(reply.id)}
                    />
                  </li>
                );
              })}
            </ol>
          ) : null}
          {topic.state === 'listed' ? (
            <ReplyComposer
              api={api}
              account={account}
              topicId={topic.id}
              onPosted={state.addReply}
            />
          ) : null}
        </section>
      </div>
      <ForumSidebar api={api} topicId={topic.id} category={topic.category} />
    </div>
  );
}
