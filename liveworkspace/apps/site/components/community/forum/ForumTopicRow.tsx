import Link from 'next/link';
import { forumTopicPath, type ForumTopicSummary } from '@liveworkspace/community';
import { communityPlural } from '@liveworkspace/community-ui';
import { ReplyIcon } from '../shared/icons';
import { ForumAppLogo } from './ForumAppLogo';
import { AnswerChip, Byline, CategoryPill, StateBadge } from './ForumBits';

// One topic in the Forum's list (liveworkspace/docs/specs/007-community/community.md "On the page"): its title (the
// link), a line of it, the category, the app's logo (none for Any App), who posted it and when; on the right how many replies it has, and
// Answered when it has one. The author's own topic nobody else sees yet carries its mark.
export function ForumTopicRow({ topic, now }: { topic: ForumTopicSummary; now: number }) {
  return (
    <li className="group relative flex gap-4 px-4 py-4 transition-colors duration-micro hover:bg-slate-50 sm:px-5 dark:hover:bg-slate-800/40">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-base font-semibold text-slate-900 dark:text-white">
            {/* The whole row is the link's target, its text the title. */}
            <Link
              href={forumTopicPath(topic.id)}
              className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 group-hover:text-brand-700 dark:group-hover:text-brand-300"
            >
              {topic.title}
            </Link>
          </h3>
          <StateBadge state={topic.state} />
        </div>
        {topic.excerpt ? (
          <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-300">{topic.excerpt}</p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <CategoryPill category={topic.category} />
          {topic.app ? <ForumAppLogo app={topic.app} /> : null}
          <Byline author={topic.author} createdAt={topic.createdAt} now={now} size={20} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 text-sm">
        <span
          className="inline-flex items-center gap-1.5 font-medium tabular-nums text-slate-600 dark:text-slate-300"
          aria-label={`${topic.replyCount} ${communityPlural(topic.replyCount, 'reply', 'replies')}`}
        >
          <ReplyIcon aria-hidden />
          {topic.replyCount}
        </span>
        {topic.answered ? <AnswerChip label="Answered" /> : null}
      </div>
    </li>
  );
}

/** A row's shape while the list loads, so nothing moves when it arrives. */
export function ForumTopicRowSkeleton() {
  return (
    <li aria-hidden className="flex gap-4 px-4 py-4 sm:px-5">
      <div className="flex flex-1 flex-col gap-2.5">
        <span className="h-4 w-3/5 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
        <span className="h-3 w-4/5 rounded bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800/70" />
        <span className="h-3 w-2/5 rounded bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800/70" />
      </div>
      <span className="h-4 w-8 rounded bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800/70" />
    </li>
  );
}
