'use client';

import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  accountApi,
  errorMessage,
  formatDate,
  type ApiResult,
  type InviteLink,
  type Member,
  type TeamDetail,
  type TeamRole,
} from '@/lib/account-api';
import {
  lastAdmin,
  memberCountLabel,
  memberLabel,
  splitMembers,
  teamAbilities,
  teamIdFromPath,
  TEAMS_PATH,
} from '@/lib/teams';
import { BUTTON, ErrorNote, INPUT } from '../settings/AccountShell';
import { useAccountData } from '../settings/useAccountData';
import { AvatarStack, PersonAvatar, TeamAvatar } from './Avatars';
import { BackBar } from './BackBar';
import { RoleBadge } from './RoleBadge';

const noChange = () => () => {};

// One team's page, /account/teams/<id> (liveworkspace/docs/site.md "Your account"): who is in it, the
// invitations still waiting and the ones turned down, and, by the person's role, inviting people,
// the join link, changing roles, removing people, renaming it, leaving it and deleting it. The site is static, so the id comes from the
// address (lib/teams.ts teamIdFromPath).
export function TeamPage() {
  const id = useSyncExternalStore(
    noChange,
    () => teamIdFromPath(window.location.pathname),
    () => undefined,
  );
  if (id === undefined) return <PageSkeleton />;
  if (id === null) return <TeamMissing />;
  return <TeamView teamId={id} />;
}

function TeamView({ teamId }: { teamId: string }) {
  const [load, refresh] = useAccountData<TeamDetail>(
    `/teams/${encodeURIComponent(teamId)}/members`,
  );
  const [error, setError] = useState<string | null>(null);
  const name = load.state === 'ready' ? load.data.team.name : null;

  useEffect(() => {
    if (name) document.title = `${name} · Teams · liveworkspace`;
  }, [name]);

  if (load.state === 'loading') return <PageSkeleton />;
  if (load.state === 'error') {
    return load.error === 'not_found' ? (
      <TeamMissing />
    ) : (
      <>
        <BackBar href={TEAMS_PATH} label="All teams" />
        <ErrorNote>{errorMessage(load.error)}</ErrorNote>
      </>
    );
  }

  const { team, members, inviteLink } = load.data;
  const can = teamAbilities(team.myRole);
  const { joined, invited, declined } = splitMembers(members);
  const rule = lastAdmin(joined, team.myMemberId);
  const base = `/teams/${encodeURIComponent(teamId)}`;

  // Every change reads the team again, so names, roles and counts are what the server now holds.
  async function run(action: Promise<ApiResult<unknown>>) {
    setError(null);
    const result = await action;
    if (!result.ok) setError(result.error);
    await refresh();
  }
  const memberPath = (member: Member) => `${base}/members/${encodeURIComponent(member.id)}`;
  const changeRole = (member: Member, role: TeamRole) =>
    void run(accountApi(memberPath(member), 'PATCH', { role }));
  const remove = (member: Member) => void run(accountApi(memberPath(member), 'DELETE'));

  return (
    <div>
      <BackBar href={TEAMS_PATH} label="All teams" current={team.name} />

      <header className="mt-8 flex items-center gap-4 sm:gap-6">
        <TeamAvatar id={team.id} name={team.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight break-words text-slate-900 sm:text-4xl dark:text-white">
            {team.name}
          </h1>
          {team.organisation && (
            <p className="mt-1 truncate text-base text-slate-600 dark:text-slate-400">
              {team.organisation}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            <AvatarStack members={joined} total={joined.length} surface="page" />
            <span>{memberCountLabel(joined.length)}</span>
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              You’re {team.myRole === 'admin' ? 'an' : 'a'} <RoleBadge role={team.myRole} />
            </span>
          </div>
        </div>
      </header>

      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card title="Members" count={joined.length}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {joined.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  me={member.id === team.myMemberId}
                  manage={can.manage}
                  pinned={rule.onlyAdmin && member.id === team.myMemberId}
                  onRole={(role) => changeRole(member, role)}
                  onRemove={() => remove(member)}
                />
              ))}
            </ul>
          </Card>

          <Card
            title="Pending invitations"
            count={invited.length}
            hint={
              invited.length === 0
                ? can.invite
                  ? 'No one is waiting. Invite someone and they’ll show here until they answer.'
                  : 'No one is waiting to join.'
                : 'Each is reminded after 1, 7 and 21 days, and closes after 28 unanswered.'
            }
          >
            {invited.length + declined.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...invited, ...declined].map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    me={false}
                    manage={can.manage}
                    pinned={false}
                    onRole={(role) => changeRole(member, role)}
                    onRemove={() => remove(member)}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {can.invite && <InviteCard path={`${base}/members`} onInvited={refresh} />}
          {can.link && (
            <JoinLinkCard path={`${base}/invite-link`} link={inviteLink} onChanged={refresh} />
          )}
          {can.rename && (
            <DetailsCard
              path={base}
              name={team.name}
              organisation={team.organisation}
              onSaved={refresh}
            />
          )}
          <LeaveOrDelete
            name={team.name}
            canDelete={can.delete}
            rule={rule}
            onLeave={() =>
              accountApi(`${base}/members/${encodeURIComponent(team.myMemberId)}`, 'DELETE')
            }
            onDelete={() => accountApi(base, 'DELETE')}
          />
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  count,
  hint,
  tone = 'plain',
  children,
}: {
  title: string;
  count?: number;
  hint?: ReactNode;
  tone?: 'plain' | 'danger';
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`rounded-3xl border bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900 ${
        tone === 'danger'
          ? 'border-rose-200 dark:border-rose-500/30'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <h2
        id={id}
        className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"
      >
        {title}
        {count !== undefined && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <span className="text-optical-centre">{count}</span>
          </span>
        )}
      </h2>
      {hint && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

const SELECT =
  'relative touch-target-y cursor-pointer rounded-full border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-sm font-medium text-slate-700 transition-colors duration-micro hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:focus:border-white dark:focus:ring-white/10';

function MemberRow({
  member,
  me,
  manage,
  pinned,
  onRole,
  onRemove,
}: {
  member: Member;
  me: boolean;
  manage: boolean;
  // The team's only admin, on their own row: their role can't change until someone else is admin.
  pinned: boolean;
  onRole: (role: TeamRole) => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const invited = member.status === 'invited';
  const declined = member.status === 'declined';
  const label = memberLabel(member);
  const removeLabel = invited ? 'Withdraw' : declined ? 'Clear' : 'Remove';
  // Leaving is in its own card below, so a person's own row only changes their role.
  const removable = manage && !me;
  // A declined row's badge says which answer it was, so its line holds just the address.
  const secondary = declined
    ? member.email
    : invited
      ? `${member.email} · Invited ${formatDate(member.createdAt)}`
      : member.email;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-1 last:pb-1">
      <PersonAvatar member={member} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex min-w-0 items-center gap-2 font-medium text-slate-900 dark:text-white">
          <span className="truncate">{label}</span>
          {me && (
            <span className="shrink-0 text-sm font-normal text-slate-500 dark:text-slate-400">
              (you)
            </span>
          )}
        </p>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{secondary}</p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {declined ? (
          <StatusBadge expired={member.expired} />
        ) : pinned ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Only admin</span>
            <RoleBadge role="admin" />
          </span>
        ) : manage ? (
          <select
            aria-label={`Role for ${label}`}
            value={member.role}
            onChange={(event) => onRole(event.target.value as TeamRole)}
            className={SELECT}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <RoleBadge role={member.role} invited={invited} />
        )}
        {removable &&
          (confirming ? (
            <>
              <button
                type="button"
                className={`${BUTTON.danger} relative touch-target-y`}
                onClick={onRemove}
              >
                {declined ? 'Clear from list?' : `${removeLabel} ${label.split(' ')[0]}?`}
              </button>
              <button
                type="button"
                className={`${BUTTON.secondary} relative touch-target-y px-3 py-1.5`}
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label={`${removeLabel} ${label}`}
              className={`${BUTTON.danger} relative touch-target-y`}
              onClick={() => setConfirming(true)}
            >
              {removeLabel}
            </button>
          ))}
      </div>
    </li>
  );
}

function InviteCard({ path, onInvited }: { path: string; onInvited: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const fieldId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(null);
    const result = await accountApi(path, 'POST', { email, role });
    if (result.ok) {
      setSent(email.trim());
      setEmail('');
      await onInvited();
    } else setError(result.error);
    setBusy(false);
  }

  return (
    <Card
      title="Invite people"
      hint="They’ll get an email, and join when they sign in with that address."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <div>
          <label htmlFor={fieldId} className="sr-only">
            Email address
          </label>
          <input
            id={fieldId}
            type="email"
            className={INPUT}
            placeholder="name@example.com"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <fieldset>
          <legend className="sr-only">Role</legend>
          <div className="grid grid-cols-2 gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-950">
            {(['member', 'admin'] as const).map((value) => (
              <label
                key={value}
                className="relative flex cursor-pointer items-center justify-center rounded-full py-1.5 text-slate-600 transition-colors duration-micro has-checked:bg-white has-checked:text-slate-900 has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-slate-900/20 dark:text-slate-300 dark:has-checked:bg-slate-800 dark:has-checked:text-white dark:has-focus-visible:ring-white/20"
              >
                <input
                  type="radio"
                  name="invite-role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="sr-only"
                />
                <span className="text-optical-centre">
                  {value === 'admin' ? 'Admin' : 'Member'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          className={`${BUTTON.primary} relative touch-target-y w-full`}
          disabled={busy || !email.trim()}
        >
          {busy ? 'Sending…' : 'Send invitation'}
        </button>
      </form>
      {sent && (
        <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
          Invitation sent to {sent}.
        </p>
      )}
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </Card>
  );
}

// An invitation turned down, or one nobody answered in 28 days.
function StatusBadge({ expired }: { expired: boolean }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-rose-100 px-2 text-[11px] font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
      <span className="text-optical-centre">{expired ? 'Expired' : 'Declined'}</span>
    </span>
  );
}

// The team's join link (liveworkspace/docs/accounts.md "The join link"): off until an admin turns it
// on; then the link to copy, when it stops working, a new one (which ends the old) and off.
function JoinLinkCard({
  path,
  link,
  onChanged,
}: {
  path: string;
  link: InviteLink | null;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fieldId = useId();

  async function change(method: 'POST' | 'DELETE') {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await accountApi(path, method);
    if (!result.ok) setError(result.error);
    await onChanged();
    setBusy(false);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      // No clipboard (an insecure context, a refused permission): the field is selected instead.
      document.getElementById(fieldId)?.focus();
    }
  }

  return (
    <Card
      title="Invite by link"
      hint={
        link
          ? 'Anyone signed in who opens it can join as a member.'
          : 'Turn on a link anyone signed in can use to join as a member. It works for 7 days.'
      }
    >
      {link ? (
        <div className="space-y-3">
          <label htmlFor={fieldId} className="sr-only">
            Join link
          </label>
          <input
            id={fieldId}
            readOnly
            value={link.url}
            onFocus={(event) => event.currentTarget.select()}
            className={`${INPUT} font-mono text-xs`}
          />
          <button
            type="button"
            className={`${BUTTON.primary} relative touch-target-y w-full`}
            onClick={() => void copy()}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Works until {formatDate(link.expiresAt)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className={`${BUTTON.secondary} relative touch-target-y flex-1`}
              onClick={() => void change('POST')}
            >
              New link
            </button>
            <button
              type="button"
              disabled={busy}
              className={`${BUTTON.secondary} relative touch-target-y flex-1`}
              onClick={() => void change('DELETE')}
            >
              Turn off
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A new link stops the old one working.
          </p>
          {copied && (
            <p role="status" className="sr-only">
              Link copied.
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          className={`${BUTTON.secondary} relative touch-target-y w-full`}
          onClick={() => void change('POST')}
        >
          Turn on link
        </button>
      )}
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </Card>
  );
}

function DetailsCard({
  path,
  name,
  organisation,
  onSaved,
}: {
  path: string;
  name: string;
  organisation: string | null;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(name);
  const [org, setOrg] = useState(organisation ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const nameId = useId();
  const orgId = useId();
  const unchanged = value.trim() === name && org.trim() === (organisation ?? '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await accountApi(path, 'PATCH', { name: value, organisation: org });
    if (result.ok) {
      await onSaved();
      setSaved(true);
    } else setError(result.error);
    setBusy(false);
  }

  return (
    <Card title="Name and organisation">
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <div>
          <label
            htmlFor={nameId}
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Team name
          </label>
          <input
            id={nameId}
            className={`${INPUT} mt-1.5`}
            maxLength={80}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div>
          <label htmlFor={orgId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Organisation <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id={orgId}
            className={`${INPUT} mt-1.5`}
            maxLength={80}
            placeholder="Northwind Ltd"
            value={org}
            onChange={(event) => {
              setOrg(event.target.value);
              setSaved(false);
            }}
          />
        </div>
        <button
          type="submit"
          className={`${BUTTON.secondary} relative touch-target-y w-full`}
          disabled={busy || !value.trim() || unchanged}
        >
          Save
        </button>
      </form>
      {saved && (
        <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
          Saved in every app.
        </p>
      )}
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </Card>
  );
}

// Leaving is anyone's; deleting is an admin's. Each asks once more before it happens, and either
// ends on the teams list, since the person is no longer in this team.
function LeaveOrDelete({
  name,
  canDelete,
  rule,
  onLeave,
  onDelete,
}: {
  name: string;
  canDelete: boolean;
  rule: { onlyAdmin: boolean; alone: boolean; canLeave: boolean };
  onLeave: () => Promise<ApiResult<unknown>>;
  onDelete: () => Promise<ApiResult<unknown>>;
}) {
  const [confirming, setConfirming] = useState<'leave' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(action: () => Promise<ApiResult<unknown>>) {
    setBusy(true);
    setError(null);
    const result = await action();
    if (result.ok) {
      window.location.assign(TEAMS_PATH);
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <Card title={canDelete ? 'Leave or delete' : 'Leave team'} tone="danger">
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
        <div>
          {rule.canLeave ? (
            <>
              <p>
                {rule.alone
                  ? 'You’re its only member, so leaving deletes the team.'
                  : 'You’ll lose access to its work in every app. You can be invited back.'}
              </p>
              <Confirm
                open={confirming === 'leave'}
                busy={busy}
                label="Leave team"
                confirmLabel={`Leave ${name}`}
                onAsk={() => setConfirming('leave')}
                onCancel={() => setConfirming(null)}
                onConfirm={() => void go(onLeave)}
              />
            </>
          ) : (
            <p>
              You’re its only admin. To leave, make someone else an admin first, or delete the team.
            </p>
          )}
        </div>
        {canDelete && (
          <div className="border-t border-rose-100 pt-4 dark:border-rose-500/20">
            <p>
              It goes from every app for everyone in it. Work the team kept in an app stays with
              whoever made it.
            </p>
            <Confirm
              open={confirming === 'delete'}
              busy={busy}
              label="Delete team"
              confirmLabel={`Delete ${name} for everyone`}
              onAsk={() => setConfirming('delete')}
              onCancel={() => setConfirming(null)}
              onConfirm={() => void go(onDelete)}
            />
          </div>
        )}
      </div>
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </Card>
  );
}

function Confirm({
  open,
  busy,
  label,
  confirmLabel,
  onAsk,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  label: string;
  confirmLabel: string;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        className="relative touch-target-y mt-3 inline-flex cursor-pointer items-center justify-center rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors duration-micro hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
        onClick={onAsk}
      >
        {label}
      </button>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        autoFocus
        disabled={busy}
        className="relative touch-target-y inline-flex cursor-pointer items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-micro hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        className={`${BUTTON.secondary} relative touch-target-y`}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

function TeamMissing() {
  return (
    <div>
      <BackBar href={TEAMS_PATH} label="All teams" />
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          This team isn’t here
        </h1>
        <p className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-400">
          It may have been deleted, or you’re no longer in it. Your teams are all on the teams page.
        </p>
        <a href={TEAMS_PATH} className={`${BUTTON.primary} relative touch-target-y mt-6`}>
          See your teams
        </a>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy className="space-y-8">
      <div className="h-11 animate-pulse rounded-lg bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
      <div className="flex items-center gap-5">
        <div className="size-16 animate-pulse rounded-3xl bg-slate-200/70 motion-reduce:animate-none sm:size-20 dark:bg-slate-800/70" />
        <div className="h-9 w-56 animate-pulse rounded-xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
    </div>
  );
}
