'use client';

// A team page's Usage tab (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"). Its own module,
// loaded only with the team card (teams/page/TeamView.tsx), so the usage list, its app logos, the comparison rows and
// the hook that finds the team stay out of the Explorer's first load: the sidebar draws TeamPlan.tsx
// (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits").

import { proOn, useSubscription } from '@liveworkspace/subscription-ui';
import { UsageList } from '@liveworkspace/subscription-ui/usage-list';

/** The team as the subscription service has it (tier, seats, limits and usage), for its page's Usage tab: null with
 *  Pro off, until the service answers, or for a team it doesn't list yet. */
export function useTeamSubscription(teamId: string) {
  const load = useSubscription();
  if (!proOn() || load.status !== 'ready') return null;
  return load.me.teams.find((t) => t.teamId === teamId) ?? null;
}

/** A team page's Usage tab: its usage against its limits, the shared list Settings shows for a person. */
export function TeamUsage({ teamId }: { teamId: string }) {
  const team = useTeamSubscription(teamId);
  if (!team) return null;
  return (
    <section
      aria-label="Usage"
      data-team-usage={team.tier}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <p className="m-0 border-b border-slate-100 px-4 py-3 text-[13px] leading-normal text-slate-600 dark:border-slate-700/70 dark:text-slate-300">
        {team.tier === 'free'
          ? 'Everything in the team’s library counts toward these limits, shared by everyone in it.'
          : `Everything in the team’s library counts toward these limits: each member’s share, pooled across ${team.seats} seats.`}
      </p>
      <UsageList summary={team} />
    </section>
  );
}
