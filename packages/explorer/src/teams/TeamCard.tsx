'use client';

// The team card (packages/explorer/README.md "Teams"; livediagram's TeamPane): the team run in place, at the top of
// its view on the page and in the panel's Members dialog. Its header says the organisation, who has joined and who is
// invited, with Invite by Link, Help and the ⋯ menu (Edit Team, Leave Team, Delete Team, by role). Then one row per
// member: name, "you", Invited, Declined or Expired, email, and role; an admin changes roles and removes people in
// place, each removal asked once in words that say who goes. An admin's footer invites an address as a Member or an
// Admin. The team's members are read when the card opens and again after each change, so it shows what accounts hold.

import { useId, useRef, useState, type FormEvent } from 'react';
import { teamErrorMessage, type TeamDetails, type TeamMember, type TeamRole } from '../data/teams';
import { Button, PictureDisc, Select } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { initialsOf as personInitials } from '@liveworkspace/model-core/names';
import { avatarFill } from '@liveworkspace/account-menu/initials';
import { LIST_CARD } from '../ui/classes';
import { CloseIcon, LinkIcon, PencilIcon, TrashIcon } from '../ui/icons';
import { MenuActionRow, PortalMenu } from '../ui/Menu';
import { EllipsisTriggerButton } from '../ui/RowMenu';
import { useToast } from '../ui/Toasts';
import { useTeams } from './context';
import { PILL, PILL_QUIET, RolePill } from './RolePill';
import { memberName, memberState, orderMembers } from './rules';
import { TEAM_FIELD } from './TeamFormDialog';
import { useTeamActions } from './useTeamActions';
import { teamFacts } from './team-details';
import { TeamPlan } from './TeamPlan';

// What the team view reads before its card loads, kept apart so the card's chunk stays out of the first load.
export { initialsOf, teamHeadline, useTeamDetails, type TeamLoad } from './team-details';

/** A member's disc, by the account control's own rule (@liveworkspace/account-menu avatarFill), so it is the colour
 *  of their account button in the header: their own presence colour, else (Automatic) the one picked from the name
 *  the row shows, shaded until white initials read at AA. */
export function memberFill(m: Pick<TeamMember, 'color'>, name: string): string {
  return avatarFill(name, m.color);
}

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
  const { team } = details;
  const actions = useTeamActions({ details, reload, viewerId, onGone });
  const { admin, rule, me } = actions;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

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
              onClick={actions.askLink}
              className="relative touch-target-y inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
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
              className="relative touch-target-y inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              ?
            </a>
          ) : null}
          <EllipsisTriggerButton
            ref={actions.homeRef}
            label={`${team.name} options`}
            expanded={menuAnchor !== null}
            onClick={(e) => setMenuAnchor(menuAnchor ? null : e.currentTarget)}
          />
        </div>
      </div>
      {/* The team's plan and the way to change it, with Pro on (TeamPlan.tsx). */}
      <TeamPlan teamId={team.id} />
      {menuAnchor ? (
        <PortalMenu anchor={menuAnchor} onClose={() => setMenuAnchor(null)} label="Team options">
          {admin ? (
            <MenuActionRow
              label="Edit Team"
              icon={<PencilIcon />}
              onClick={() => {
                setMenuAnchor(null);
                actions.askEdit();
              }}
            />
          ) : null}
          <MenuActionRow
            label="Leave Team"
            icon={<CloseIcon />}
            disabled={!rule.canLeave || !me}
            onClick={() => {
              setMenuAnchor(null);
              actions.askLeave();
            }}
          />
          {admin ? (
            <MenuActionRow
              label="Delete Team"
              icon={<TrashIcon />}
              onClick={() => {
                setMenuAnchor(null);
                actions.askDelete();
              }}
            />
          ) : null}
        </PortalMenu>
      ) : null}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {orderMembers(details.members).map((m) => {
          const self = actions.isSelf(m);
          return (
            <TeamMemberRow
              key={m.id}
              m={m}
              self={self}
              manage={admin}
              pinned={self && rule.onlyAdmin}
              onRole={(role) => void actions.changeRole(m, role)}
              onRemove={self ? undefined : () => actions.askRemove(m)}
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

      {actions.dialogs}
    </div>
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
        style={{ backgroundColor: memberFill(m, name) }}
        className={`flex text-xs font-semibold text-white ${waiting || answered ? 'opacity-50' : ''}`}
      >
        {personInitials(name, m.email)}
      </PictureDisc>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <bdi className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {name}
          </bdi>
          {self ? <span className={`${PILL} ${PILL_QUIET}`}>you</span> : null}
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
        <Select
          aria-label={`Role for ${name}`}
          value={m.role}
          onChange={(e) => onRole(e.target.value as TeamRole)}
          className="shrink-0"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
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
  const inviteRef = useRef<HTMLButtonElement>(null);

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
    // The emptied field disables Invite: the keyboard goes back to the field, ready for the next address.
    if (document.activeElement === inviteRef.current) document.getElementById(fieldId)?.focus();
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
      <Select
        aria-label="Role for the invitation"
        value={role}
        onChange={(e) => setRole(e.target.value as TeamRole)}
        // As tall as the email field beside it, with Invite.
        className="shrink-0 self-stretch"
        selectClassName="h-full text-[13px]"
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </Select>
      <Button
        ref={inviteRef}
        type="submit"
        size="sm"
        className="self-stretch"
        disabled={!email.trim()}
        busy={busy}
      >
        {busy ? 'Sending…' : 'Invite'}
      </Button>
      {error ? (
        <Callout tone="error" role="alert" className="w-full">
          {error}
        </Callout>
      ) : null}
    </form>
  );
}
