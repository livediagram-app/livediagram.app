'use client';

// A team's page, at its root (liveplanner's TeamPane): one calm card over the team's library. Its header says how
// many have joined and whether the person is an admin, with where the team is run ("Manage on liveworkspace.app")
// and Help; then each member: name, "you", Invited or Declined, their email and role. The team itself is run on
// liveworkspace.app, the same team in every app, so inviting, roles, renaming, leaving and deleting happen there;
// this page only reads. A team the person is not in (gone, left, never joined) is a not-found card instead.

import { useEffect, useState, type ReactNode } from 'react';
import type { TeamDetails, TeamMember } from '../data/accounts';
import { isAbort } from '../data/errors';
import { LIST_CARD } from '../ui/classes';
import { useExplorer } from './context';
import { useExtras } from './extras';

type Load =
  | { state: 'loading'; teamId: string }
  | { state: 'found'; teamId: string; details: TeamDetails }
  | { state: 'gone'; teamId: string }
  // Accounts could not be asked (no reader, or it failed): the library still shows, without members.
  | { state: 'unknown'; teamId: string };

export function TeamPage({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { teams } = useExplorer();
  const { accounts } = useExtras();
  const member = teams.some((t) => t.id === teamId);
  const [load, setLoad] = useState<Load>({ state: accounts ? 'loading' : 'unknown', teamId });
  useEffect(() => {
    if (!accounts) {
      setLoad({ state: 'unknown', teamId });
      return;
    }
    setLoad({ state: 'loading', teamId });
    const controller = new AbortController();
    accounts.teamMembers(teamId, controller.signal).then(
      (details) =>
        setLoad(details ? { state: 'found', teamId, details } : { state: 'gone', teamId }),
      (e: unknown) => {
        if (!isAbort(e)) setLoad({ state: 'unknown', teamId });
      },
    );
    return () => controller.abort();
  }, [accounts, teamId]);
  const current = load.teamId === teamId ? load : { state: 'loading' as const, teamId };
  if (!member || current.state === 'gone') return <TeamNotFound />;
  return (
    <div className="flex flex-col gap-4">
      {current.state === 'found' ? (
        <TeamMembersCard teamId={teamId} details={current.details} />
      ) : current.state === 'loading' ? (
        <TeamMembersSkeleton />
      ) : null}
      {children}
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

/** "3 members · You're an admin": joined members only (an invitation is not yet a member). */
export function teamHeadline(details: TeamDetails): string {
  const joined = details.members.filter((m) => m.status === 'joined').length;
  return [
    `${joined} ${joined === 1 ? 'member' : 'members'}`,
    details.team.myRole === 'admin' ? 'You’re an admin' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function TeamMembersCard({ teamId, details }: { teamId: string; details: TeamDetails }) {
  const { helpHref, viewerId } = useExplorer();
  const { teamManageHref } = useExtras();
  const manage = teamManageHref(teamId);
  const help = helpHref?.({ kind: 'team', id: teamId });
  return (
    <div className={LIST_CARD} data-team-members="">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
          {teamHeadline(details)}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {manage ? (
            <a
              href={manage}
              className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              Manage on liveworkspace.app
            </a>
          ) : null}
          {help ? (
            <a
              href={help}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Help: team roles and invites"
              title="Help"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              ?
            </a>
          ) : null}
        </div>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {details.members.map((m) => (
          <TeamMemberRow
            key={m.id}
            m={m}
            self={m.id === details.team.myMemberId || (m.userId !== null && m.userId === viewerId)}
          />
        ))}
      </ul>
    </div>
  );
}

/** What a member row is called: their name, else their email's local part made readable ("anna.smith" → "Anna Smith"). */
export function memberName(m: Pick<TeamMember, 'name' | 'email'>, self: boolean): string {
  if (m.name) return m.name;
  if (m.email) {
    const local = m.email.split('@')[0] ?? m.email;
    const words = local.split(/[._\-+]+/).filter(Boolean);
    if (words.length > 0) return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
    return m.email;
  }
  return self ? 'You' : 'Member';
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase() ||
    '?'
  );
}

const PILL = 'shrink-0 rounded-full px-1.5 text-[10px] font-medium ring-1';

function TeamMemberRow({ m, self }: { m: TeamMember; self: boolean }) {
  const name = memberName(m, self);
  const pending = m.status === 'invited' && !m.expired;
  const declined = m.status === 'declined' || (m.status === 'invited' && m.expired === true);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5" data-team-member={m.id}>
      <span
        aria-hidden
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white ${
          pending || declined ? 'opacity-50' : ''
        }`}
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {name}
          </span>
          {self ? (
            <span
              className={`${PILL} bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600`}
            >
              you
            </span>
          ) : null}
          {pending ? (
            <span className={`${PILL} bg-amber-100 text-amber-700 ring-amber-200`}>Invited</span>
          ) : null}
          {declined ? (
            <span
              className={`${PILL} bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30`}
            >
              {m.status === 'declined' ? 'Declined' : 'Expired'}
            </span>
          ) : null}
        </span>
        {m.email ? (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {m.email}
          </span>
        ) : pending ? (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            Waiting for them to accept
          </span>
        ) : null}
      </span>
      {declined ? null : (
        <span
          className={`inline-flex w-fit items-center py-0.5 ${PILL} ${
            m.role === 'admin'
              ? 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
              : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600'
          }`}
        >
          {m.role === 'admin' ? 'Admin' : 'Member'}
        </span>
      )}
    </li>
  );
}

function TeamNotFound() {
  const { navigate, kind } = useExplorer();
  return (
    <div className="flex items-center justify-center px-6 py-16" data-team-not-found="">
      <div className="flex max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">404</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Team not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          This team doesn’t exist, or you’re not a member of it. Ask an admin for an invite, or head
          back to your own {kind.lowerMany}.
        </p>
        <button
          type="button"
          onClick={() => navigate({ kind: 'all' })}
          className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          Back to your {kind.lowerMany}
        </button>
      </div>
    </div>
  );
}
