'use client';

// A team's view, at its root (liveplanner's TeamPane): the team card (teams/TeamCard.tsx), where the team is run in
// place, over the team's library, then the team's own feed (TeamActivity.tsx), closed until opened, and for an admin the
// team's Audit Log (audit/AuditLog.tsx), closed too. A team the person is not in (gone, left, never joined) is a
// not-found card instead.

import { useEffect, type ReactNode } from 'react';
import { LIST_CARD } from '../ui/classes';
import { TeamCard, useTeamDetails } from '../teams/TeamCard';
import { useTeams } from '../teams/context';
import { SIDEBAR_LABELS } from '../views';
import { useExplorer } from './context';
import { TeamActivity } from './TeamActivity';
import { AuditLog } from './audit/AuditLog';
import { NotFoundCard } from './NotFoundCard';

export { initialsOf, teamHeadline } from '../teams/TeamCard';
export { memberName } from '../teams/rules';

export function TeamPage({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { teams, viewerId, helpHref, navigate } = useExplorer();
  const member = teams.some((t) => t.id === teamId);
  const [load, reload] = useTeamDetails(teamId);
  const { retryMyTeams } = useTeams();
  // The sidebar still lists a team accounts says the person is no longer in (an admin removed them elsewhere): the
  // list is read again, so the team leaves the sidebar now rather than on the next reload.
  const removed = member && load.state === 'gone';
  useEffect(() => {
    if (removed) retryMyTeams();
  }, [removed, retryMyTeams]);
  if (!member || load.state === 'gone') return <TeamNotFound />;
  return (
    <div className="flex flex-col gap-4">
      {load.state === 'found' ? (
        <TeamCard
          details={load.details}
          reload={reload}
          viewerId={viewerId}
          helpHref={helpHref?.({ kind: 'team', id: teamId })}
          onGone={() => {
            navigate({ kind: 'all' });
            landOnMyWork();
          }}
        />
      ) : load.state === 'loading' ? (
        <TeamMembersSkeleton />
      ) : null}
      {children}
      {/* Keyed on the team: another team's view starts its feed, and its open state, afresh. */}
      <TeamActivity key={teamId} teamId={teamId} />
      {/* The team's admins alone: drawn only when accounts says the reader runs the team, as the read checks too. */}
      {load.state === 'found' && load.details.team.myRole === 'admin' ? (
        <AuditLog
          key={`audit-${teamId}`}
          teamId={teamId}
          teamName={load.details.team.name}
          members={load.details.members}
          helpHref={auditHelpOf(helpHref?.({ kind: 'team', id: teamId }))}
        />
      ) : null}
    </div>
  );
}

// The Audit Log's article beside the team's own, in the same help centre (`…/help/collaboration/teams/audit-log/`).
function auditHelpOf(teamHelp: string | undefined): string | undefined {
  const at = teamHelp?.indexOf('/help/') ?? -1;
  return at < 0 ? undefined : `${teamHelp!.slice(0, at)}/help/collaboration/teams/audit-log/`;
}

/** After leaving or deleting a team its card, and the control that was focused, are gone: the keyboard lands on My
 *  Work's row in the sidebar, where the person now is, or (on a phone, where the sidebar is in its drawer) on Browse
 *  Sections, rather than on the page's body. */
export function landOnMyWork(): void {
  const row = document.querySelector<HTMLElement>(
    `[data-explorer] aside [role="treeitem"][data-tree-label="${SIDEBAR_LABELS.myWork}"]`,
  );
  row?.focus({ preventScroll: true });
  if (row && document.activeElement === row) return;
  document
    .querySelector<HTMLElement>('[data-explorer] button[aria-label="Browse sections"]')
    ?.focus({ preventScroll: true });
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
  const { words } = useExplorer();
  return (
    <div data-team-not-found="">
      <NotFoundCard title="Team not found">
        {`This team doesn’t exist, or you’re not a member of it. Ask an admin for an invite, or head back to your own ${words.lowerMany}.`}
      </NotFoundCard>
    </div>
  );
}
