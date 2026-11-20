'use client';

// A team's view, at its root (liveplanner's TeamPane): the team card (teams/TeamCard.tsx), where the team is run in
// place, over the team's library, then for an admin the team's Audit Log (audit/AuditLog.tsx), closed until opened. A team the person is not in (gone, left, never joined) is a
// not-found card instead.

import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { LIST_CARD } from '../ui/classes';
import { useTeamDetails } from '../teams/team-details';
import { useTeams } from '../teams/context';
import { SIDEBAR_LABELS } from '../views';
import { useExplorer } from './context';
import { NotFoundCard } from './NotFoundCard';
import { SECTIONS_BAR_ATTR } from './PhoneSections';

// The Audit Log loads when an admin's team view first draws it: its rows, filters and CSV export are for the few who
// run a team, so the Explorer's first load never carries them (liveworkspace/docs/specs/010-site/blueprints/site.md
// "Performance and limits").
const AuditLog = lazy(() => import('./audit/AuditLog').then((m) => ({ default: m.AuditLog })));

// The team card loads with the team view (its members' rows, menus and the invite and edit dialogs), so the Explorer's
// first load never carries it; the idle preload (./lazy-panes.ts) fetches it after the page draws. Its skeleton
// stands in meanwhile, as it does while the members are read.
const loadTeamCard = () => import('../teams/TeamCard');
const TeamCard = lazy(() => loadTeamCard().then((m) => ({ default: m.TeamCard })));
/** Fetches the team card's code. Never rejects. */
export const preloadTeamCard = (): Promise<void> =>
  loadTeamCard().then(
    () => {},
    () => {},
  );

export { initialsOf, teamHeadline } from '../teams/team-details';
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
        <Suspense fallback={<TeamMembersSkeleton />}>
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
        </Suspense>
      ) : load.state === 'loading' ? (
        <TeamMembersSkeleton />
      ) : null}
      {children}
      {/* The team's admins alone: drawn only when accounts says the reader runs the team, as the read checks too. */}
      {load.state === 'found' && load.details.team.myRole === 'admin' ? (
        <Suspense fallback={null}>
          <AuditLog
            key={`audit-${teamId}`}
            teamId={teamId}
            teamName={load.details.team.name}
            members={load.details.members}
            helpHref={auditHelpOf(helpHref?.({ kind: 'team', id: teamId }))}
          />
        </Suspense>
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
 *  Work's row in the sidebar, where the person now is, or (on a phone, where the sidebar is in its drawer) on the
 *  sections bar, rather than on the page's body. */
export function landOnMyWork(): void {
  const row = document.querySelector<HTMLElement>(
    `[data-explorer] aside [role="treeitem"][data-tree-label="${SIDEBAR_LABELS.myWork}"]`,
  );
  row?.focus({ preventScroll: true });
  if (row && document.activeElement === row) return;
  document
    .querySelector<HTMLElement>(`[data-explorer] [${SECTIONS_BAR_ATTR}]`)
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

export function TeamNotFound() {
  const { words } = useExplorer();
  return (
    <div data-team-not-found="">
      <NotFoundCard title="Team not found">
        {`This team doesn’t exist, or you’re not a member of it. Ask an admin for an invite, or head back to your own ${words.lowerMany}.`}
      </NotFoundCard>
    </div>
  );
}
