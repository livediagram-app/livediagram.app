import { Tooltip } from '@/components/primitives/Tooltip';
import type { TeamMember, TeamRole } from '@/lib/api-client';
import { colorForKey, initialsOf } from '@/lib/identity';
import { RemoveIcon } from '@/components/panels/explorer-icons';

// What a member row is called. Self rows use the account display name
// so the list reads as people, not pronouns; everyone else is their
// email's local part prettified ("anna.smith" → "Anna Smith") with
// the full address only in the avatar tooltip territory (kept out of
// the row to stay calm — the local part is the recognisable bit).
export function memberName(
  m: TeamMember,
  isSelf: boolean,
  clerkDisplayName: string | null,
): string {
  if (isSelf && clerkDisplayName) return clerkDisplayName;
  // Real display name once they've joined + used the app (spec/32),
  // resolved server-side from their participant profile. Falls back to
  // the prettified invite email for pending / profile-less rows.
  if (m.name) return m.name;
  if (m.email) return prettifyEmailLocalPart(m.email);
  return isSelf ? 'You' : 'Member';
}

function prettifyEmailLocalPart(email: string): string {
  const local = email.split('@')[0] ?? email;
  const words = local.split(/[._\-+]+/).filter(Boolean);
  if (words.length === 0) return email;
  return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

function RolePill({ member, pinned }: { member: TeamMember; pinned: boolean }) {
  const pill = (
    <span
      className={`inline-flex w-fit shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
        member.role === 'admin'
          ? 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
          : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600'
      }`}
    >
      {member.role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
  if (!pinned) return pill;
  // The only Admin: explain why there's no role select here.
  return (
    <Tooltip
      title="Last Admin"
      description="A team always needs at least one Admin. Promote someone else before changing this role, removing this member, or leaving."
    >
      {pill}
    </Tooltip>
  );
}

export function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93M14 11a5 5 0 0 0-7.07 0L5.5 12.4a5 5 0 0 0 7.07 7.07L13.9 18.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// One member row (spec/32): avatar bubble, name + you / Invited badges,
// the email identifier line, the admin's role select (or the pinned
// RolePill), and the hover-reveal remove button. Lifted out of
// TeamPane's list; every mutation comes through the pane's handlers.
export function TeamMemberRow({
  m,
  clerkUserId,
  clerkDisplayName,
  isAdmin,
  pinnedAdmin,
  onChangeRole,
  onRemove,
}: {
  m: TeamMember;
  clerkUserId: string | null;
  clerkDisplayName: string | null;
  isAdmin: boolean;
  // True when this member is the team's last admin — their role select
  // and remove button are withheld so a team can't orphan itself.
  pinnedAdmin: boolean;
  onChangeRole: (member: TeamMember, role: TeamRole) => void;
  onRemove: (member: TeamMember) => void;
}) {
  const isSelf = m.userId !== null && m.userId === clerkUserId;
  const name = memberName(m, isSelf, clerkDisplayName);
  // Pending = hasn't accepted (spec/32 handshake), regardless
  // of whether the lazy claim has identified them yet.
  const pending = m.status === 'invited';
  const removable = isAdmin && !isSelf && !pinnedAdmin;
  return (
    <li key={m.id} className="group flex items-center gap-3 px-4 py-2.5">
      <span
        aria-hidden
        style={{ backgroundColor: colorForKey(m.email ?? m.userId ?? m.id) }}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
          pending ? 'opacity-50' : ''
        }`}
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {name}
          </span>
          {isSelf ? (
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600">
              you
            </span>
          ) : null}
          {pending ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
              Invited
            </span>
          ) : null}
        </span>
        {/* Email under the name for every member (spec/32) — the
              recognisable identifier alongside the display name.
              `truncate` keeps long addresses from breaking the row
              layout on mobile. Pending rows that somehow carry no
              address fall back to the waiting hint. */}
        {m.email ? (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {m.email}
          </span>
        ) : pending ? (
          <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
            Waiting for them to accept
          </span>
        ) : null}
      </span>
      {isAdmin && !pinnedAdmin ? (
        <select
          value={m.role}
          onChange={(e) => onChangeRole(m, e.target.value as TeamRole)}
          aria-label={`Role for ${name}`}
          className="shrink-0 cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-slate-600 outline-none transition hover:border-slate-200 hover:bg-white focus:border-brand-400 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:[&>option]:bg-slate-800"
        >
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
      ) : (
        <RolePill member={m} pinned={pinnedAdmin && isAdmin} />
      )}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {removable ? (
          <button
            type="button"
            onClick={() => onRemove(m)}
            aria-label={`Remove ${name}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
          >
            <RemoveIcon />
          </button>
        ) : null}
      </span>
    </li>
  );
}
