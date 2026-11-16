'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  FORUM_CATEGORIES,
  FORUM_SORTS,
  forumQueryParams,
  parseForumListQuery,
  type ForumCategory,
  type ForumSort,
} from '@liveworkspace/community';
import { Button, EmptyState, Select } from '@liveworkspace/ui';
import { LoadError } from '../shared/LoadError';
import { ForumIcon } from '../shared/icons';
import {
  getSearchSnapshot,
  getServerSearchSnapshot,
  replaceSearch,
  subscribeSearch,
} from '../lib/url-search';
import { SignedInAction } from './AskButton';
import type { ForumApi } from './forum-api';
import { ForumTopicRow, ForumTopicRowSkeleton } from './ForumTopicRow';
import type { ForumAccount } from './useForumAccount';
import { useForumTopics } from './useForumTopics';

const SKELETON_ROWS = 6;

// The Forum's list (liveworkspace/docs/specs/007-community/community.md "The Forum", "On the page"): the categories as
// chips (every category to start), the sort, then the topics in one panel, with Load More. The category and sort
// live in the address, as the gallery's filters do, so a filtered list can be shared and survives a reload.
export function ForumListView({
  api,
  account,
  onAsk,
}: {
  api: ForumApi;
  account: ForumAccount;
  /** Ask a Question, from the empty list. */
  onAsk: () => void;
}) {
  const search = useSyncExternalStore(subscribeSearch, getSearchSnapshot, getServerSearchSnapshot);
  const { category, sort } = parseForumListQuery(new URLSearchParams(search ?? ''));
  const list = useForumTopics(api, account, { category, sort });
  // One instant for every row's "3 hours ago", taken when the list first shows.
  const [now] = useState(() => Date.now());

  const choose = useCallback((next: { category?: ForumCategory | null; sort?: ForumSort }) => {
    const current = parseForumListQuery(new URLSearchParams(window.location.search));
    const query = forumQueryParams({ ...current, ...next, offset: 0 }).toString();
    replaceSearch(query ? `?${query}` : '');
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter by Category"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        >
          {[{ id: null, label: 'All Categories' }, ...FORUM_CATEGORIES].map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => choose({ category: c.id })}
                className={`h-8 shrink-0 cursor-pointer rounded-full px-3 text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  active
                    ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          Sort
          <Select
            value={sort}
            onChange={(e) => choose({ sort: e.target.value as ForumSort })}
            selectClassName="h-8 text-sm"
          >
            {FORUM_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <section aria-label="Topics" aria-busy={list.status === 'loading'}>
        <h2 className="sr-only">Topics</h2>
        {list.status === 'error' ? (
          <LoadError title="We couldn't load the Forum." onRetry={list.retry} />
        ) : list.status === 'ready' && list.topics.length === 0 ? (
          <EmptyState
            icon={<ForumIcon aria-hidden />}
            title={category || sort === 'unanswered' ? 'Nothing here yet.' : 'No questions yet.'}
            description={
              category || sort === 'unanswered'
                ? 'No questions match. Try another category, or ask your own.'
                : 'Be the first to ask.'
            }
          >
            <SignedInAction
              account={account}
              label="Ask a Question"
              signInLabel="Sign In to Ask"
              onClick={onAsk}
              size="md"
            />
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {list.status === 'loading'
                ? Array.from({ length: SKELETON_ROWS }, (_, i) => <ForumTopicRowSkeleton key={i} />)
                : list.topics.map((topic) => (
                    <ForumTopicRow key={topic.id} topic={topic} now={now} />
                  ))}
            </ul>
            {list.status === 'ready' && list.hasMore ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={list.loadMore}
                  busy={list.loadingMore}
                >
                  {list.loadingMore
                    ? 'Loading...'
                    : list.loadMoreFailed
                      ? 'Try Again'
                      : 'Load More'}
                </Button>
                {list.loadMoreFailed ? (
                  <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
                    We couldn&apos;t load more questions.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
