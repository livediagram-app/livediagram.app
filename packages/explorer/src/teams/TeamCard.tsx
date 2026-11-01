'use client';

// The team card (packages/explorer/README.md "Teams"; livediagram's TeamPane): the team run in place, at the top of
// its view on the page and in the panel's Members dialog. Its header says the organisation, who has joined and who is
// invited, with Invite by Link, Help and the ⋯ menu (Edit Team, Leave Team, Delete Team, by role). Then one row per
// member: name, "you", Invited, Declined or Expired, email, and role; an admin changes roles and removes people in
// place, each removal asked once in words that say who goes. An admin's footer invites an address as a Member or an
// Admin. The team's members are read when the card opens and again after each change, so it shows what accounts hold.

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { isAbort } from '../data/errors';
import { teamErrorMessage, type TeamDetails, type TeamMember, type TeamRole } from '../data/teams';
import { Button, ConfirmDialog, PictureDisc } from '@liveworkspace/ui';
import { LIST_CARD } from '../ui/classes';
import { CloseIcon, LinkIcon, PencilIcon, TrashIcon } from '../ui/icons';
import { MenuActionRow, PortalMenu } from '../ui/Menu';
import { EllipsisTriggerButton } from '../ui/RowMenu';
import { useToast } from '../ui/Toasts';
import { useTeams } from './context';
import { InviteLinkDialog } from './InviteLinkDialog';
import {
  deleteCopy,
  lastAdmin,
  memberName,
  memberState,
  orderMembers,
  removalCopy,
  removalOf,
} from './rules';
import { TEAM_FIELD, TeamFormDialog } from './TeamFormDialog';

export type TeamLoad =
  | { state: 'loading' }
  | { state: 'found'; details: TeamDetails }
  | { state: 'gone' }
  // Accounts could not be asked (no host, or it failed): the team's library still shows, without its card.
  | { state: 'unknown' };

/** A team's members, read when it opens (and on `reload`). */
export function useTeamDetails(teamId: string) {
  const { host } = useTeams();
  const [load, setLoad] = useState<{ teamId: string; load: TeamLoad }>({
    teamId,
    load: { state: host ? 'loading' : 'unknown' },
  });
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!host) {
      setLoad({ teamId, load: { state: 'unknown' } });
      return;
    }
    const controller = new AbortController();
    host.team(teamId, controller.signal).then(
      (details) =>
        setLoad({ teamId, load: details ? { state: 'found', details } : { state: 'gone' } }),
      (e: unknown) => {
        if (!isAbort(e)) setLoad({ teamId, load: { state: 'unknown' } });
      },
    );
    return () => controller.abort();
  }, [host, teamId, epoch]);
  const reload = useCallback(() => setEpoch((n) => n + 1), []);
  const current: TeamLoad = load.teamId === teamId ? load.load : { state: 'loading' };
  return [current, reload] as const;
}

/** "3 members · 1 invited · You’re an admin": the headline after the organisation. */
function teamFacts(details: TeamDetails): string[] {
  const joined = details.members.filter((m) => m.status === 'joined').length;
  const invited = details.members.filter((m) => memberState(m) === 'invited').length;
  return [
    `${joined} ${joined === 1 ? 'member' : 'members'}`,
    invited ? `${invited} invited` : null,
    details.team.myRole === 'admin' ? 'You’re an admin' : null,
  ].filter((part): part is string => part !== null);
}

/** "Northwind · 3 members · 1 invited · You’re an admin". */
export function teamHeadline(details: TeamDetails): string {
  return [details.team.organisation, ...teamFacts(details)].filter(Boolean).join(' · ');
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // Code points, so a team named "🚀 Launch" shows its rocket, not half of it.
  const first = (word: string | undefined) => (word ? Array.from(word)[0]! : '');
  return (first(parts[0]) + (parts.length > 1 ? first(parts.at(-1)) : '')).toUpperCase() || '?';
}

type Asking =
  | { kind: 'remove'; member: TeamMember; self: boolean }
  | { kind: 'delete' }
  | { kind: 'edit' }
  | { kind: 'link' }
  | null;

export function TeamCard({
  details,
  reload,
  viewerId,
  helpHref,
  onGone,
}: {
  details: TeamDetails;
  reload: () => void;
  viewerId?: string | null;
  helpHref?: string;
  /** The person left the team, or it was deleted: where they go next. */
  onGone: () => void;
}) {
  const teams = useTeams();
  const toast = useToast();
  const { team } = details;
  const admin = team.myRole === 'admin';
  const rule = lastAdmin(details.members, team.myMemberId);
  const [asking, setAsking] = useState<Asking>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);
  const isSelf = (m: TeamMember) =>
    m.id === team.myMemberId || (m.userId !== null && m.userId === viewerId);
  const me = details.members.find((m) => m.id === team.myMemberId);

  const fail = (error: string) => toast.error(teamErrorMessage(error));

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
    // Focus was handed back to the Remove button on a row that is about to go: keep it on the card instead, so the
    // keyboard isn't dropped on the page's body when the list reloads.
    const active = document.activeElement;
    const row = active?.closest('[data-team-member]')?.getAttribute('data-team-member');
    if (active === document.body || row === member.id) {
      optionsRef.current?.focus({ preventScroll: true });
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

  const removing = asking?.kind === 'remove' ? asking : null;
  const removeWords = removing
    ? removalCopy(
        removalOf(removing.member, removing.self),
        memberName(removing.member, removing.self),
        team.name,
        rule.alone,
      )
    : null;

  return (
    <div className={LIST_CARD} data-team-card={team.id}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
          {/* The organisation is someone's typing: isolated, so right-to-left text (or an override kept from
              before they were stripped) never turns the counts after it around. */}
          {team.organisation ? (
            <>
              <bdi>{team.organisation}</bdi> ·{' '}
            </>
          ) : null}
          {teamFacts(details).join(' · ')}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {admin ? (
            <button
              type="button"
              onClick={() => setAsking({ kind: 'link' })}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <LinkIcon size={12} />
              Invite by Link
            </button>
          ) : null}
          {helpHref ? (
            <a
              href={helpHref}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Help: team roles and invites"
              title="Help"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              ?
            </a>
          ) : null}
          <EllipsisTriggerButton
            ref={optionsRef}
            label={`${team.name} options`}
            expanded={menuAnchor !== null}
            onClick={(e) => setMenuAnchor(menuAnchor ? null : e.currentTarget)}
          />
        </div>
      </div>
      {menuAnchor ? (
        <PortalMenu anchor={menuAnchor} onClose={() => setMenuAnchor(null)} label="Team options">
          {admin ? (
            <MenuActionRow
              label="Edit Team"
              icon={<PencilIcon />}
              onClick={() => {
                setMenuAnchor(null);
                setAsking({ kind: 'edit' });
              }}
            />
          ) : null}
          <MenuActionRow
            label="Leave Team"
            icon={<CloseIcon />}
            disabled={!rule.canLeave || !me}
            onClick={() => {
              setMenuAnchor(null);
              if (me) setAsking({ kind: 'remove', member: me, self: true });
            }}
          />
          {admin ? (
            <MenuActionRow
              label="Delete Team"
              icon={<TrashIcon />}
              onClick={() => {
                setMenuAnchor(null);
                setAsking({ kind: 'delete' });
              }}
            />
          ) : null}
        </PortalMenu>
      ) : null}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {orderMembers(details.members).map((m) => {
          const self = isSelf(m);
          return (
            <TeamMemberRow
              key={m.id}
              m={m}
              self={self}
              manage={admin}
              pinned={self && rule.onlyAdmin}
              onRole={(role) => void changeRole(m, role)}
              onRemove={self ? undefined : () => setAsking({ kind: 'remove', member: m, self })}
            />
          );
        })}
      </ul>
      {admin && !rule.canLeave ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
          You’re its only admin. To leave, make someone else an admin first, or delete the team.
        </p>
      ) : null}
      {admin && teams.host ? <InviteFooter teamId={team.id} onInvited={reload} /> : null}

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
          title={deleteCopy(team.name).title}
          message={deleteCopy(team.name).message}
          confirmLabel={deleteCopy(team.name).confirm}
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
          onReset={async () => {
            const result = await teams.host!.resetInviteLink(team.id);
            reload();
            return result;
          }}
          onClear={async () => {
            const result = await teams.host!.clearInviteLink(team.id);
            reload();
            return result;
          }}
        />
      ) : null}
    </div>
  );
}

const PILL = 'shrink-0 rounded-full px-1.5 text-[10px] font-medium ring-1';
const ROLE_SELECT =
  'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

function RolePill({ role }: { role: TeamRole }) {
  return (
    <span
      className={`inline-flex w-fit items-center py-0.5 ${PILL} ${
        role === 'admin'
          ? 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
          : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600'
      }`}
    >
      {role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
}

function TeamMemberRow({
  m,
  self,
  manage,
  pinned,
  onRole,
  onRemove,
}: {
  m: TeamMember;
  self: boolean;
  manage: boolean;
  // The team's only admin, on their own row: their role can't change until someone else is admin.
  pinned: boolean;
  onRole: (role: TeamRole) => void;
  onRemove?: () => void;
}) {
  const name = memberName(m, self);
  const state = memberState(m);
  const waiting = state === 'invited';
  const answered = state === 'declined' || state === 'expired';
  return (
    <li className="flex items-center gap-3 px-4 py-2.5" data-team-member={m.id}>
      <PictureDisc
        aria-hidden
        pictureUrl={state === 'joined' ? m.picture : null}
        name={name}
        size={32}
        className={`flex bg-brand-500 text-xs font-semibold text-white ${
          waiting || answered ? 'opacity-50' : ''
        }`}
      >
        {initialsOf(name)}
      </PictureDisc>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <bdi className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {name}
          </bdi>
          {self ? (
            <span
              className={`${PILL} bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600`}
            >
              you
            </span>
          ) : null}
          {waiting ? (
            <span className={`${PILL} bg-amber-100 text-amber-700 ring-amber-200`}>Invited</span>
          ) : null}
          {answered ? (
            <span
              className={`${PILL} bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30`}
            >
              {state === 'declined' ? 'Declined' : 'Expired'}
            </span>
          ) : null}
        </span>
        {m.email ? (
          <bdi className="block truncate text-xs text-slate-500 dark:text-slate-400">{m.email}</bdi>
        ) : waiting ? (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            Waiting for them to accept
          </span>
        ) : null}
      </span>
      {answered ? null : manage && !pinned ? (
        <select
          aria-label={`Role for ${name}`}
          value={m.role}
          onChange={(e) => onRole(e.target.value as TeamRole)}
          className={ROLE_SELECT}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      ) : (
        <span
          className="flex items-center gap-1.5"
          title={pinned ? 'The team’s only admin' : undefined}
        >
          {pinned ? (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Only admin</span>
          ) : null}
          <RolePill role={m.role} />
        </span>
      )}
      {manage && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={
            waiting
              ? `Withdraw invite to ${name}`
              : answered
                ? `Remove ${name} from list`
                : `Remove ${name}`
          }
          title={waiting ? 'Withdraw Invite' : answered ? 'Remove from List' : 'Remove Member'}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700 dark:hover:text-rose-400"
        >
          <CloseIcon size={12} />
        </button>
      ) : manage ? (
        <span aria-hidden className="w-6 shrink-0" />
      ) : null}
    </li>
  );
}

function InviteFooter({ teamId, onInvited }: { teamId: string; onInvited: () => void }) {
  const { host } = useTeams();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!host || !email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const sent = email.trim();
    const result = await host.invite(teamId, { email: sent, role });
    setBusy(false);
    if (!result.ok) {
      setError(teamErrorMessage(result.error));
      return;
    }
    setEmail('');
    toast.show(`Invitation sent to ${sent}.`, { tone: 'success' });
    onInvited();
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40"
      data-team-invite=""
    >
      <label htmlFor={fieldId} className="sr-only">
        Email address to invite
      </label>
      <input
        id={fieldId}
        type="email"
        autoComplete="off"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`${TEAM_FIELD} min-w-0 flex-1 basis-48 py-1.5`}
      />
      <select
        aria-label="Role for the invitation"
        value={role}
        onChange={(e) => setRole(e.target.value as TeamRole)}
        className={ROLE_SELECT}
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <Button type="submit" size="xs" disabled={busy || !email.trim()}>
        {busy ? 'Sending…' : 'Invite'}
      </Button>
      {error ? (
        <p role="alert" className="w-full text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
