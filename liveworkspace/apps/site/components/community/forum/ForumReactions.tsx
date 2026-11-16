'use client';

import { useState } from 'react';
import {
  FORUM_REACTIONS,
  type ForumPost,
  type ForumReaction,
  type ForumReactions as Reactions,
} from '@liveworkspace/community';
import { Tooltip } from '@liveworkspace/ui';
import { useCommunitySite } from '../client';
import { CelebrateIcon, HeartIcon, HelpfulIcon } from '../shared/icons';
import { forumErrorText, type ForumApi } from './forum-api';
import type { ForumAccount } from './useForumAccount';

const ICONS = { helpful: HelpfulIcon, thanks: HeartIcon, celebrate: CelebrateIcon } as const;

// A post's reactions (liveworkspace/docs/specs/007-community/community.md "The Forum", "Reactions"): Helpful, Thanks
// and Celebrate as toggle chips with their counts. Signed in, a press gives or takes back the reader's own at once and
// settles on the service's count; signed out, each shows its count alone. A post nobody else sees yet (the author's
// waiting one) shows none.
export function ForumReactions({
  api,
  account,
  post,
  onChange,
}: {
  api: ForumApi;
  account: ForumAccount;
  post: Pick<ForumPost, 'id' | 'state' | 'reactions'>;
  onChange: (reactions: Reactions) => void;
}) {
  const { telemetry } = useCommunitySite();
  const [busy, setBusy] = useState<ForumReaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = post.state === 'listed';
  const canReact = account.status === 'in';

  const toggle = async (reaction: ForumReaction) => {
    if (account.status !== 'in' || busy) return;
    const on = !post.reactions.mine.includes(reaction);
    const before = post.reactions;
    // At once, then the service's answer.
    onChange({
      counts: {
        ...before.counts,
        [reaction]: Math.max(0, before.counts[reaction] + (on ? 1 : -1)),
      },
      mine: on ? [...before.mine, reaction] : before.mine.filter((r) => r !== reaction),
    });
    setBusy(reaction);
    setError(null);
    try {
      const token = await account.getToken();
      if (!token) throw new Error('signed out');
      onChange(await api.react(post.id, reaction, on, token));
      if (on) telemetry.forum.reacted(reaction);
    } catch (err) {
      console.warn('[forum] reaction failed', err);
      onChange(before);
      setError(forumErrorText(err));
    } finally {
      setBusy(null);
    }
  };

  if (!live) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FORUM_REACTIONS.map(({ id, label }) => {
        const Icon = ICONS[id];
        const count = post.reactions.counts[id];
        const mine = post.reactions.mine.includes(id);
        const tone = mine
          ? 'bg-brand-50 text-brand-800 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/50'
          : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700';
        const shape = `inline-flex h-8 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${tone}`;
        // Signed out, or on a post nobody else sees: the count alone, read as such.
        if (!canReact) {
          return (
            <span key={id} role="img" aria-label={`${label}: ${count}`} className={shape}>
              <Icon aria-hidden />
              <span aria-hidden>{count}</span>
            </span>
          );
        }
        const name = mine ? `Take Back ${label}` : label;
        return (
          <Tooltip key={id} label={name}>
            <button
              type="button"
              aria-pressed={mine}
              aria-label={`${name}, ${count}`}
              onClick={() => void toggle(id)}
              className={`${shape} cursor-pointer transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-95 ${
                mine
                  ? 'hover:bg-brand-100 dark:hover:bg-brand-500/25'
                  : 'hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <Icon aria-hidden />
              <span aria-hidden>{count}</span>
            </button>
          </Tooltip>
        );
      })}
      {error ? (
        <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}
