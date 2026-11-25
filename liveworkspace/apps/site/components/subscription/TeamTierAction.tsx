'use client';

import { useId, useState } from 'react';
import { seatsFor, type MeResponse, type OwnerScope } from '@liveworkspace/subscription';
import {
  initialTeam,
  teamTotal,
  upgradeAction,
  usePrices,
  useUpgrade,
} from '@liveworkspace/subscription-ui';
import { Button, buttonClassName, ButtonContent, Select, Spinner } from '@liveworkspace/ui';

/**
 * Pro for Teams on the pricing page (subscription.md "The pricing page"): the team, what it would pay and the one
 * button for it, in the card itself. The comparison is already on the page, so nothing opens the upgrade dialog.
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
  const fieldId = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const teams = me?.teams ?? [];
  const team = teams.find((candidate) => candidate.teamId === picked) ?? initialTeam(teams, null);
  const action = upgradeAction(me, false, 'team', team);

  const wide = 'min-h-11 w-full';
  if (me && !team) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pro for Teams covers a team’s library. Create a team first, then subscribe it here.
        </p>
        <a
          href="/explorer"
          className={buttonClassName({ variant: 'secondary', size: 'md', className: wide })}
        >
          <ButtonContent>Create a Team</ButtonContent>
        </a>
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
    </div>
  );
}
