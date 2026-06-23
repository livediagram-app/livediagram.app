'use client';

import type { TeamInvite } from '@/lib/api-client';
import { colorForKey, initialsOf } from '@/lib/identity';

// Right-pane Invites view for the Explorer (spec/32 accept/decline):
// one card per pending invite — team monogram, name, organisation,
// joined-member count — with Accept as the primary action and a
// quieter Decline. State and the api calls live in useTeams; this is
// pure render, like the other explorer views.

export function TeamInvitesPane({
  invites,
  onAccept,
  onDecline,
}: {
  invites: TeamInvite[];
  onAccept: (invite: TeamInvite) => void;
  onDecline: (invite: TeamInvite) => void;
}) {
  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="max-w-md text-sm text-slate-500">
          No pending invites. When someone adds you to a team, it shows up here for you to accept or
          decline.
        </p>
      </div>
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
        return (
          <li
            key={invite.memberId}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <span
              aria-hidden
              style={{ backgroundColor: colorForKey(invite.team.id) }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
            >
              {initialsOf(invite.team.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {invite.team.name}
              </span>
              <span className="block truncate text-xs text-slate-400">{subtitle}</span>
            </span>
            <button
              type="button"
              onClick={() => onDecline(invite)}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => onAccept(invite)}
              className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
            >
              Accept
            </button>
          </li>
        );
      })}
    </ul>
  );
}
