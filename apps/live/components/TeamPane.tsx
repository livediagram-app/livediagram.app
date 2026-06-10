'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiDeleteTeam,
  apiGetTeam,
  apiInviteTeamMember,
  apiRemoveTeamMember,
  apiUpdateTeam,
  apiUpdateTeamMemberRole,
  type TeamMember,
  type TeamRole,
} from '@/lib/api-client';
import type { TeamDetailResponse } from '@/lib/api/teams';
import { useConfirm } from '@/hooks/useConfirm';
import { track } from '@/lib/telemetry';
import { TeamFormModal } from './TeamFormModal';

// Right-pane team view for the Explorer (spec/32): organisation line,
// member list with roles, and the admin management surface (invite by
// email, role select, remove, edit, delete). Non-admins see the list
// plus Leave. Self-contained: fetches its own detail per teamId and
// reports list-shaped changes (rename / delete / leave / member count)
// back up via the two callbacks so the sidebar stays in sync.

export function TeamPane({
  ownerId,
  teamId,
  clerkUserId,
  onTeamsChanged,
  onLeftTeam,
}: {
  ownerId: string;
  teamId: string;
  clerkUserId: string | null;
  // The sidebar list needs a refetch (rename, member count change).
  onTeamsChanged: () => void;
  // The caller is no longer a member (left or deleted the team) —
  // the page bounces selection off the now-dead team node.
  onLeftTeam: () => void;
}) {
  const [detail, setDetail] = useState<TeamDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const confirm = useConfirm();

  const refresh = useCallback(async () => {
    try {
      const d = await apiGetTeam(ownerId, teamId);
      setDetail(d);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [ownerId, teamId]);

  useEffect(() => {
    setDetail(null);
    setLoading(true);
    setFailed(false);
    setNotice(null);
    setInviteEmail('');
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-4 w-4 animate-pulse rounded bg-slate-200" />
              <span className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
              <span className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (failed || !detail) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="max-w-md text-sm text-slate-500">
          This team could not be loaded. It may have been deleted, or you may no longer be a member.
        </p>
      </div>
    );
  }

  const { team, members, myRole } = detail;
  const isAdmin = myRole === 'admin';

  const submitEdit = async (values: { name: string; organisation: string | null }) => {
    setEditOpen(false);
    await apiUpdateTeam(ownerId, teamId, values).catch(() => {});
    track('Team', 'Changed');
    await refresh();
    onTeamsChanged();
  };

  const deleteTeam = async () => {
    const ok = await confirm({
      title: 'Delete team?',
      message: `"${team.name}" and its member list will be permanently deleted. Diagrams are not affected.`,
      confirmLabel: 'Delete team',
    });
    if (!ok) return;
    await apiDeleteTeam(ownerId, teamId).catch(() => {});
    track('Team', 'Deleted');
    onTeamsChanged();
    onLeftTeam();
  };

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email || inviteBusy) return;
    setInviteBusy(true);
    setNotice(null);
    try {
      const result = await apiInviteTeamMember(ownerId, teamId, email);
      if (!result.ok) {
        setNotice(
          result.reason === 'already_member'
            ? 'That address is already on this team.'
            : 'That does not look like an email address.',
        );
        return;
      }
      track('Team', 'Added', 'Member');
      setInviteEmail('');
      await refresh();
      onTeamsChanged();
    } catch {
      setNotice('Invite failed. Try again.');
    } finally {
      setInviteBusy(false);
    }
  };

  const changeRole = async (member: TeamMember, role: TeamRole) => {
    if (role === member.role) return;
    const result = await apiUpdateTeamMemberRole(ownerId, teamId, member.id, role).catch(
      () => null,
    );
    if (result && !result.ok) {
      setNotice('A team needs at least one Admin. Promote someone else first.');
      return;
    }
    if (result?.ok) track('Team', 'Changed', 'Role');
    await refresh();
  };

  const removeMember = async (member: TeamMember, isSelf: boolean) => {
    const ok = await confirm({
      title: isSelf ? 'Leave team?' : 'Remove member?',
      message: isSelf
        ? `You will no longer be a member of "${team.name}".`
        : `${member.email ?? 'This member'} will be removed from "${team.name}".`,
      confirmLabel: isSelf ? 'Leave' : 'Remove',
    });
    if (!ok) return;
    const result = await apiRemoveTeamMember(ownerId, teamId, member.id).catch(() => null);
    if (result && !result.ok) {
      setNotice('A team needs at least one Admin. Promote someone else first.');
      return;
    }
    if (result?.ok) track('Team', 'Removed', isSelf ? 'Self' : 'Member');
    onTeamsChanged();
    if (isSelf) {
      onLeftTeam();
      return;
    }
    await refresh();
  };

  const selfRow = members.find((m) => m.userId !== null && m.userId === clerkUserId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Team summary + actions ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-600">
            {team.organisation ? team.organisation : 'No organisation set'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {members.length} {members.length === 1 ? 'member' : 'members'} · you are{' '}
            {isAdmin ? 'an Admin' : 'a Member'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                Edit team
              </button>
              <button
                type="button"
                onClick={() => void deleteTeam()}
                className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
              >
                Delete team
              </button>
            </>
          ) : null}
          {selfRow ? (
            <button
              type="button"
              onClick={() => void removeMember(selfRow, true)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
            >
              Leave team
            </button>
          ) : null}
        </div>
      </div>

      {/* ---------- Invite (admins) ---------- */}
      {isAdmin ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void invite();
          }}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Invite by email address…"
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={!inviteEmail.trim() || inviteBusy}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Invite
          </button>
          <p className="w-full text-xs text-slate-400">
            They join as a Member right away and see the team once they sign in with that address.
            No email is sent.
          </p>
        </form>
      ) : null}

      {notice ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {notice}
        </p>
      ) : null}

      {/* ---------- Member list ---------- */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_110px_40px] items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Member</span>
          <span>Role</span>
          <span aria-hidden></span>
        </div>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const isSelf = m.userId !== null && m.userId === clerkUserId;
            const label = isSelf ? 'You' : (m.email ?? 'Member');
            const pending = m.userId === null;
            return (
              <li
                key={m.id}
                className="group grid grid-cols-[1fr_110px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">{label}</span>
                  {isSelf && m.email ? (
                    <span className="truncate text-xs text-slate-400">{m.email}</span>
                  ) : null}
                  {pending ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                      Invited
                    </span>
                  ) : null}
                </span>
                {isAdmin ? (
                  <select
                    value={m.role}
                    onChange={(e) => void changeRole(m, e.target.value as TeamRole)}
                    aria-label={`Role for ${label}`}
                    className="w-fit rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 outline-none transition focus:border-brand-400"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                ) : (
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
                      m.role === 'admin'
                        ? 'bg-brand-50 text-brand-700 ring-brand-200'
                        : 'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}
                  >
                    {m.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                )}
                {isAdmin && !isSelf ? (
                  <button
                    type="button"
                    onClick={() => void removeMember(m, false)}
                    aria-label={`Remove ${label}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                    </svg>
                  </button>
                ) : (
                  <span aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <TeamFormModal
        open={editOpen}
        title="Edit team"
        submitLabel="Save"
        initial={{ name: team.name, organisation: team.organisation }}
        onSubmit={(values) => void submitEdit(values)}
        onCancel={() => setEditOpen(false)}
      />
    </div>
  );
}
