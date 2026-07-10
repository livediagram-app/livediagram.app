'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { apiGetTeam, type TeamMember } from '@/lib/api-client';
import type { TeamDetailResponse } from '@/lib/api/teams';
import { SignInIcon } from '@/components/chrome/AuthControls';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/panels/explorer-icons';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import { LinkIcon, TeamMemberRow } from './team-pane-parts';
import { useTeamPaneActions } from './useTeamPaneActions';
import { TeamFormModal } from '@/components/dialogs/TeamFormModal';
import { TeamInviteLinkDialog } from '@/components/dialogs/TeamInviteLinkDialog';
import { TeamSharedDiagrams } from '@/components/panels/TeamSharedDiagrams';

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
  onLoadResult,
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
  // Whether the team loaded (true) or 404'd (false). The pane header
  // uses this to drop the team title on a 404 — there's no team to name.
  onLoadResult?: (found: boolean) => void;
}) {
  const [detail, setDetail] = useState<TeamDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await apiGetTeam(ownerId, teamId);
      setDetail(d);
      setFailed(false);
      onLoadResult?.(true);
    } catch {
      setFailed(true);
      onLoadResult?.(false);
    } finally {
      setLoading(false);
    }
  }, [ownerId, teamId, onLoadResult]);

  // Mutation handlers + the notice / invite-form state they own — see
  // useTeamPaneActions.
  const {
    inviteEmail,
    setInviteEmail,
    inviteBusy,
    notice,
    setNotice,
    submitEdit,
    deleteTeam,
    invite,
    changeRole,
    removeMember,
  } = useTeamPaneActions({ ownerId, teamId, detail, refresh, onTeamsChanged, onLeftTeam });

  useEffect(() => {
    setDetail(null);
    setLoading(true);
    setFailed(false);
    setNotice(null);
    setInviteEmail('');
    void refresh();
    // setNotice / setInviteEmail are stable useState setters from the
    // actions hook; refresh is the only real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
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

  if (failed || !detail) {
    // The API 404/403s a team you're not a member of (we don't leak
    // its existence). Surface a proper 404 card rather than a vague
    // "couldn't load" line, with a way back to the user's own work.
    return (
      <div className="flex items-center justify-center px-6 py-16">
        <div className="flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300">
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
          <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            Team not found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            This team doesn&apos;t exist, or you&apos;re not a member of it. Ask an admin for an
            invite, or head back to your own diagrams.
          </p>
          <Button size="md" onClick={onLeftTeam} className="mt-6 shadow-sm">
            Back to your diagrams
          </Button>
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {/* ---------- Header: context line + overflow menu ---------- */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">{headline}</p>
          <div className="flex shrink-0 items-center gap-1">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                aria-label="Invite by link"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                <LinkIcon />
                <span className="hidden sm:inline">Invite by link</span>
              </button>
            ) : null}
            <EllipsisTriggerButton
              ref={menuRef}
              label="Team actions"
              expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            />
          </div>
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
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {members.map((m) => (
            <TeamMemberRow
              key={m.id}
              m={m}
              clerkUserId={clerkUserId}
              clerkDisplayName={clerkDisplayName}
              isAdmin={isAdmin}
              pinnedAdmin={isLastAdmin(m)}
              onChangeRole={(member, role) => void changeRole(member, role)}
              onRemove={(member) => void removeMember(member, false)}
            />
          ))}
        </ul>

        {/* ---------- Notice + invite footer ---------- */}
        {notice ? (
          <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            {notice}
          </p>
        ) : null}
        {isAdmin ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void invite();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/40 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/30"
          >
            <span className="shrink-0 text-slate-300 dark:text-slate-600">
              <PlusIcon />
            </span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Add your team by email address, they will receive an invite."
              aria-label="Invite by email address"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <Button
              type="submit"
              size="xs"
              disabled={!inviteEmail.trim() || inviteBusy}
              className="shrink-0 py-1 shadow-sm"
            >
              Invite
            </Button>
          </form>
        ) : null}
      </div>

      {/* ---------- Shared diagrams (spec/35): the team's folder
          tree + diagrams, managed by every joined member. ---------- */}
      {/* key on teamId so switching teams remounts the library and
          resets its open-folder `spot` — otherwise a subfolder open in
          team A leaks into team B as a stale, empty folder view. */}
      <TeamSharedDiagrams key={teamId} ownerId={ownerId} teamId={teamId} />

      <TeamFormModal
        open={editOpen}
        title="Edit team"
        submitLabel="Save"
        initial={{ name: team.name, organisation: team.organisation }}
        onSubmit={(values) => {
          setEditOpen(false);
          void submitEdit(values);
        }}
        onCancel={() => setEditOpen(false)}
      />

      <TeamInviteLinkDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        ownerId={ownerId}
        teamId={teamId}
        inviteLink={detail.inviteLink}
        onInviteLinkChange={(link) => setDetail((d) => (d ? { ...d, inviteLink: link } : d))}
      />
    </div>
  );
}
