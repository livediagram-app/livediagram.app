'use client';

import type { CSSProperties } from 'react';
import { avatarFill, initials } from '@liveworkspace/account-menu/initials';
import { lucideUsers } from '@liveworkspace/icons/lucide';
import type { TeamSubscription } from '@liveworkspace/subscription';
import { ProBadge, useSubscription, useUpgrade } from '@liveworkspace/subscription-ui';
import { Button, CompactEmptyState, lucideGlyph, Spinner } from '@liveworkspace/ui';
import { SETTINGS_CARD_SLOT } from '../../SettingsGroup';
import { ErrorNote } from '../error-note';
import { askedLine, requestLine, requestsLine, teamLine } from './copy';
import { CellFallback, CellSkeleton } from './states';
import { usePortal } from './usePortal';

const TeamsIcon = lucideGlyph(lucideUsers, 18);

/**
 * Your Teams (subscription.md "Settings, Subscription"): each team with its tier and the one action this person may
 * take. An admin manages billing or upgrades the team; a member of a team on Free asks an admin; a member of a
 * subscribed team has nothing to do.
 */
export function SubscriptionTeamsCell() {
  const load = useSubscription();
  const upgrade = useUpgrade();
  const portal = usePortal();
  if (load.status !== 'ready')
    return <CellFallback load={load} skeleton={<CellSkeleton rows={2} />} />;

  const { teams } = load.me;
  if (teams.length === 0)
    return (
      <CompactEmptyState
        icon={<TeamsIcon />}
        title="No Teams Yet"
        description="A team shares one library. Create one in the Explorer, then subscribe it here."
      />
    );

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {teams.map((team) => (
          <li
            key={team.teamId}
            data-subscription-team={team.teamId}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 ${SETTINGS_CARD_SLOT}`}
          >
            <TeamTile name={team.name} />
            <div className="flex min-w-0 flex-[1_1_13rem] flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span className="min-w-0 truncate">{team.name}</span>
                {team.tier === 'free' ? null : (
                  <ProBadge form="solid" size="sm" label={`${team.name} Has Pro for Teams`} />
                )}
              </span>
              <span className="text-xs leading-normal text-slate-500 dark:text-slate-400">
                {teamLine(team)}
              </span>
              {askedLine(team) ? (
                <span
                  data-team-asked
                  className="text-xs leading-normal text-slate-500 dark:text-slate-400"
                >
                  {askedLine(team)}
                </span>
              ) : null}
            </div>
            <TeamAction
              team={team}
              busy={portal.opening === team.owner}
              onUpgrade={() => upgrade.openUpgrade({ owner: team.owner })}
              onAsk={() => upgrade.openAskAdmin({ owner: team.owner })}
              onPortal={() => portal.open(team.owner)}
            />
            <TeamRequests team={team} />
          </li>
        ))}
      </ul>
      {portal.error ? (
        <div className="px-4 pb-4">
          <ErrorNote>{portal.error}</ErrorNote>
        </div>
      ) : null}
    </div>
  );
}

function TeamAction({
  team,
  busy,
  onUpgrade,
  onAsk,
  onPortal,
}: {
  team: TeamSubscription;
  busy: boolean;
  onUpgrade: () => void;
  onAsk: () => void;
  onPortal: () => void;
}) {
  // Each button names its team for a screen reader, as a list of the same words would say nothing.
  if (team.role === 'admin') {
    return team.tier === 'free' ? (
      <Button
        variant="secondary"
        size="sm"
        aria-label={`Upgrade Team: ${team.name}`}
        onClick={onUpgrade}
      >
        Upgrade Team
      </Button>
    ) : (
      <Button
        variant="secondary"
        size="sm"
        aria-label={`Manage Billing: ${team.name}`}
        busy={busy}
        onClick={onPortal}
      >
        {busy ? <Spinner /> : null}
        Manage Billing
      </Button>
    );
  }
  if (team.tier !== 'free') return null;
  return (
    <Button variant="secondary" size="sm" aria-label={`Ask an Admin: ${team.name}`} onClick={onAsk}>
      Ask an Admin
    </Button>
  );
}

/**
 * What a Free team's admin is told of members asking for Pro for Teams (subscription.md "Ask an Admin"): one line,
 * closed, that opens on the newest few, each with who, the limit that prompted it, when, and their note.
 */
function TeamRequests({ team }: { team: TeamSubscription }) {
  const line = requestsLine(team);
  if (!line || !team.requests) return null;
  const { count, latest } = team.requests;
  const more = count - latest.length;
  return (
    <details data-team-requests={count} className="group basis-full pl-12">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-500" />
        {line}
        <span
          aria-hidden
          className="text-slate-400 transition-transform group-open:rotate-90 dark:text-slate-500"
        >
          ›
        </span>
      </summary>
      <ul className="mt-2 flex flex-col gap-2 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
        {latest.map((request) => (
          <li key={`${request.at}-${request.name}`} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {requestLine(request)}
            </span>
            {request.note ? (
              <span className="line-clamp-3 text-xs leading-normal break-words whitespace-pre-line text-slate-500 dark:text-slate-400">
                {`“${request.note}”`}
              </span>
            ) : null}
          </li>
        ))}
        {more > 0 ? (
          <li className="text-xs text-slate-500 dark:text-slate-400">{`and ${more} more`}</li>
        ) : null}
      </ul>
    </details>
  );
}

// A team's initials on a tile of the colour picked from its name: square, where a person's avatar is a disc.
function TeamTile({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      style={{ '--team-tile': avatarFill(name) } as CSSProperties}
      className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-(--team-tile) text-xs font-bold text-white"
    >
      {initials(name)}
    </span>
  );
}
