'use client';

// A team's page, at its root (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): its header and
// tabs (teams/page/TeamView.tsx), the People tab where the team is run, the Library tab (the team's list, drawn by
// the caller), and for an admin the Audit Log tab (audit/AuditLog.tsx). A team the person is not in (gone, left,
// never joined) is a not-found card instead.

import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { LIST_CARD, SKELETON } from '../ui/classes';
import { useTeamDetails } from '../teams/team-details';
import { useTeams } from '../teams/context';
import { SIDEBAR_LABELS, viewLens, withLens, type TeamTab } from '../views';
import { useExplorer } from './context';
import { NotFoundCard } from './NotFoundCard';
import { SECTIONS_BAR_ATTR } from './PhoneSections';

// The Audit Log loads when an admin's team view first draws it: its rows, filters and CSV export are for the few who
// run a team, so the Explorer's first load never carries them (liveworkspace/docs/specs/010-site/blueprints/site.md
// "Performance and limits").
const AuditLog = lazy(() => import('./audit/AuditLog').then((m) => ({ default: m.AuditLog })));

// The team's page loads with the team view (its header, tabs, members' rows, menus and the invite and edit dialogs),
// so the Explorer's first load never carries it; the idle preload (./lazy-panes.ts) fetches it after the page draws.
// Its skeleton stands in meanwhile, as it does while the members are read.
const loadTeamCard = () => import('../teams/page/TeamView');
const TeamView = lazy(() => loadTeamCard().then((m) => ({ default: m.TeamView })));
/** Fetches the team card's code. Never rejects. */
export const preloadTeamCard = (): Promise<void> =>
  loadTeamCard().then(
    () => {},
    () => {},
  );

export { initialsOf, teamHeadline } from '../teams/team-details';
export { memberName } from '../teams/rules';

export function TeamPage({
  teamId,
  tab = 'people',
  libraryCount = null,
  children,
}: {
  teamId: string;
  tab?: TeamTab;
  /** How many items the Library holds, for its tab, when the list is loaded whole. */
  libraryCount?: number | null;
  /** The Library tab: the team's list with its toolbar. */
  children: ReactNode;
}) {
  const { teams, viewerId, helpHref, navigate, view } = useExplorer();
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
  // Accounts couldn't be asked: the library alone, as before the page had tabs.
  if (load.state === 'unknown') return <>{children}</>;
  if (load.state === 'loading') return <TeamPageSkeleton />;
  const { details } = load;
  const teamHelp = helpHref?.({ kind: 'team', id: teamId });
  // The tab is in the address; a change keeps the lens the Library had.
  const onTab = (next: TeamTab) =>
    navigate(
      withLens(
        next === 'people' ? { kind: 'team', id: teamId } : { kind: 'team', id: teamId, tab: next },
        viewLens(view),
      ),
    );
  return (
    <Suspense fallback={<TeamPageSkeleton />}>
      <TeamView
        details={details}
        reload={reload}
        viewerId={viewerId}
        helpHref={teamHelp}
        tab={tab}
        onTab={onTab}
        libraryCount={libraryCount}
        library={children}
        onGone={() => {
          navigate({ kind: 'all' });
          landOnMyWork();
        }}
        audit={
          // The team's admins alone: drawn only when accounts says the reader runs the team, as the read checks too.
          details.team.myRole === 'admin' ? (
            <Suspense fallback={null}>
              <AuditLog
                key={`audit-${teamId}`}
                teamId={teamId}
                teamName={details.team.name}
                members={details.members}
                helpHref={auditHelpOf(teamHelp)}
              />
            </Suspense>
          ) : null
        }
      />
    </Suspense>
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

function TeamPageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy data-team-members-loading="">
      <div className="flex items-center gap-4">
        <span className={`size-14 shrink-0 rounded-2xl ${SKELETON}`} />
        <span className="flex flex-1 flex-col gap-2">
          <span className={`h-6 w-48 ${SKELETON}`} />
          <span className={`h-3.5 w-64 ${SKELETON}`} />
        </span>
      </div>
      <span className={`h-11 border-b border-slate-200 dark:border-slate-700`} />
      <TeamMembersSkeleton />
    </div>
  );
}

function TeamMembersSkeleton() {
  return (
    <div className={LIST_CARD}>
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
