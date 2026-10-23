'use client';

import { lucideGlyph } from '@livediagram/ui';
import { lucideChevronRight, lucidePlus } from '@livediagram/icons/lucide';
import { useState } from 'react';
import { accountApi, errorMessage, type Invitation, type MyTeam } from '@/lib/account-api';
import { memberCountLabel, teamPath } from '@/lib/teams';
import { BUTTON, ErrorNote } from '../settings/AccountShell';
import { useAccountData } from '../settings/useAccountData';
import { AvatarStack, TeamAvatar } from './Avatars';
import { NewTeamPopover } from './NewTeamPopover';
import { RoleBadge } from './RoleBadge';

const ChevronIcon = lucideGlyph(lucideChevronRight, 16);
const PlusIcon = lucideGlyph(lucidePlus, 28);

// The teams page (liveworkspace/docs/site.md "Your account"): invitations waiting for the person, then
// each of their teams as a card (its tile, name, size, their role and who is in it) that opens the
// team's own page. "New team" makes one in a popover and opens it. One request fills it all: the list
// answer carries each team's counts and first four members.
export function TeamsList() {
  const [load, refresh] = useAccountData<{ teams: MyTeam[]; invitations: Invitation[] }>('/teams');

  if (load.state === 'loading') {
    return (
      <div aria-busy className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-3xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
          />
        ))}
      </div>
    );
  }
  if (load.state === 'error') return <ErrorNote>{errorMessage(load.error)}</ErrorNote>;
  const { teams, invitations } = load.data;

  return (
    <div className="space-y-12">
      {invitations.length > 0 && (
        <section aria-labelledby="invitations">
          <SectionHeading id="invitations" count={invitations.length}>
            Invitations
          </SectionHeading>
          <ul className="mt-4 space-y-3">
            {invitations.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} onAnswered={refresh} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="your-teams">
        <div className="flex items-center justify-between gap-4">
          <SectionHeading id="your-teams" count={teams.length || undefined}>
            Your teams
          </SectionHeading>
          {teams.length > 0 && <NewTeamPopover />}
        </div>
        {teams.length === 0 ? (
          <EmptyTeams invited={invitations.length > 0} />
        ) : (
          <ul className="mt-5 grid gap-3">
            {teams.map((team) => (
              <li key={team.id}>
                <TeamCard team={team} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ id, count, children }: { id: string; count?: number; children: string }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white"
    >
      {children}
      {count !== undefined && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="text-optical-centre">{count}</span>
        </span>
      )}
    </h2>
  );
}

function TeamCard({ team }: { team: MyTeam }) {
  const invitedCount = team.invitedCount;
  const stack = <AvatarStack members={team.members} total={team.memberCount} />;

  return (
    <a
      href={teamPath(team.id)}
      className="group relative flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 motion-reduce:hover:translate-y-0 sm:p-5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:focus-visible:outline-white"
    >
      <TeamAvatar id={team.id} name={team.name} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold text-slate-900 dark:text-white">
            {team.name}
          </span>
          <RoleBadge role={team.role} />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600 dark:text-slate-400">
          {team.organisation && (
            <>
              <span className="max-w-full truncate">{team.organisation}</span>
              <span aria-hidden className="text-slate-300 dark:text-slate-600">
                ·
              </span>
            </>
          )}
          <span>{memberCountLabel(team.memberCount)}</span>
          {invitedCount > 0 && (
            <>
              <span aria-hidden className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span>{invitedCount} invited</span>
            </>
          )}
        </span>
        <span className="mt-3 flex sm:hidden">{stack}</span>
      </span>
      <span className="hidden sm:flex">{stack}</span>
      <span
        aria-hidden
        className="shrink-0 text-slate-300 transition-transform duration-micro group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400"
      >
        <ChevronIcon />
      </span>
    </a>
  );
}

function InvitationCard({
  invitation,
  onAnswered,
}: {
  invitation: Invitation;
  onAnswered: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(answer: 'accept' | 'decline') {
    setBusy(true);
    setError(null);
    const result = await accountApi(`/invitations/${invitation.id}/${answer}`, 'POST', {});
    if (result.ok && answer === 'accept') {
      window.location.assign(teamPath(invitation.teamId));
      return;
    }
    if (result.ok) await onAnswered();
    else setError(result.error);
    setBusy(false);
  }

  return (
    <li className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm sm:p-5 dark:border-sky-500/30 dark:from-sky-500/10 dark:to-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <TeamAvatar id={invitation.teamId} name={invitation.teamName} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {invitation.teamName}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
              {[invitation.organisation, memberCountLabel(invitation.memberCount)]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              {invitation.invitedByName
                ? `${invitation.invitedByName} invited you`
                : 'You’re invited'}
              {invitation.role === 'admin' ? ', as an admin' : ''}.
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <button
            type="button"
            className={`${BUTTON.secondary} relative touch-target-y flex-1 sm:flex-none`}
            disabled={busy}
            onClick={() => void respond('decline')}
          >
            Decline
          </button>
          <button
            type="button"
            className={`${BUTTON.primary} relative touch-target-y flex-1 sm:flex-none`}
            disabled={busy}
            onClick={() => void respond('accept')}
          >
            Join team
          </button>
        </div>
      </div>
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </li>
  );
}

// No teams yet: what a team is for, and the way to make one.
function EmptyTeams({ invited }: { invited: boolean }) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-12 text-center shadow-sm sm:py-16 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
      <EmptyArt />
      <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Bring your people together
      </h3>
      <p className="mt-2 max-w-md text-slate-600 dark:text-slate-400">
        {invited
          ? 'Join a team you’re invited to above, or make your own. A team works the same in every app.'
          : 'Make a team, invite people by email or a link, and its work shows up for everyone in it, in every app.'}
      </p>
      <div className="mt-7">
        <NewTeamPopover align="center" label="Create your first team" big />
      </div>
    </div>
  );
}

// Three people around a team tile, in the avatars' own shapes.
function EmptyArt() {
  const people = [
    { tone: 'from-sky-700 to-indigo-700', at: '-left-10 top-1', text: 'AK' },
    { tone: 'from-rose-600 to-pink-800', at: '-right-10 top-1', text: 'JT' },
    { tone: 'from-emerald-700 to-teal-800', at: 'left-1/2 -bottom-6 -translate-x-1/2', text: 'MO' },
  ];
  return (
    <div aria-hidden className="relative mb-4 size-20">
      <span className="flex size-20 items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500">
        <PlusIcon />
      </span>
      {people.map((person) => (
        <span
          key={person.text}
          className={`absolute flex size-9 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-md ring-4 ring-white dark:ring-slate-900 ${person.tone} ${person.at}`}
        >
          <span className="text-optical-centre">{person.text}</span>
        </span>
      ))}
    </div>
  );
}
