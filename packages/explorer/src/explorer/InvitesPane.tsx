'use client';

// Invites (livediagram's TeamInvitesPane): a card for each team invitation waiting for the person, with the team's
// monogram, name and organisation, how many have joined, who invited them and when, and the role offered, answered
// in place: Accept opens the team, Decline takes the card away, each said in a toast. The list is the one the
// sidebar's Invites count reads (useTeams().myTeams): no request of its own.

import { useState } from 'react';
import { teamErrorMessage, type PendingInvitation } from '../data/teams';
import { useTeams } from '../teams/context';
import { initialsOf } from '../teams/TeamCard';
import { NewTeamDialog } from '../teams/NewTeamDialog';
import { Button } from '@liveworkspace/ui';
import { EmptyState } from '@liveworkspace/ui';
import { MailIcon } from '../ui/library-icons';
import { useToast } from '../ui/Toasts';
import { relativeSince, useNow } from '../time';
import { SIDEBAR_LABELS } from '../views';
import { useExplorer } from './context';
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { PaneHeader } from './PaneHeader';

const members = (n: number) => `${n} ${n === 1 ? 'member' : 'members'}`;

export function InvitesPane({ onOpenNav }: { onOpenNav?: () => void }) {
  const { words, navigate } = useExplorer();
  const { myTeams, myTeamsFailed, retryMyTeams, canRun, answer } = useTeams();
  const toast = useToast();
  const now = useNow();
  // The invitations being answered, so their buttons wait.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const invites = myTeams?.invitations ?? null;
  const [newTeam, setNewTeam] = useState(false);

  async function reply(invite: PendingInvitation, accept: boolean) {
    setBusy((was) => new Set(was).add(invite.id));
    const result = await answer(invite, accept);
    setBusy((was) => {
      const next = new Set(was);
      next.delete(invite.id);
      return next;
    });
    if (!result.ok) {
      toast.error(teamErrorMessage(result.error));
      return;
    }
    if (result.value.status === 'joined') {
      toast.show(`You joined ${result.value.teamName}.`, { tone: 'success' });
      navigate({ kind: 'team', id: result.value.teamId });
    } else {
      toast.show(`You declined the invitation to ${invite.teamName}.`);
    }
  }

  return (
    <div data-explorer-view="invites">
      {newTeam ? (
        <NewTeamDialog
          onClose={() => setNewTeam(false)}
          onMade={(team) => navigate({ kind: 'team', id: team.id })}
        />
      ) : null}
      <PaneHeader title={SIDEBAR_LABELS.invites} onOpenNav={onOpenNav} showFilter={false} />
      {!canRun ? (
        <EmptyPane view={{ kind: 'invites' }} words={words} />
      ) : invites === null && myTeamsFailed ? (
        <EmptyState
          icon={<MailIcon size={28} />}
          title="Couldn’t load your invites"
          description="Check your connection and try again."
        >
          <Button size="sm" onClick={retryMyTeams}>
            Try again
          </Button>
        </EmptyState>
      ) : invites === null ? (
        <SkeletonRows count={2} />
      ) : invites.length === 0 ? (
        <EmptyState
          icon={<MailIcon size={28} />}
          title="No pending invites"
          description="When someone invites you to a team, the invitation shows up here, to accept or decline. Your teams are under Spaces; make one with New Team."
        >
          <Button size="sm" onClick={() => setNewTeam(true)}>
            New Team
          </Button>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {invites.map((invite) => {
            const when = invite.createdAt && now ? ` ${relativeSince(invite.createdAt, now)}` : '';
            const role = invite.role === 'admin' ? ', as an admin' : '';
            return (
              <li
                key={invite.id}
                data-invite={invite.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white dark:bg-brand-600"
                >
                  {initialsOf(invite.teamName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {invite.teamName}
                  </span>
                  {/* The organisation and the inviter's name are someone's typing: isolated, so their direction
                      never turns the words around them. */}
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {invite.organisation ? (
                      <>
                        <bdi>{invite.organisation}</bdi> ·{' '}
                      </>
                    ) : null}
                    {members(invite.memberCount)}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {invite.invitedByName ? (
                      <>
                        <bdi>{invite.invitedByName}</bdi> invited you
                      </>
                    ) : (
                      'You were invited'
                    )}
                    {`${when}${role}.`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    busy={busy.has(invite.id)}
                    aria-label={`Decline the invitation to ${invite.teamName}`}
                    onClick={() => void reply(invite, false)}
                  >
                    Decline
                  </Button>
                  <Button
                    size="xs"
                    busy={busy.has(invite.id)}
                    aria-label={`Accept the invitation to ${invite.teamName}`}
                    className="shadow-sm"
                    onClick={() => void reply(invite, true)}
                  >
                    Accept
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
