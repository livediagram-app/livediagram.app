'use client';

import { useState, type FormEvent } from 'react';
import {
  accountApi,
  errorMessage,
  type Invitation,
  type Member,
  type MyTeam,
  type TeamDetail,
  type TeamRole,
} from '@/lib/account-api';
import { BUTTON, ErrorNote, INPUT, Panel } from './AccountShell';
import { useAccountData } from './useAccountData';

// The teams page (liveworkspace/docs/site.md "Your account"): invitations waiting for the person,
// making a team, and each of their teams with its members. Everything here is the same team in every
// app.
export function TeamsPanel() {
  const [load, refresh] = useAccountData<{ teams: MyTeam[]; invitations: Invitation[] }>('/teams');
  const [open, setOpen] = useState<string | null>(null);

  if (load.state === 'loading') {
    return (
      <div
        aria-busy
        className="h-40 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
      />
    );
  }
  if (load.state === 'error') return <ErrorNote>{errorMessage(load.error)}</ErrorNote>;
  const { teams, invitations } = load.data;

  return (
    <div className="space-y-8">
      {invitations.length > 0 && (
        <section aria-labelledby="invitations">
          <h2 id="invitations" className="text-xl font-semibold text-slate-900 dark:text-white">
            Invitations
          </h2>
          <ul className="mt-4 space-y-3">
            {invitations.map((invitation) => (
              <InvitationRow key={invitation.id} invitation={invitation} onAnswered={refresh} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="your-teams">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="your-teams" className="text-xl font-semibold text-slate-900 dark:text-white">
            Your teams
          </h2>
        </div>
        <CreateTeam
          onCreated={async (id) => {
            await refresh();
            setOpen(id);
          }}
        />
        {teams.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
            You aren’t in a team yet. Make one above, or accept an invitation when someone sends you
            one.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {teams.map((team) => (
              <li key={team.id}>
                <TeamCard
                  team={team}
                  open={open === team.id}
                  onToggle={() => setOpen(open === team.id ? null : team.id)}
                  onChanged={refresh}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InvitationRow({
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
    if (result.ok) await onAnswered();
    else setError(result.error);
    setBusy(false);
  }

  return (
    <li>
      <Panel className="border-sky-200 bg-sky-50/60 dark:border-sky-500/30 dark:bg-sky-500/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{invitation.teamName}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {invitation.invitedByName
                ? `${invitation.invitedByName} invited you`
                : 'You’re invited'}
              {invitation.role === 'admin' ? ', as an admin' : ''}.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={BUTTON.secondary}
              disabled={busy}
              onClick={() => void respond('decline')}
            >
              Decline
            </button>
            <button
              type="button"
              className={BUTTON.primary}
              disabled={busy}
              onClick={() => void respond('accept')}
            >
              Join team
            </button>
          </div>
        </div>
        {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      </Panel>
    </li>
  );
}

function CreateTeam({ onCreated }: { onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await accountApi<MyTeam>('/teams', 'POST', { name });
    if (result.ok) {
      setName('');
      await onCreated(result.data.id);
    } else setError(result.error);
    setBusy(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4">
      <label htmlFor="new-team" className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Make a team
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="new-team"
          className={INPUT}
          placeholder="The team’s name"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className={`${BUTTON.primary} shrink-0`}
          disabled={busy || !name.trim()}
        >
          Make team
        </button>
      </div>
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </form>
  );
}

function TeamCard({
  team,
  open,
  onToggle,
  onChanged,
}: {
  team: MyTeam;
  open: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-micro hover:bg-slate-50 sm:px-6 dark:hover:bg-slate-800/50"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            {team.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900 dark:text-white">
              {team.name}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
              {team.role === 'admin' ? ' · You’re an admin' : ''}
            </span>
          </span>
        </span>
        <span
          aria-hidden
          className={`text-slate-400 transition-transform duration-micro ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-200 px-5 py-5 sm:px-6 dark:border-slate-800">
          <TeamDetailView teamId={team.id} onChanged={onChanged} />
        </div>
      )}
    </section>
  );
}

function TeamDetailView({ teamId, onChanged }: { teamId: string; onChanged: () => Promise<void> }) {
  const [load, refresh] = useAccountData<TeamDetail>(`/teams/${teamId}/members`);
  const [error, setError] = useState<string | null>(null);

  if (load.state === 'loading') return <p className="text-sm text-slate-500">Loading members…</p>;
  if (load.state === 'error') return <ErrorNote>{errorMessage(load.error)}</ErrorNote>;
  const { team, members } = load.data;
  const admin = team.myRole === 'admin';

  // Every change refreshes this team and the list above (names, counts, a team that's gone).
  async function run(action: Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    const result = await action;
    if (!result.ok) setError(result.error ?? 'failed');
    await Promise.all([refresh(), onChanged()]);
  }

  return (
    <div className="space-y-6">
      {admin && <RenameTeam teamId={teamId} name={team.name} onSaved={onChanged} />}

      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Members</h3>
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              me={member.id === team.myMemberId}
              admin={admin}
              onRole={(role) =>
                void run(accountApi(`/teams/${teamId}/members/${member.id}`, 'PATCH', { role }))
              }
              onRemove={() =>
                void run(accountApi(`/teams/${teamId}/members/${member.id}`, 'DELETE'))
              }
            />
          ))}
        </ul>
        {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      </div>

      {admin && (
        <InviteMember teamId={teamId} onInvited={() => void run(Promise.resolve({ ok: true }))} />
      )}

      {admin && (
        <DeleteTeam
          name={team.name}
          onDelete={() => void run(accountApi(`/teams/${teamId}`, 'DELETE'))}
        />
      )}
    </div>
  );
}

function MemberRow({
  member,
  me,
  admin,
  onRole,
  onRemove,
}: {
  member: Member;
  me: boolean;
  admin: boolean;
  onRole: (role: TeamRole) => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const label = member.name || member.email;
  const removeLabel = me ? 'Leave team' : member.status === 'invited' ? 'Withdraw' : 'Remove';

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900 dark:text-white">
          {label}
          {me && <span className="ml-2 text-sm font-normal text-slate-500">(you)</span>}
        </p>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
          {member.name ? member.email : null}
          {member.status === 'invited' && (
            <span className="ml-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Invited
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {admin ? (
          <select
            aria-label={`Role for ${label}`}
            value={member.role}
            onChange={(event) => onRole(event.target.value as TeamRole)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {member.role === 'admin' ? 'Admin' : 'Member'}
          </span>
        )}
        {(admin || me) &&
          (confirming ? (
            <span className="flex items-center gap-1">
              <button type="button" className={BUTTON.danger} onClick={onRemove}>
                {removeLabel}?
              </button>
              <button
                type="button"
                className={BUTTON.secondary}
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className={BUTTON.danger} onClick={() => setConfirming(true)}>
              {removeLabel}
            </button>
          ))}
      </div>
    </li>
  );
}

function RenameTeam({
  teamId,
  name,
  onSaved,
}: {
  teamId: string;
  name: string;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await accountApi(`/teams/${teamId}`, 'PATCH', { name: value });
    if (result.ok) await onSaved();
    else setError(result.error);
    setBusy(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label
        htmlFor={`name-${teamId}`}
        className="text-sm font-semibold text-slate-900 dark:text-white"
      >
        Name
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`name-${teamId}`}
          className={INPUT}
          maxLength={80}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="submit"
          className={`${BUTTON.secondary} shrink-0`}
          disabled={busy || !value.trim() || value.trim() === name}
        >
          Rename
        </button>
      </div>
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </form>
  );
}

function InviteMember({ teamId, onInvited }: { teamId: string; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(null);
    const result = await accountApi(`/teams/${teamId}/members`, 'POST', { email, role });
    if (result.ok) {
      setSent(email.trim());
      setEmail('');
      onInvited();
    } else setError(result.error);
    setBusy(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label
        htmlFor={`invite-${teamId}`}
        className="text-sm font-semibold text-slate-900 dark:text-white"
      >
        Invite someone
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`invite-${teamId}`}
          type="email"
          className={INPUT}
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <select
          aria-label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as TeamRole)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          className={`${BUTTON.primary} shrink-0`}
          disabled={busy || !email.trim()}
        >
          Send invitation
        </button>
      </div>
      {sent && (
        <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          Invitation sent to {sent}.
        </p>
      )}
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </form>
  );
}

function DeleteTeam({ name, onDelete }: { name: string; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="rounded-xl border border-rose-200 p-4 dark:border-rose-500/30">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">Delete this team</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        It goes from every app for everyone in it. Work the team kept in an app stays with whoever
        made it.
      </p>
      <div className="mt-3 flex gap-2">
        {confirming ? (
          <>
            <button type="button" className={BUTTON.danger} onClick={onDelete}>
              Delete {name} for everyone
            </button>
            <button type="button" className={BUTTON.secondary} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className={BUTTON.danger} onClick={() => setConfirming(true)}>
            Delete team
          </button>
        )}
      </div>
    </div>
  );
}
