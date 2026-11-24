'use client';

// What a team's admins and members do to it, and the dialogs that ask first (liveworkspace/docs/specs/004-index/
// one-explorer.md "Teams are run in the Explorer"): change a role, remove someone (or withdraw or clear an
// invitation), resend or renew an invitation, edit, leave or delete the team, and turn its join link on and off. One
// hook, so the team's page (teams/page/) and the panel's Members card (TeamCard.tsx) act and word every question the
// same way.

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { ConfirmDialog } from '@liveworkspace/ui';
import {
  teamErrorMessage,
  type TeamDetails,
  type TeamMember,
  type TeamResult,
  type TeamRole,
} from '../data/teams';
import { useToast } from '../ui/Toasts';
import { useTeams } from './context';
import { InviteLinkDialog } from './InviteLinkDialog';
import { deleteCopy, lastAdmin, memberName, removalCopy, removalOf } from './rules';
import { TeamFormDialog } from './TeamFormDialog';

type Asking =
  | { kind: 'remove'; member: TeamMember; self: boolean }
  | { kind: 'delete' }
  | { kind: 'edit' }
  | { kind: 'link' }
  | null;

export type TeamActions = {
  admin: boolean;
  rule: ReturnType<typeof lastAdmin>;
  me: TeamMember | undefined;
  isSelf: (m: TeamMember) => boolean;
  /** Where the keyboard goes when the row it was on leaves (the team's options button). */
  homeRef: RefObject<HTMLButtonElement | null>;
  changeRole: (member: TeamMember, role: TeamRole) => Promise<void>;
  askRemove: (member: TeamMember) => void;
  askLeave: () => void;
  askDelete: () => void;
  askEdit: () => void;
  askLink: () => void;
  resend: (member: TeamMember) => Promise<void>;
  inviteAgain: (member: TeamMember) => Promise<void>;
  /** The join link turned on (a new one when `fresh`), or off. */
  setLink: (on: boolean) => Promise<TeamResult<unknown>>;
  /** The question being asked, if any, to render once. */
  dialogs: ReactNode;
};

export function useTeamActions({
  details,
  reload,
  viewerId,
  onGone,
}: {
  details: TeamDetails;
  reload: () => void;
  viewerId?: string | null;
  onGone: () => void;
}): TeamActions {
  const teams = useTeams();
  const toast = useToast();
  const { team } = details;
  const admin = team.myRole === 'admin';
  const rule = lastAdmin(details.members, team.myMemberId);
  const [asking, setAsking] = useState<Asking>(null);
  const homeRef = useRef<HTMLButtonElement | null>(null);
  const isSelf = (m: TeamMember) =>
    m.id === team.myMemberId || (m.userId !== null && m.userId === viewerId);
  const me = details.members.find((m) => m.id === team.myMemberId);

  // Named by its team, so the refusal still says where it happened in the notification list.
  const fail = (error: string) => toast.error(`${team.name}: ${teamErrorMessage(error)}`);

  async function changeRole(member: TeamMember, role: TeamRole) {
    if (!teams.host) return;
    const result = await teams.host.setRole(team.id, member.id, role);
    if (!result.ok) fail(result.error);
    reload();
  }

  async function remove(member: TeamMember, self: boolean) {
    setAsking(null);
    const result = await teams.removeMember(team.id, member.id);
    if (!result.ok) {
      fail(result.error);
      reload();
      return;
    }
    if (self || result.value.teamDeleted) {
      toast.show(
        result.value.teamDeleted ? `${team.name} was deleted.` : `You left ${team.name}.`,
        { tone: 'success' },
      );
      onGone();
      return;
    }
    // Focus was handed back to the button on a row that is about to go: keep it on the team instead, so the
    // keyboard isn't dropped on the page's body when the list reloads.
    const active = document.activeElement;
    const row = active?.closest('[data-team-member]')?.getAttribute('data-team-member');
    if (active === document.body || row === member.id) {
      homeRef.current?.focus({ preventScroll: true });
    }
    reload();
  }

  async function deleteTeam() {
    setAsking(null);
    const result = await teams.remove(team.id);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    toast.show(`${team.name} was deleted.`, { tone: 'success' });
    onGone();
  }

  async function resend(member: TeamMember) {
    if (!teams.host || !member.email) return;
    const result = await teams.host.resendInvite(team.id, member.id);
    if (!result.ok) {
      fail(result.error);
      return;
    }
    toast.show(`Invitation sent again to ${member.email}.`, { tone: 'success' });
    reload();
  }

  async function inviteAgain(member: TeamMember) {
    if (!teams.host || !member.email) return;
    const result = await teams.host.invite(team.id, { email: member.email, role: member.role });
    if (!result.ok) {
      fail(result.error);
      return;
    }
    toast.show(`Invitation sent to ${member.email}.`, { tone: 'success' });
    reload();
  }

  async function setLink(on: boolean): Promise<TeamResult<unknown>> {
    if (!teams.host) return { ok: false, error: 'unavailable' };
    const result = on
      ? await teams.host.resetInviteLink(team.id)
      : await teams.host.clearInviteLink(team.id);
    reload();
    return result;
  }

  const removing = asking?.kind === 'remove' ? asking : null;
  const removeWords = removing
    ? removalCopy(
        removalOf(removing.member, removing.self),
        memberName(removing.member, removing.self),
        team.name,
        rule.alone,
      )
    : null;
  const deleteWords = deleteCopy(team.name);

  const dialogs = (
    <>
      {removing && removeWords ? (
        <ConfirmDialog
          open
          title={removeWords.title}
          message={removeWords.message}
          confirmLabel={removeWords.confirm}
          onCancel={() => setAsking(null)}
          onConfirm={() => void remove(removing.member, removing.self)}
        />
      ) : null}
      {asking?.kind === 'delete' ? (
        <ConfirmDialog
          open
          title={deleteWords.title}
          message={deleteWords.message}
          confirmLabel={deleteWords.confirm}
          onCancel={() => setAsking(null)}
          onConfirm={() => void deleteTeam()}
        />
      ) : null}
      {asking?.kind === 'edit' ? (
        <TeamFormDialog
          mode="edit"
          initial={{ name: team.name, organisation: team.organisation }}
          onClose={() => setAsking(null)}
          onSubmit={async (input) => {
            const result = await teams.update(team.id, input);
            if (result.ok) {
              setAsking(null);
              reload();
            }
            return result;
          }}
        />
      ) : null}
      {asking?.kind === 'link' && teams.host ? (
        <InviteLinkDialog
          teamName={team.name}
          link={details.inviteLink ?? null}
          onClose={() => setAsking(null)}
          onReset={() => setLink(true)}
          onClear={() => setLink(false)}
        />
      ) : null}
    </>
  );

  return {
    admin,
    rule,
    me,
    isSelf,
    homeRef,
    changeRole,
    askRemove: (member) => setAsking({ kind: 'remove', member, self: isSelf(member) }),
    askLeave: () => {
      if (me) setAsking({ kind: 'remove', member: me, self: true });
    },
    askDelete: () => setAsking({ kind: 'delete' }),
    askEdit: () => setAsking({ kind: 'edit' }),
    askLink: () => setAsking({ kind: 'link' }),
    resend,
    inviteAgain,
    setLink,
    dialogs,
  };
}
