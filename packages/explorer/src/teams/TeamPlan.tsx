'use client';

// The team's plan on its page (liveworkspace/docs/specs/019-subscription/subscription.md "A team's page in the
// Explorer"): the tier, and the one action whoever is looking may take, where the team is run. It loads with the team
// card, and is nothing with Pro off, without a subscription provider, or until the service has answered.

import { useState } from 'react';
import { TIER_NAMES, type OwnerScope } from '@liveworkspace/subscription';
import {
  billingErrorMessage,
  ProBadge,
  proOn,
  seatsCatchingUp,
  useBilling,
  useSubscription,
  useUpgrade,
} from '@liveworkspace/subscription-ui';
import { Button, Spinner } from '@liveworkspace/ui';

/** The team's tier, for its page's header pill ("Free Plan", "Pro"): null with Pro off or until the service answers. */
export function useTeamTier(teamId: string): string | null {
  const load = useSubscription();
  if (!proOn() || load.status !== 'ready') return null;
  const team = load.me.teams.find((t) => t.teamId === teamId);
  return team ? TIER_NAMES[team.tier] : null;
}

/** Whether a space is on a paid tier, for the Pro badge after its name: My Work (`null`) on the person's own Pro, a
 *  team on Pro for Teams. False with Pro off, until the service answers, or for a team it doesn't list yet. */
export function useSpacePro(teamId: string | null): boolean {
  const load = useSubscription();
  if (!proOn() || load.status !== 'ready') return false;
  if (teamId === null) return load.me.personal.tier !== 'free';
  const team = load.me.teams.find((t) => t.teamId === teamId);
  return !!team && team.tier !== 'free';
}

/** The Pro badge after a paid space's name (a team's page header, the sidebar, Home's Spaces); nothing otherwise. */
export function SpaceProBadge({
  teamId,
  size = 'sm',
}: {
  teamId: string | null;
  size?: 'sm' | 'md';
}) {
  return useSpacePro(teamId) ? (
    <ProBadge form="solid" size={size} label="Pro" className="shrink-0" />
  ) : null;
}

/** `card` is the People tab's side card (a title over the tier, its line and its action); `row` the panel's band. */
export function TeamPlan({ teamId, look = 'row' }: { teamId: string; look?: 'row' | 'card' }) {
  const load = useSubscription();
  const upgrade = useUpgrade();
  const billing = useBilling();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!proOn() || load.status !== 'ready') return null;
  const team = load.me.teams.find((t) => t.teamId === teamId);
  if (!team) return null;
  const owner = `t:${teamId}` as OwnerScope;
  const free = team.tier === 'free';
  const admin = team.role === 'admin';
  const portal = () => {
    if (!billing) return;
    setOpening(true);
    setError(null);
    billing.portal(owner).catch((failure: unknown) => {
      setOpening(false);
      setError(billingErrorMessage(failure));
    });
  };
  const action = free ? (
    admin ? (
      <Button size="sm" onClick={() => upgrade.openUpgrade({ owner })}>
        Upgrade Team
      </Button>
    ) : (
      <Button variant="secondary" size="sm" onClick={() => upgrade.openAskAdmin({ owner })}>
        Ask an Admin
      </Button>
    )
  ) : admin && billing ? (
    <Button variant="secondary" size="sm" busy={opening} onClick={portal}>
      {opening ? <Spinner /> : null}
      Manage Billing
    </Button>
  ) : null;
  if (look === 'card') {
    return (
      <section
        aria-labelledby="team-plan"
        data-team-plan={team.tier}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="team-plan"
            className="m-0 text-[15px] font-semibold text-slate-900 dark:text-slate-100"
          >
            Plan
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {free ? null : <ProBadge form="solid" size="sm" />}
            {TIER_NAMES[team.tier]}
            {free ? null : ` · ${team.seats} ${team.seats === 1 ? 'seat' : 'seats'}`}
          </span>
        </div>
        {seatsCatchingUp(team) ? (
          <p className="m-0 text-[13px] leading-normal text-slate-600 dark:text-slate-300">
            {seatsCatchingUp(team)}.
          </p>
        ) : null}
        {free ? (
          <p className="m-0 text-[13px] leading-normal text-slate-600 dark:text-slate-300">
            Pro for Teams raises the team’s limits.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="m-0 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {action ? <div className="flex [&>*]:w-full">{action}</div> : null}
      </section>
    );
  }
  return (
    <div
      data-team-plan={team.tier}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
          {free ? null : <ProBadge form="solid" size="sm" />}
          <span>
            {TIER_NAMES[team.tier]}
            {free ? ' Plan' : ` · ${team.seats} ${team.seats === 1 ? 'seat' : 'seats'}`}
          </span>
        </p>
        {free ? (
          <p className="text-xs leading-normal text-slate-500 dark:text-slate-400">
            Pro for Teams raises the team’s limits.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
