import { initialsOf } from '@/lib/identity';
import { clerkEnabled } from '@/lib/clerk-config';

// One pickable assignee (spec/68): the pinned Myself row, or a joined
// member of the diagram's team.
export type PickableMember = {
  // Null for an invited member the lazy claim hasn't identified with an
  // account yet — memberId is their key then.
  userId: string | null;
  // The team membership row id (undefined only for the Myself row).
  memberId?: string;
  // True while the member hasn't accepted the team invite (spec/32).
  pending?: boolean;
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
  teams,
  movingToTeamId,
  moveFailed,
  onMoveToTeam,
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
  // The user's joined teams, for the personal-diagram inline move offer
  // (spec/68 §2): pick a team and the diagram files into its library
  // root, making that team's members assignable right here.
  teams: { id: string; name: string }[];
  movingToTeamId: string | null;
  moveFailed: boolean;
  onMoveToTeam?: (teamId: string) => void;
}) {
  const row = (m: PickableMember, isSelf: boolean) => {
    // Key by membership row when there is one (stable for invited
    // members, whose userId can be null); the Myself row keys by userId.
    const selected = m.memberId
      ? assignee?.memberId === m.memberId
      : assignee?.userId === m.userId && assignee?.teamId === m.teamId;
    return (
      <button
        key={`${m.teamId ?? 'self'}:${m.memberId ?? m.userId}`}
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
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-slate-800 dark:text-slate-100">
          <span className="truncate">
            {isSelf ? 'Myself' : m.name}
            {isSelf ? (
              <span className="text-slate-400 dark:text-slate-500"> ({m.name})</span>
            ) : null}
          </span>
          {m.pending ? (
            // Same amber badge the team pane uses for pending invites.
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
              Invited
            </span>
          ) : null}
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
        // action. With teams to offer, fix it INLINE — one click files
        // the diagram into that team's library root and the members
        // load right here (spec/68 §2). No teams -> create-team link.
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {teams.length > 0 && onMoveToTeam ? (
            <>
              <p>Move this diagram into a team library to assign teammates:</p>
              <div className="flex flex-wrap gap-1.5">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={movingToTeamId !== null}
                    onClick={() => onMoveToTeam(t.id)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-300"
                  >
                    {movingToTeamId === t.id ? 'Moving…' : t.name}
                  </button>
                ))}
              </div>
              {moveFailed ? (
                <p className="text-rose-600 dark:text-rose-400">
                  Couldn&apos;t move the diagram — check your connection and try again.
                </p>
              ) : null}
            </>
          ) : (
            <p>
              Actions assign to the diagram&apos;s team.{' '}
              <a
                href="/explorer/team"
                className="font-medium text-brand-600 underline dark:text-brand-400"
              >
                Create or join a team
              </a>{' '}
              and move it into that library to assign teammates.
            </p>
          )}
        </div>
      ) : signedIn && !memberOfDiagramTeam ? (
        // Share-link editor on someone else's team diagram: they can
        // edit, but only the team's members are assignable.
        <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
          Only members of this diagram&apos;s team can be assigned actions.
        </p>
      ) : signedIn && members !== null && members.length === 0 ? (
        <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
          No other members in this team yet — invite teammates from the team page and they
          become assignable here, even before they accept.
        </p>
      ) : null}
    </div>
  );
}
