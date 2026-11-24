'use client';

// The People tab's list (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): the joined members as
// a table (name, you, address, role, when added, a row menu), then Waiting to Join, the invitations not yet
// answered or turned down, each with what an admin can do about it. On a phone each member is one row, the role a
// pill and its change in the row menu.

import { useState, type ReactNode } from 'react';
import { PictureDisc, Select } from '@liveworkspace/ui';
import { avatarFill } from '@liveworkspace/account-menu/initials';
import { initialsOf as personInitials } from '@liveworkspace/model-core/names';
import type { TeamMember, TeamRole } from '../../data/teams';
import { CloseIcon, MailIcon, RestoreIcon, SendIcon, UserIcon } from '../../ui/icons';
import { MenuActionRow, PortalMenu } from '../../ui/Menu';
import { EllipsisTriggerButton } from '../../ui/RowMenu';
import { PILL, PILL_QUIET, RolePill } from '../RolePill';
import { memberName, memberState } from '../rules';
import type { TeamActions } from '../useTeamActions';
import { addedOn, INVITATION_DAYS, invitationLine, invitationPill } from './people';

const ROW_GRID = 'sm:grid sm:grid-cols-[minmax(0,1fr)_8.5rem_7rem_2.25rem] sm:gap-3';

export function MemberTable({
  members,
  actions,
}: {
  members: readonly TeamMember[];
  actions: TeamActions;
}) {
  return (
    <div data-team-members="">
      <div
        aria-hidden
        className={`hidden border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400 ${ROW_GRID}`}
      >
        <span>Name</span>
        <span>Role</span>
        <span>Added</span>
        <span />
      </div>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-700/60">
        {members.map((m) => (
          <MemberRow key={m.id} m={m} actions={actions} />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({ m, actions }: { m: TeamMember; actions: TeamActions }) {
  const self = actions.isSelf(m);
  const name = memberName(m, self);
  const manage = actions.admin;
  // The team's only admin, on their own row: their role can't change until someone else is admin.
  const pinned = self && actions.rule.onlyAdmin;
  const added = addedOn(m);
  const other: TeamRole = m.role === 'admin' ? 'member' : 'admin';
  const menu =
    manage && !pinned
      ? [
          {
            label: other === 'admin' ? 'Make Admin' : 'Make Member',
            icon: <UserIcon />,
            run: () => void actions.changeRole(m, other),
          },
          ...(self
            ? []
            : [{ label: 'Remove Member', icon: <CloseIcon />, run: () => actions.askRemove(m) }]),
        ]
      : [];
  return (
    <li
      data-team-member={m.id}
      className={`flex items-center gap-3 py-3 pl-4 pr-2 sm:items-center sm:pr-4 ${ROW_GRID}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Disc m={m} name={name} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <bdi className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {name}
            </bdi>
            {self ? <span className={`${PILL} ${PILL_QUIET}`}>you</span> : null}
          </span>
          {m.email ? (
            <bdi className="truncate text-[13px] text-slate-500 dark:text-slate-400">{m.email}</bdi>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 sm:justify-start">
        {manage && !pinned ? (
          <>
            <span className="sm:hidden">
              <RolePill role={m.role} />
            </span>
            <Select
              aria-label={`Role for ${name}`}
              value={m.role}
              onChange={(e) => void actions.changeRole(m, e.target.value as TeamRole)}
              className="max-sm:hidden"
              selectClassName="h-8 text-[13px]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </>
        ) : (
          <span
            className="flex items-center gap-1.5"
            title={pinned ? 'The team’s only admin' : undefined}
          >
            <RolePill role={m.role} />
            {pinned ? (
              <span className="text-[11px] text-slate-500 max-sm:hidden dark:text-slate-400">
                Only admin
              </span>
            ) : null}
          </span>
        )}
      </span>
      <span className="hidden text-[13px] text-slate-600 sm:block dark:text-slate-300">
        {added ?? ''}
      </span>
      <span className="flex w-9 shrink-0 justify-end">
        {menu.length > 0 ? <RowMenu label={`${name} options`} rows={menu} /> : null}
      </span>
    </li>
  );
}

export function WaitingList({
  invites,
  actions,
}: {
  invites: readonly TeamMember[];
  actions: TeamActions;
}) {
  if (invites.length === 0) return null;
  return (
    <section aria-labelledby="team-waiting" data-team-waiting="">
      <div className="flex items-baseline justify-between gap-3 border-y border-amber-200 bg-amber-50 px-4 py-2.5 first:border-t-0 dark:border-amber-500/20 dark:bg-amber-500/10">
        <h3
          id="team-waiting"
          className="m-0 text-[13px] font-semibold text-amber-900 dark:text-amber-200"
        >
          Waiting to Join
        </h3>
        <span className="text-xs text-amber-800 dark:text-amber-300">
          Invitations close after {INVITATION_DAYS} days
        </span>
      </div>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-700/60">
        {invites.map((m) => (
          <WaitingRow key={m.id} m={m} actions={actions} />
        ))}
      </ul>
    </section>
  );
}

function WaitingRow({ m, actions }: { m: TeamMember; actions: TeamActions }) {
  const name = m.email ?? memberName(m, false);
  const pill = invitationPill(m);
  const open = memberState(m) === 'invited';
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li data-team-member={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className="flex min-w-0 flex-[1_1_14rem] items-center gap-3">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400"
        >
          <MailIcon />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <bdi className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {name}
            </bdi>
            <span
              className={`${PILL} py-0.5 ${
                pill === 'Invited'
                  ? 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'
                  : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
              }`}
            >
              {pill}
            </span>
          </span>
          <span className="text-[13px] text-slate-500 dark:text-slate-400">
            {invitationLine(m)}
          </span>
        </span>
      </span>
      {actions.admin ? (
        <span className="flex shrink-0 gap-1.5 max-sm:pl-12">
          <QuietButton
            disabled={busy}
            onClick={() => void run(() => (open ? actions.resend(m) : actions.inviteAgain(m)))}
            icon={open ? <SendIcon /> : <RestoreIcon />}
          >
            {open ? 'Resend' : 'Invite Again'}
          </QuietButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => actions.askRemove(m)}
            aria-label={open ? `Withdraw invite to ${name}` : `Remove ${name} from list`}
            className="relative touch-target-y inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-[13px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            {open ? 'Withdraw' : 'Remove'}
          </button>
        </span>
      ) : null}
    </li>
  );
}

function QuietButton({
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
      className="relative touch-target-y inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 [&_svg]:size-3.5 [&_svg]:text-slate-500"
    >
      {icon}
      {children}
    </button>
  );
}

function Disc({ m, name }: { m: TeamMember; name: string }) {
  return (
    <PictureDisc
      aria-hidden
      pictureUrl={m.status === 'joined' ? m.picture : null}
      name={name}
      size={36}
      style={{ backgroundColor: avatarFill(name, m.color) }}
      className="flex shrink-0 text-[13px] font-semibold text-white"
    >
      {personInitials(name, m.email)}
    </PictureDisc>
  );
}

type MenuRow = { label: string; icon: ReactNode; run: () => void };

export function RowMenu({ label, rows }: { label: string; rows: MenuRow[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <EllipsisTriggerButton
        label={label}
        expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      />
      {anchor ? (
        <PortalMenu anchor={anchor} onClose={() => setAnchor(null)} label={label}>
          {rows.map((row) => (
            <MenuActionRow
              key={row.label}
              label={row.label}
              icon={row.icon}
              onClick={() => {
                setAnchor(null);
                row.run();
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}
