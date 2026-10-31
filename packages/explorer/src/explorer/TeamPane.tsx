'use client';

// A team's view, at its root (liveplanner's TeamPane): the team card (teams/TeamCard.tsx), where the team is run in
// place, over the team's library, then the team's own feed (TeamActivity.tsx), closed until opened. A team the person is not in (gone, left, never joined) is a not-found card instead.

import type { ReactNode } from 'react';
import { Button } from '@liveworkspace/ui';
import { LIST_CARD } from '../ui/classes';
import { TeamCard, useTeamDetails } from '../teams/TeamCard';
import { useExplorer } from './context';
import { TeamActivity } from './TeamActivity';

export { initialsOf, teamHeadline } from '../teams/TeamCard';
export { memberName } from '../teams/rules';

export function TeamPage({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { teams, viewerId, helpHref, navigate } = useExplorer();
  const member = teams.some((t) => t.id === teamId);
  const [load, reload] = useTeamDetails(teamId);
  if (!member || load.state === 'gone') return <TeamNotFound />;
  return (
    <div className="flex flex-col gap-4">
      {load.state === 'found' ? (
        <TeamCard
          details={load.details}
          reload={reload}
          viewerId={viewerId}
          helpHref={helpHref?.({ kind: 'team', id: teamId })}
          onGone={() => navigate({ kind: 'all' })}
        />
      ) : load.state === 'loading' ? (
        <TeamMembersSkeleton />
      ) : null}
      {children}
      {/* Keyed on the team: another team's view starts its feed, and its open state, afresh. */}
      <TeamActivity key={teamId} teamId={teamId} />
    </div>
  );
}

function TeamMembersSkeleton() {
  return (
    <div className={LIST_CARD} aria-busy data-team-members-loading="">
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <span className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <span className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamNotFound() {
  const { navigate, words } = useExplorer();
  return (
    <div className="flex items-center justify-center px-6 py-16" data-team-not-found="">
      <div className="flex max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          404
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Team not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          This team doesn’t exist, or you’re not a member of it. Ask an admin for an invite, or head
          back to your own {words.lowerMany}.
        </p>
        <Button size="md" className="mt-6" onClick={() => navigate({ kind: 'all' })}>
          Back to your {words.lowerMany}
        </Button>
      </div>
    </div>
  );
}
