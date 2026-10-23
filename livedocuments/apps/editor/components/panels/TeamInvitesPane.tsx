'use client';

import {
  buttonClassName,
  ButtonContent,
  EmptyState,
  IDENTITY_FILL,
  identityVars,
  lucideGlyph,
  relativeSince,
} from '@livedocuments/ui';
import { lucideMail } from '@livedocuments/icons/lucide';

import type { TeamInvite } from '@/lib/api-client';
import { manageTeamsUrl } from '@/lib/auth-config';
import { colorForKey, initialsOf } from '@/lib/identity';
import { useRelativeNow } from '@/lib/relative-time';

// Right-pane Invites view for the Explorer (docs/specs/013-workspace/teams.md "Invitations"): one card per
// invitation waiting for the caller on liveworkspace.app, with the team's monogram, name and
// organisation, how many have joined, who invited them, when, and the role offered. They are answered
// on liveworkspace.app, so each card links to its teams page, where the invitation waits. Pure render;
// the list comes from useTeams.

// Where the invitations wait on liveworkspace.app.
export const ANSWER_INVITATIONS_URL = `${manageTeamsUrl}#invitations`;

export function TeamInvitesPane({ invites }: { invites: TeamInvite[] }) {
  const now = useRelativeNow();
  if (invites.length === 0) {
    return (
      <EmptyState
        icon={<MailIcon />}
        title="No pending invites"
        description="When someone invites you to a team, the invitation shows up here. You answer it on liveworkspace.app."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {invites.map((invite) => {
        const subtitle = [
          invite.team.organisation,
          `${invite.memberCount} ${invite.memberCount === 1 ? 'member' : 'members'}`,
        ]
          .filter(Boolean)
          .join(' · ');
        const from = invite.invitedByName
          ? `${invite.invitedByName} invited you`
          : 'You were invited';
        const when = now ? ` ${relativeSince(invite.invitedAt, now)}` : '';
        const role = invite.role === 'admin' ? ', as an admin' : '';
        return (
          <li
            key={invite.memberId}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <span
              aria-hidden
              style={{ ...identityVars(colorForKey(invite.team.id)) }}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white ${IDENTITY_FILL}`}
            >
              {initialsOf(invite.team.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {invite.team.name}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {`${from}${when}${role}.`}
              </span>
            </span>
            <a
              href={ANSWER_INVITATIONS_URL}
              className={buttonClassName({ size: 'xs', className: 'shrink-0 shadow-sm' })}
            >
              <ButtonContent>Answer on liveworkspace.app</ButtonContent>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// Envelope: the empty-state badge glyph for invitations.
const MailIcon = lucideGlyph(lucideMail, 28);
