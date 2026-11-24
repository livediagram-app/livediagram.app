'use client';

// The People tab's side column (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): the join link
// for admins, the team's plan, what each role can do, and Leave Team.

import { useState, type ReactNode } from 'react';
import { Button } from '@liveworkspace/ui';
import { DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';
import { teamErrorMessage, type InviteLink } from '../../data/teams';
import { LogOutIcon } from '../../ui/icons';
import { useToast } from '../../ui/Toasts';
import type { TeamActions } from '../useTeamActions';
import { copyText } from './copy-link';

export const SIDE_CARD =
  'flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800';
const CARD_TITLE = 'm-0 text-[15px] font-semibold text-slate-900 dark:text-slate-100';
const CARD_TEXT = 'm-0 text-[13px] leading-normal text-slate-600 dark:text-slate-300';
const TEXT_ACTION =
  'relative touch-target-y cursor-pointer rounded text-[13px] font-medium underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50';

export function InviteLinkCard({
  link,
  actions,
}: {
  link: InviteLink | null;
  actions: TeamActions;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const change = async (on: boolean) => {
    setBusy(true);
    const result = await actions.setLink(on);
    setBusy(false);
    if (!result.ok) toast.error(teamErrorMessage(result.error));
  };
  return (
    <section aria-labelledby="team-link" className={SIDE_CARD} data-team-link={link ? 'on' : 'off'}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="team-link" className={CARD_TITLE}>
          Invite Link
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
            link ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span
            aria-hidden
            className={`size-[7px] rounded-full ${link ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          />
          {link ? 'On' : 'Off'}
        </span>
      </div>
      {link ? (
        <>
          <p className={CARD_TEXT}>
            Anyone signed in who opens it joins as a Member. Ends{' '}
            {DAY_MONTH_YEAR.format(link.expiresAt)}.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="Join link"
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[13px] text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
            <Button
              size="sm"
              className="h-9 shrink-0"
              onClick={() =>
                void copyText(link.url).then((copied) =>
                  copied
                    ? toast.show('Link copied.', { tone: 'success' })
                    : toast.error('Couldn’t copy the link. Select it and copy it instead.'),
                )
              }
            >
              Copy
            </Button>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void change(true)}
              className={`${TEXT_ACTION} text-slate-700 dark:text-slate-200`}
            >
              Make a New Link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void change(false)}
              className={`${TEXT_ACTION} text-rose-700 dark:text-rose-300`}
            >
              Turn Off
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={CARD_TEXT}>
            Turn it on to let anyone signed in join as a Member for 7 days.
          </p>
          <Button
            variant="secondary"
            size="sm"
            busy={busy}
            onClick={() => void change(true)}
            className="self-start"
          >
            Turn On Link
          </Button>
        </>
      )}
    </section>
  );
}

const ROLES: { role: string; words: string; admin: boolean }[] = [
  { role: 'Admin', words: 'Invites people and runs the team.', admin: true },
  { role: 'Member', words: 'Works in the team’s library.', admin: false },
];

export function RolesCard({ helpHref }: { helpHref?: string }) {
  return (
    <section aria-labelledby="team-roles" className={`${SIDE_CARD} max-sm:hidden`}>
      <h2 id="team-roles" className={CARD_TITLE}>
        What Each Role Can Do
      </h2>
      <dl className="m-0 flex flex-col gap-3">
        {ROLES.map(({ role, words, admin }) => (
          <div key={role} className="flex flex-col items-start gap-1">
            <dt
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                admin
                  ? 'bg-brand-700 text-white dark:bg-brand-500'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {role}
            </dt>
            <dd className={`m-0 ${CARD_TEXT}`}>{words}</dd>
          </div>
        ))}
      </dl>
      {helpHref ? (
        <a
          href={helpHref}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[13px] font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
        >
          Learn about team roles
        </a>
      ) : null}
    </section>
  );
}

export function LeaveTeam({ actions }: { actions: TeamActions }) {
  const blocked = !actions.rule.canLeave || !actions.me;
  return (
    <div className="flex flex-col gap-1 max-sm:items-center">
      <QuietAction onClick={actions.askLeave} disabled={blocked} icon={<LogOutIcon />}>
        Leave Team
      </QuietAction>
      {actions.admin && !actions.rule.canLeave ? (
        <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
          You’re its only admin. Make someone else an admin first, or delete the team.
        </p>
      ) : null}
    </div>
  );
}

function QuietAction({
  children,
  icon,
  onClick,
  disabled,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative touch-target-y inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg px-1 text-[13px] font-medium text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100"
    >
      {icon}
      {children}
    </button>
  );
}
