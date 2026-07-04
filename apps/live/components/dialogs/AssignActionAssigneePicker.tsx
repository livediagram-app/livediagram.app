import { initialsOf } from '@/lib/identity';
import { clerkEnabled } from '@/lib/clerk-config';

// One pickable assignee (spec/68): the pinned Myself row, or a joined
// member of the diagram's team.
export type PickableMember = {
  userId: string;
  name: string;
  email: string | null;
  // Null for the pinned Myself row (no team involved, no email).
  teamId: string | null;
  teamName: string | null;
};

// The Assign Action dialog's assignee picker (spec/68 §2): the pinned
// Myself row, the diagram team's joined members (grouped under a sticky
// team header), the loading row, and the Myself-only nudges — sign in
// (guests), move-into-a-team-library (personal diagrams), not-a-member
// (share-link editors), and the empty-team invite hint. Selection state
// stays with the dialog; picking calls back up.
export function AssigneePicker({
  signedIn,
  selfRow,
  grouped,
  members,
  memberOfDiagramTeam,
  diagramTeamId,
  assignee,
  onPick,
  signInHref,
}: {
  signedIn: boolean;
  selfRow: PickableMember | null;
  grouped: [string, { teamName: string; members: PickableMember[] }][];
  members: PickableMember[] | null;
  memberOfDiagramTeam: boolean;
  diagramTeamId: string | null;
  assignee: PickableMember | null;
  onPick: (m: PickableMember) => void;
  signInHref: string;
}) {
  const row = (m: PickableMember, isSelf: boolean) => {
    const selected = assignee?.userId === m.userId && assignee.teamId === m.teamId;
    return (
      <button
        key={`${m.teamId ?? 'self'}:${m.userId}`}
        type="button"
        onClick={() => onPick(m)}
        aria-pressed={selected}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
          selected
            ? 'bg-brand-50 dark:bg-brand-500/15'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white"
        >
          {initialsOf(m.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
          {isSelf ? 'Myself' : m.name}
          {isSelf ? <span className="text-slate-400 dark:text-slate-500"> ({m.name})</span> : null}
        </span>
        {selected ? (
          <span className="shrink-0 text-xs font-medium text-brand-600 dark:text-brand-400">
            Selected
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Assignee</span>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
        {selfRow ? row(selfRow, true) : null}
        {grouped.map(([teamId, group]) => (
          <div key={teamId}>
            <p className="sticky top-0 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {group.teamName}
            </p>
            {group.members.map((m) => row(m, false))}
          </div>
        ))}
        {signedIn && memberOfDiagramTeam && members === null ? (
          <p className="px-3 py-2 text-center text-xs text-slate-400 dark:text-slate-500">
            Loading teammates…
          </p>
        ) : null}
      </div>
      {/* Teammate nudges: sign in (guests), join a team (signed-in
          with none), or invite (teams with no other joined member). */}
      {!signedIn && clerkEnabled ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <a href={signInHref} className="font-medium text-brand-600 underline dark:text-brand-400">
            Sign in
          </a>{' '}
          and join a team to assign actions to teammates.
        </p>
      ) : signedIn && diagramTeamId === null ? (
        // Personal diagram: teammates couldn't open it to complete the
        // action, so the picker is Myself-only with the route out.
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Actions assign to the diagram&apos;s team.{' '}
          <a
            href="/explorer/team"
            className="font-medium text-brand-600 underline dark:text-brand-400"
          >
            Move this diagram into a team library
          </a>{' '}
          to assign teammates.
        </p>
      ) : signedIn && !memberOfDiagramTeam ? (
        // Share-link editor on someone else's team diagram: they can
        // edit, but only the team's members are assignable.
        <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
          Only members of this diagram&apos;s team can be assigned actions.
        </p>
      ) : signedIn && members !== null && members.length === 0 ? (
        <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
          No other joined members in this team yet — invites that haven&apos;t been accepted
          can&apos;t be assigned actions.
        </p>
      ) : null}
    </div>
  );
}
