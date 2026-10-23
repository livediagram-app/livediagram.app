'use client';

// Invites (livediagram's TeamInvitesPane): a card for each team invitation waiting for the person, with the team's
// monogram, name and organisation, how many have joined, who invited them and when, and the role offered. They are
// answered where teams are run (the host's Manage Teams page), so each card links there. The list is the one the
// sidebar's Invites count reads (useExtras().myTeams): no request of its own.

import { buttonClassName } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { MailIcon } from '../ui/library-icons';
import { relativeSince, useNow } from '../time';
import { SIDEBAR_LABELS } from '../views';
import { useExplorer } from './context';
import { useExtras } from './extras';
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { PaneHeader } from './PaneHeader';
import { initialsOf } from './TeamPane';

/** Where the invitations wait on the host's Manage Teams page. */
export const invitationsHref = (manageTeamsUrl: string) =>
  `${manageTeamsUrl.replace(/#.*$/, '')}#invitations`;

const members = (n: number) => `${n} ${n === 1 ? 'member' : 'members'}`;

export function InvitesPane({ onOpenNav }: { onOpenNav?: () => void }) {
  const { manageTeamsUrl, words } = useExplorer();
  const { myTeams, accounts, signedIn } = useExtras();
  const now = useNow();
  const answerAt = manageTeamsUrl ? invitationsHref(manageTeamsUrl) : null;
  const invites = myTeams?.invitations ?? null;
  return (
    <div data-explorer-view="invites">
      <PaneHeader title={SIDEBAR_LABELS.invites} onOpenNav={onOpenNav} showFilter={false} />
      {!accounts || !signedIn ? (
        <EmptyPane view={{ kind: 'invites' }} words={words} />
      ) : invites === null ? (
        <SkeletonRows count={2} />
      ) : invites.length === 0 ? (
        <EmptyState
          icon={<MailIcon size={28} />}
          title="No pending invites"
          description="When someone invites you to a team, the invitation shows up here. You answer it where your teams are run."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {invites.map((invite) => {
            const subtitle = [invite.organisation, members(invite.memberCount)]
              .filter(Boolean)
              .join(' · ');
            const from = invite.invitedByName
              ? `${invite.invitedByName} invited you`
              : 'You were invited';
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white"
                >
                  {initialsOf(invite.teamName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {invite.teamName}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {`${from}${when}${role}.`}
                  </span>
                </span>
                {answerAt ? (
                  <a
                    href={answerAt}
                    aria-label={`Answer the invitation to ${invite.teamName}`}
                    className={buttonClassName({ size: 'xs', className: 'shrink-0 shadow-sm' })}
                  >
                    Answer
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
