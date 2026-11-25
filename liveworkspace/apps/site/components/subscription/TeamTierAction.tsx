'use client';

import { lazy, Suspense, useId, useState } from 'react';
import { seatsFor, type MeResponse, type OwnerScope } from '@liveworkspace/subscription';
import {
  initialTeam,
  teamTotal,
  upgradeAction,
  usePrices,
  useRefreshSubscription,
  useUpgrade,
} from '@liveworkspace/subscription-ui';
import { Button, Select, Spinner } from '@liveworkspace/ui';

// The team dialog's code, fetched only when Create a Team is pressed.
const PricingNewTeam = lazy(() => import('./PricingNewTeam'));

/**
 * Pro for Teams on the pricing page (subscription.md "The pricing page"): the team, what it would pay and the one
 * button for it, in the card itself. The comparison is already on the page, so nothing opens the upgrade dialog.
 * Create a Team makes one here, with the Explorer's own dialog, and picks it, ready to subscribe.
 */
export function TeamTierAction({
  me,
  busy,
  leave,
}: {
  me: MeResponse | null;
  busy: OwnerScope | null;
  leave: (owner: OwnerScope, how: 'checkout' | 'portal') => void;
}) {
  const prices = usePrices();
  const upgrade = useUpgrade();
  const refresh = useRefreshSubscription();
  const [creating, setCreating] = useState(false);
  const fieldId = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const teams = me?.teams ?? [];
  const team = teams.find((candidate) => candidate.teamId === picked) ?? initialTeam(teams, null);
  const action = upgradeAction(me, false, 'team', team);

  const wide = 'min-h-11 w-full';
  const newTeam = creating ? (
    <Suspense fallback={null}>
      <PricingNewTeam
        onClose={() => setCreating(false)}
        onMade={async (made) => {
          setPicked(made.id);
          await refresh();
        }}
      />
    </Suspense>
  ) : null;
  const create = (
    <Button
      variant={me && !team ? 'secondary' : 'none'}
      size="md"
      className={
        me && !team
          ? wide
          : 'cursor-pointer self-center rounded-sm text-xs font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:text-brand-300'
      }
      aria-haspopup="dialog"
      disabled={busy !== null}
      onClick={() => setCreating(true)}
    >
      {me && !team ? 'Create a Team' : 'Or Create a New Team'}
    </Button>
  );

  if (me && !team) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pro for Teams covers a team’s library. Create one here, then subscribe it.
        </p>
        {create}
        {newTeam}
      </div>
    );
  }

  const cost =
    team && team.tier === 'free' && prices
      ? `${team.name}: ${team.members} ${team.members === 1 ? 'member' : 'members'}, so ${seatsFor(team.members)} seats, ${teamTotal(prices, team.members)} a month`
      : null;
  const press = () => {
    if (action.kind === 'checkout' || action.kind === 'portal') leave(action.owner, action.kind);
    else if (action.kind === 'ask_admin') upgrade.openAskAdmin({ owner: action.owner });
  };
  const pressable =
    action.kind === 'checkout' || action.kind === 'portal' || action.kind === 'ask_admin';

  return (
    <div className="flex flex-col gap-2">
      {teams.length > 1 ? (
        <span className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
          <label htmlFor={fieldId} className="shrink-0">
            Team
          </label>
          <Select
            id={fieldId}
            value={team?.teamId ?? ''}
            onChange={(event) => setPicked(event.target.value)}
            className="min-w-0 flex-1"
          >
            {teams.map((candidate) => (
              <option key={candidate.teamId} value={candidate.teamId}>
                {candidate.role === 'admin' ? candidate.name : `${candidate.name} (member)`}
              </option>
            ))}
          </Select>
        </span>
      ) : null}
      {cost ? (
        <p data-team-cost className="text-xs text-slate-500 dark:text-slate-400">
          {cost}
        </p>
      ) : action.kind === 'none' && me ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{action.reason}</p>
      ) : null}
      <Button
        variant="secondary"
        size="md"
        className={wide}
        disabled={!pressable || busy !== null}
        aria-haspopup={action.kind === 'ask_admin' ? 'dialog' : undefined}
        onClick={press}
      >
        {team && busy === team.owner ? <Spinner /> : null}
        {action.label}
      </Button>
      {me ? create : null}
      {newTeam}
    </div>
  );
}
