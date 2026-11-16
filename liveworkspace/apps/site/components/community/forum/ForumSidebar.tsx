'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FORUM_CATEGORIES,
  FORUM_HOME_PATH,
  forumQueryParams,
  forumTopicPath,
  type ForumCategory,
  type ForumTopicSummary,
} from '@liveworkspace/community';
import { communityPlural } from '@liveworkspace/community-ui';
import { ChevronRightIcon } from '@liveworkspace/ui';
import { PopularIcon, ReplyIcon } from '../shared/icons';
import { FORUM_CATEGORY_LOOK } from './categories';
import type { ForumApi } from './forum-api';
import { ForumAppLogo } from './ForumAppLogo';

// Beside a topic (liveworkspace/docs/specs/007-community/community.md "The Forum", "On the page"): Popular Posts (the
// Forum's Popular sort, this topic left out) and every category to browse, the topic's own marked. A column of its
// own from `lg` up, sticky under the header; under the topic on narrower screens.

const POPULAR_SHOWN = 5;
const CARD =
  'rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70';
const CARD_HEAD = 'flex items-center justify-between gap-3 px-3 pb-2 pt-3';
const CARD_TITLE =
  'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

const hrefOf = (category: ForumCategory | null, sort?: 'popular') => {
  const query = forumQueryParams({
    category,
    app: null,
    sort: sort ?? 'active',
    offset: 0,
  }).toString();
  return query ? `${FORUM_HOME_PATH}?${query}` : FORUM_HOME_PATH;
};

export function ForumSidebar({
  api,
  topicId,
  category,
}: {
  api: ForumApi;
  topicId: string;
  category: ForumCategory;
}) {
  return (
    <aside aria-label="More from the Forum" className="flex flex-col gap-6 lg:sticky lg:top-24">
      <PopularPosts api={api} topicId={topicId} />
      <BrowseCategories current={category} />
    </aside>
  );
}

type Popular =
  { status: 'loading' } | { status: 'ready'; topics: ForumTopicSummary[] } | { status: 'error' };

function PopularPosts({ api, topicId }: { api: ForumApi; topicId: string }) {
  const [state, setState] = useState<Popular>({ status: 'loading' });
  useEffect(() => {
    const abort = new AbortController();
    // Anonymous, so the edge's cached Popular list serves every reader.
    api
      .listTopics({ category: null, app: null, sort: 'popular', offset: 0 }, null, abort.signal)
      .then((page) => setState({ status: 'ready', topics: page.topics }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        console.warn('[forum] popular failed', err);
        setState({ status: 'error' });
      });
    return () => abort.abort();
  }, [api]);

  // A sidebar that can't load has nothing to say: the topic is what the reader came for.
  if (state.status === 'error') return null;
  const topics =
    state.status === 'ready'
      ? state.topics.filter((t) => t.id !== topicId).slice(0, POPULAR_SHOWN)
      : [];
  if (state.status === 'ready' && topics.length === 0) return null;

  return (
    <section aria-labelledby="forum-popular" className={CARD}>
      <div className={CARD_HEAD}>
        <h2 id="forum-popular" className={CARD_TITLE}>
          <PopularIcon size={14} aria-hidden className="text-orange-500 dark:text-orange-400" />
          Popular Posts
        </h2>
        <Link
          href={hrefOf(null, 'popular')}
          className="rounded text-xs font-semibold text-brand-700 transition-colors duration-micro hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
        >
          See All
        </Link>
      </div>
      <ol className="flex flex-col">
        {state.status === 'loading'
          ? Array.from({ length: 3 }, (_, i) => <PopularSkeleton key={i} />)
          : topics.map((topic, i) => <PopularRow key={topic.id} topic={topic} rank={i + 1} />)}
      </ol>
    </section>
  );
}

function PopularRow({ topic, rank }: { topic: ForumTopicSummary; rank: number }) {
  const { Icon, tile } = FORUM_CATEGORY_LOOK[topic.category];
  const label = FORUM_CATEGORIES.find((c) => c.id === topic.category)?.label;
  return (
    <li>
      <Link
        href={forumTopicPath(topic.id)}
        className="group flex gap-3 rounded-xl p-3 transition-colors duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 dark:hover:bg-slate-800/70"
      >
        <span
          aria-hidden
          className={`mt-0.5 w-5 shrink-0 text-sm font-bold tabular-nums ${
            rank <= 3 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-600'
          }`}
        >
          {rank}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors duration-micro group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
            {topic.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded ring-1 ring-inset ${tile}`}
              >
                <Icon size={10} aria-hidden />
              </span>
              {label}
            </span>
            {topic.app ? <ForumAppLogo app={topic.app} /> : null}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <ReplyIcon size={12} aria-hidden />
              {topic.replyCount} {communityPlural(topic.replyCount, 'reply', 'replies')}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function PopularSkeleton() {
  return (
    <li aria-hidden className="flex gap-3 p-3">
      <span className="mt-0.5 h-4 w-5 shrink-0 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      <span className="flex flex-1 flex-col gap-2">
        <span className="h-4 w-11/12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <span className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </span>
    </li>
  );
}

function BrowseCategories({ current }: { current: ForumCategory }) {
  return (
    <nav aria-labelledby="forum-categories" className={CARD}>
      <div className={CARD_HEAD}>
        <h2 id="forum-categories" className={CARD_TITLE}>
          Browse Categories
        </h2>
      </div>
      <ul className="flex flex-col">
        {FORUM_CATEGORIES.map((c) => {
          const { Icon, blurb, tile } = FORUM_CATEGORY_LOOK[c.id];
          const here = c.id === current;
          return (
            <li key={c.id}>
              <Link
                href={hrefOf(c.id)}
                aria-current={here ? 'true' : undefined}
                className={`group flex items-center gap-3 rounded-xl p-3 transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 ${
                  here
                    ? 'bg-brand-50/70 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tile}`}
                >
                  <Icon size={16} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {c.label}
                  </span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {blurb}
                  </span>
                </span>
                <ChevronRightIcon
                  size={14}
                  aria-hidden
                  className="shrink-0 text-slate-300 transition-transform duration-micro group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
