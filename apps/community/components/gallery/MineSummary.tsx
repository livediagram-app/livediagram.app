import type { CommunityMineTotals } from '@livediagram/api-schema';
import {
  CommunityHelpLink,
  CopyIcon,
  formatCommunityCount,
  communityPlural,
} from '@livediagram/ui';
import { HeartIcon, MineIcon } from '../shared/icons';

// My Shares' header (docs/specs/025-community/community.md "My Shares"): how popular your posts are
// altogether, over all of them whatever the search narrows to.
export function MineSummary({ totals }: { totals: CommunityMineTotals }) {
  const stats = [
    { icon: <MineIcon />, n: totals.posts, one: 'document shared', many: 'documents shared' },
    { icon: <HeartIcon />, n: totals.likes, one: 'like', many: 'likes' },
    { icon: <CopyIcon size={15} />, n: totals.copies, one: 'copy made', many: 'copies made' },
  ];
  return (
    <section
      aria-label="Your Shares"
      className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your Shares</h2>
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {stats.map((s) => (
          <div
            key={s.one}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
          >
            <span aria-hidden className="flex text-brand-600 dark:text-brand-300">
              {s.icon}
            </span>
            <dt className="sr-only">{s.many}</dt>
            <dd>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCommunityCount(s.n)}
              </span>{' '}
              {communityPlural(s.n, s.one, s.many)}
            </dd>
          </div>
        ))}
      </dl>
      <CommunityHelpLink article="sharing" className="sm:ml-auto">
        Managing Your Shares
      </CommunityHelpLink>
    </section>
  );
}
