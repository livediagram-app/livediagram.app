'use client';

// The card panel's Pull Requests (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards"): every
// linked pull request no field holds (one whose title or body names the card), each with its mark, short name, state,
// title and Open on GitHub. Nothing while there are none.
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideExternalLink } from '@liveworkspace/icons/lucide';
import { pullRequestText, pullRequestUrl, type Item, type ItemTypeDef } from '@liveplanner/items';
import { githubHref } from './PullRequestField';
import { useCardPullRequests } from './pull-request-store';
import { PullRequestChip } from './PullRequestPill';

const OpenIcon = lucideGlyph(lucideExternalLink, 14);

export function CardPullRequests({ item, type }: { item: Item; type: ItemTypeDef }) {
  const prs = useCardPullRequests(item, type).filter((p) => !p.field && p.status);
  if (prs.length === 0) return null;
  return (
    <section
      data-card-pull-requests=""
      className="mt-3 border-t border-slate-200/70 pt-3 dark:border-slate-700/60"
    >
      <h4 className="mb-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
        Pull Requests
      </h4>
      <ul className="flex flex-col gap-2">
        {prs.map(({ ref, status }) => {
          const name = pullRequestText(ref);
          const href = githubHref(pullRequestUrl(ref));
          return (
            <li key={name} className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
                    {name}
                  </span>
                  <PullRequestChip status={status!} />
                </div>
                {status!.title ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
                    {status!.title}
                  </p>
                ) : null}
              </div>
              {href ? (
                <Tooltip label="Open on GitHub">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${name} on GitHub (opens in a new tab)`}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    <OpenIcon />
                  </a>
                </Tooltip>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
