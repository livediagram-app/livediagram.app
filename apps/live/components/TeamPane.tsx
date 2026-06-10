'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { colorForKey, initialsOf } from '@/lib/identity';
import { track } from '@/lib/telemetry';
import { SignInIcon } from './AuthControls';
import { PencilIcon, PlusIcon, RemoveIcon, TrashIcon } from './explorer-icons';
import { MenuItem, PortalMenu } from './PortalMenu';
import { Tooltip } from './Tooltip';
import { TeamFormModal } from './TeamFormModal';
import { TeamSharedDiagrams } from './TeamSharedDiagrams';

// Right-pane team view for the Explorer (spec/32): one calm card —
// header (organisation + member count + an overflow menu for the
// rare actions), the member list with avatars and real names, and a
// slim invite footer for admins. The last-admin rules are baked into
// the affordances: the only Admin sees no Leave item, no remove
// button on their row, and a pinned Admin pill instead of a role
// select — the server's 409 guard stays as backstop, not as UX.

export function TeamPane({
  ownerId,
  teamId,
  clerkUserId,
  clerkDisplayName,
  onTeamsChanged,
  onLeftTeam,
}: {
  ownerId: string;
  teamId: string;
  clerkUserId: string | null;
  // The signed-in user's display name, so their own row reads as a
  // person ("Thomas") rather than a placeholder ("You").
  clerkDisplayName: string | null;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
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
              <span className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
              <span className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
              <span className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (failed || !detail) {
    // The API 404/403s a team you're not a member of (we don't leak
    // its existence). Surface a proper 404 card rather than a vague
    // "couldn't load" line, with a way back to the user's own work.
    return (
      <div className="flex items-center justify-center px-6 py-16">
        <div className="flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M9 9l6 6M9 15l6-6" />
            </svg>
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
            404
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Team not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            This team doesn&apos;t exist, or you&apos;re not a member of it. Ask an admin for an
            invite, or head back to your own diagrams.
          </p>
          <button
            type="button"
            onClick={onLeftTeam}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            Back to your diagrams
          </button>
        </div>
      </div>
    );
  }

  const { team, members, myRole } = detail;
  const isAdmin = myRole === 'admin';
  const adminCount = members.filter((m) => m.role === 'admin').length;
  const selfRow = members.find((m) => m.userId !== null && m.userId === clerkUserId) ?? null;
  // The one rule the whole surface bends around: a team always keeps
  // at least one Admin (spec/32). When that's you, leaving, removing
  // your row, and demoting yourself all disappear as options.
  const isLastAdmin = (m: TeamMember) => m.role === 'admin' && adminCount <= 1;
  const canLeave = selfRow !== null && !isLastAdmin(selfRow);

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
    const label = isSelf ? null : memberName(member, false, null);
    const ok = await confirm({
      title: isSelf ? 'Leave team?' : 'Remove member?',
      message: isSelf
        ? `You will no longer be a member of "${team.name}".`
        : `${label} will be removed from "${team.name}".`,
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

  const joinedCount = members.filter((m) => m.status === 'joined').length;
  const invitedCount = members.length - joinedCount;
  const headline = [
    team.organisation,
    `${joinedCount} ${joinedCount === 1 ? 'member' : 'members'}`,
    invitedCount > 0 ? `${invitedCount} invited` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ---------- Header: context line + overflow menu ---------- */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
          <p className="min-w-0 truncate text-xs text-slate-500">{headline}</p>
          <button
            ref={menuRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Team actions"
            aria-expanded={menuOpen}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <EllipsisIcon />
          </button>
          {menuOpen ? (
            <PortalMenu
              anchor={menuRef.current}
              placement="below"
              onClose={() => setMenuOpen(false)}
            >
              {isAdmin ? (
                <MenuItem
                  icon={<PencilIcon />}
                  label="Edit team"
                  onClick={() => {
                    setEditOpen(true);
                    setMenuOpen(false);
                  }}
                />
              ) : null}
              {canLeave ? (
                <MenuItem
                  icon={<SignInIcon />}
                  label="Leave team"
                  onClick={() => {
                    setMenuOpen(false);
                    if (selfRow) void removeMember(selfRow, true);
                  }}
                />
              ) : null}
              {isAdmin ? (
                <MenuItem
                  icon={<TrashIcon />}
                  label="Delete team"
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    void deleteTeam();
                  }}
                />
              ) : null}
            </PortalMenu>
          ) : null}
        </div>

        {/* ---------- Members ---------- */}
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const isSelf = m.userId !== null && m.userId === clerkUserId;
            const name = memberName(m, isSelf, clerkDisplayName);
            // Pending = hasn't accepted (spec/32 handshake), regardless
            // of whether the lazy claim has identified them yet.
            const pending = m.status === 'invited';
            const pinnedAdmin = isLastAdmin(m);
            const removable = isAdmin && !isSelf && !pinnedAdmin;
            return (
              <li key={m.id} className="group flex items-center gap-3 px-4 py-2.5">
                <span
                  aria-hidden
                  style={{ backgroundColor: colorForKey(m.email ?? m.userId ?? m.id) }}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                    pending ? 'opacity-50' : ''
                  }`}
                >
                  {initialsOf(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-900">{name}</span>
                    {isSelf ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                        you
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {pending
                      ? 'Invited, waiting for them to accept'
                      : isSelf
                        ? (m.email ?? '')
                        : ''}
                  </span>
                </span>
                {isAdmin && !pinnedAdmin ? (
                  <select
                    value={m.role}
                    onChange={(e) => void changeRole(m, e.target.value as TeamRole)}
                    aria-label={`Role for ${name}`}
                    className="shrink-0 cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-slate-600 outline-none transition hover:border-slate-200 hover:bg-white focus:border-brand-400"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                ) : (
                  <RolePill member={m} pinned={pinnedAdmin && isAdmin} />
                )}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                  {removable ? (
                    <button
                      type="button"
                      onClick={() => void removeMember(m, false)}
                      aria-label={`Remove ${name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <RemoveIcon />
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {/* ---------- Notice + invite footer ---------- */}
        {notice ? (
          <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {notice}
          </p>
        ) : null}
        {isAdmin ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void invite();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/40 px-4 py-2.5"
          >
            <span className="shrink-0 text-slate-300">
              <PlusIcon />
            </span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Add your team by email address, they will receive an invite."
              aria-label="Invite by email address"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!inviteEmail.trim() || inviteBusy}
              className="shrink-0 rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Invite
            </button>
          </form>
        ) : null}
      </div>

      {/* ---------- Shared diagrams (spec/35): the team's folder
          tree + diagrams, managed by every joined member. ---------- */}
      <TeamSharedDiagrams ownerId={ownerId} teamId={teamId} />

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

// What a member row is called. Self rows use the account display name
// so the list reads as people, not pronouns; everyone else is their
// email's local part prettified ("anna.smith" → "Anna Smith") with
// the full address only in the avatar tooltip territory (kept out of
// the row to stay calm — the local part is the recognisable bit).
function memberName(m: TeamMember, isSelf: boolean, clerkDisplayName: string | null): string {
  if (isSelf && clerkDisplayName) return clerkDisplayName;
  // Real display name once they've joined + used the app (spec/32),
  // resolved server-side from their participant profile. Falls back to
  // the prettified invite email for pending / profile-less rows.
  if (m.name) return m.name;
  if (m.email) return prettifyEmailLocalPart(m.email);
  return isSelf ? 'You' : 'Member';
}

function prettifyEmailLocalPart(email: string): string {
  const local = email.split('@')[0] ?? email;
  const words = local.split(/[._\-+]+/).filter(Boolean);
  if (words.length === 0) return email;
  return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

function RolePill({ member, pinned }: { member: TeamMember; pinned: boolean }) {
  const pill = (
    <span
      className={`inline-flex w-fit shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
        member.role === 'admin'
          ? 'bg-brand-50 text-brand-700 ring-brand-200'
          : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {member.role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
  if (!pinned) return pill;
  // The only Admin: explain why there's no role select here.
  return (
    <Tooltip
      title="Last Admin"
      description="A team always needs at least one Admin. Promote someone else before changing this role, removing this member, or leaving."
    >
      {pill}
    </Tooltip>
  );
}

function EllipsisIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="3" cy="7" r="1.25" fill="currentColor" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" />
      <circle cx="11" cy="7" r="1.25" fill="currentColor" />
    </svg>
  );
}
