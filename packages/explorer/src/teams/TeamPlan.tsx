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
  useBilling,
  useSubscription,
  useUpgrade,
} from '@liveworkspace/subscription-ui';
import { Button, Spinner } from '@liveworkspace/ui';

export function TeamPlan({ teamId }: { teamId: string }) {
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
